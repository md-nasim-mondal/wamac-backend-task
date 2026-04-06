import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { PrismaClient } from "../prisma/generated/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import axios from "axios";
import client from "prom-client";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
if (process.env.NODE_ENV !== "test") {
  require("../../../tracing");
}

export const app = express();
const pool = new Pool({ connectionString: process.env.PAYROLL_DB_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

app.use(cors());
app.use(express.json());

// Metrics
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

const connection = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
  },
);

const payrollQueue = new Queue("payrollQueue", { connection });

app.post("/payroll/bulk", async (req, res) => {
  const { employerId, disbursements, currency } = req.body;
  // disbursements: Array<{ employeeId, amount }>

  if (!disbursements || disbursements.length === 0) {
    return res.status(400).json({ error: "No disbursements provided" });
  }

  const totalAmount = disbursements.reduce(
    (sum: number, d: any) => sum + d.amount,
    0,
  );

  const jobRecord = await prisma.payrollJob.create({
    data: {
      employerId,
      totalAmount,
      currency,
      totalCount: disbursements.length,
      status: "PENDING",
    },
  });

  // We add the job to the queue. Problem 2: Bulk Payroll.
  // To ensure concurrency=1 per employer, we rely on the Worker setup grouping,
  // or just pass `employerId` to allow custom locking inside the worker.
  // In BullMQ Pro there are 'Groups'. In OSS, we can use a worker concurrency of 1,
  // or create a distinct queue per employer, which guarantees 1 per employer.
  // For simplicity, we just add to the default queue.
  // To properly simulate 1-per-employer in free BullMQ without pro groups,
  // we instantiate the worker with concurrency: 1, meaning the worker itself only does 1 at a time.

  await payrollQueue.add(
    "processPayroll",
    {
      jobId: jobRecord.id,
      employerId,
      disbursements,
      currency,
    },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    },
  );

  res
    .status(202)
    .json({ message: "Payroll queued successfully", jobId: jobRecord.id });
});

// Worker to process the queue.
// "concurrency: 1" prevents race conditions against the employer balance.
const payrollWorker = new Worker(
  "payrollQueue",
  async (job) => {
    const { jobId, employerId, disbursements, currency } = job.data;

    await prisma.payrollJob.update({
      where: { id: jobId },
      data: { status: "PROCESSING" },
    });

    let processedIdx = 0;

    for (const d of disbursements) {
      // Here we could simulate resuming by looking up processedIdx if we track per-row completion,
      // but since we process one by one, we'll try to orchestrate with Transaction Service using idempotent keys.

      try {
        // Problem 2 checkpoint resumability: Generate unique idempotency key per employee transfer
        const ixKey = `payroll-${jobId}-${d.employeeId}`;

        await axios.post(
          `${process.env.TRANSACTION_SERVICE_URL}/transfers/international`,
          {
            idempotencyKey: ixKey,
            senderId: employerId,
            receiverId: d.employeeId,
            amount: d.amount,
            fromCurrency: currency,
            toCurrency: currency, // Local transfer
          },
        );

        processedIdx++;
        await prisma.payrollJob.update({
          where: { id: jobId },
          data: { processedCount: processedIdx },
        });
      } catch (err: any) {
        console.error(
          `Payroll sub-transaction failed for ${d.employeeId}`,
          err.message,
        );
        // Since we use idempotency keys, a retry of this whole BullMQ job will safely
        // bypass already processed ones.
        throw new Error(`Failed to process disbursement for ${d.employeeId}`);
      }
    }

    await prisma.payrollJob.update({
      where: { id: jobId },
      data: { status: "COMPLETED" },
    });
  },
  { connection, concurrency: 1 },
);

const port = process.env.PAYROLL_PORT || 3005;
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () =>
    console.log("Payroll-service listening on port " + port),
  );
}
