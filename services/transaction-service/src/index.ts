import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "../prisma/generated/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import client from "prom-client";
import crypto from "crypto";
import axios from "axios";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
if (process.env.NODE_ENV !== "test") {
  require("../../../tracing");
}

export const app = express();
const pool = new Pool({ connectionString: process.env.TRANSACTION_DB_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  res.locals.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
});

// Metrics
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

const failedTxMetric = new client.Counter({
  name: "failed_transactions_total",
  help: "Total number of failed transactions",
});
const txThroughput = new client.Counter({
  name: "transactions_total",
  help: "Total number of transactions",
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

function hashPayload(payload: any) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

app.post("/transfers/international", async (req, res) => {
  txThroughput.inc();
  const requestId = res.locals.requestId;
  const {
    idempotencyKey,
    senderId,
    receiverId,
    amount,
    fromCurrency,
    toCurrency,
    fxQuoteId,
  } = req.body;

  if (!idempotencyKey) {
    failedTxMetric.inc();
    return res
      .status(400)
      .json({ error: "Idempotency key required", requestId });
  }

  const payloadHash = hashPayload({
    senderId,
    receiverId,
    amount,
    fromCurrency,
    toCurrency,
    fxQuoteId,
  });
  let lockedRate: number | null = null;

  try {
    if (fxQuoteId) {
      const quote = await axios.get(
        `${process.env.FX_SERVICE_URL}/fx/quote/${fxQuoteId}`,
      );
      lockedRate = quote.data.rate;
    }

    const newTx = await prisma.transaction.create({
      data: {
        idempotencyKey,
        payloadHash,
        senderId,
        receiverId,
        amount,
        currency: fromCurrency,
        fxQuoteId,
        status: "PENDING",
      },
    });

    if (fxQuoteId) {
      try {
        await axios.post(
          `${process.env.FX_SERVICE_URL}/fx/quote/${fxQuoteId}/use`,
        );
      } catch (err: any) {
        await prisma.transaction.update({
          where: { id: newTx.id },
          data: { status: "FAILED" },
        });
        failedTxMetric.inc();
        return res
          .status(400)
          .json({ error: "FX Quote expired or already used", requestId });
      }
    }

    const accountRes = await axios.get(
      `${process.env.ACCOUNT_SERVICE_URL}/accounts/${senderId}/balance`,
    );
    const { balance } = accountRes.data;

    if (balance < amount) {
      await prisma.transaction.update({
        where: { id: newTx.id },
        data: { status: "FAILED" },
      });
      failedTxMetric.inc();
      return res.status(400).json({ error: "Insufficient balance", requestId });
    }

    const debitAmount = amount;
    let creditAmount = amount;
    if (fxQuoteId && lockedRate !== null) {
      creditAmount = Number((amount * lockedRate).toFixed(6));
    }

    const entries = [
      {
        accountId: senderId,
        debitAmount,
        creditAmount: 0,
        currency: fromCurrency,
        fxQuoteId,
        fxRate: lockedRate,
      },
      {
        accountId: receiverId,
        debitAmount: 0,
        creditAmount,
        currency: toCurrency,
        fxQuoteId,
        fxRate: lockedRate,
      },
    ];

    try {
      await axios.post(`${process.env.LEDGER_SERVICE_URL}/ledger/entries`, {
        transactionId: newTx.id,
        entries,
      });

      const debitAdjustmentId = `${newTx.id}-debit`;
      const creditAdjustmentId = `${newTx.id}-credit`;

      await axios.post(
        `${process.env.ACCOUNT_SERVICE_URL}/accounts/${senderId}/adjust`,
        {
          amount: -debitAmount,
          adjustmentId: debitAdjustmentId,
        },
      );
      await axios.post(
        `${process.env.ACCOUNT_SERVICE_URL}/accounts/${receiverId}/adjust`,
        {
          amount: creditAmount,
          adjustmentId: creditAdjustmentId,
        },
      );

      await prisma.transaction.update({
        where: { id: newTx.id },
        data: { status: "COMPLETED" },
      });
      return res.json({ id: newTx.id, status: "COMPLETED", requestId });
    } catch (executionErr: any) {
      console.error("Transaction execution failed", executionErr);
      failedTxMetric.inc();
      return res.status(500).json({
        error: "Transaction could not be completed, recovery may be required",
        requestId,
      });
    }
  } catch (dbErr: any) {
    if (dbErr.code === "P2002") {
      const existingTx = await prisma.transaction.findUnique({
        where: { idempotencyKey },
      });
      if (!existingTx)
        return res
          .status(500)
          .json({ error: "Concurrency conflict, please retry", requestId });

      const ageMs = Date.now() - existingTx.createdAt.getTime();
      if (ageMs > 24 * 60 * 60 * 1000) {
        failedTxMetric.inc();
        return res.status(400).json({
          error: "Idempotency key expired after 24h. Use a new key.",
          requestId,
        });
      }

      if (existingTx.payloadHash !== payloadHash) {
        failedTxMetric.inc();
        return res.status(400).json({
          error: "Idempotency key exists but payload changed",
          requestId,
        });
      }

      return res.json({
        id: existingTx.id,
        status: existingTx.status,
        message: "Duplicate request ignored",
        requestId,
      });
    }
    console.error(dbErr);
    failedTxMetric.inc();
    return res.status(500).json({ error: "Internal error", requestId });
  }
});

app.post("/transfers/recover/:id", async (req, res) => {
  const requestId = res.locals.requestId;
  const txRecord = await prisma.transaction.findUnique({
    where: { id: req.params.id },
  });
  if (!txRecord) {
    return res.status(404).json({ error: "Transaction not found", requestId });
  }
  if (txRecord.status === "COMPLETED") {
    return res.json({ id: txRecord.id, status: txRecord.status, requestId });
  }

  try {
    const ledgerRes = await axios.get(
      `${process.env.LEDGER_SERVICE_URL}/ledger/transaction/${txRecord.id}`,
    );
    const entries = ledgerRes.data.entries;
    if (!entries || entries.length === 0) {
      return res
        .status(404)
        .json({ error: "No ledger entries found for transaction", requestId });
    }

    const debitAdjustmentId = `${txRecord.id}-debit`;
    const creditAdjustmentId = `${txRecord.id}-credit`;
    const debitEntry = entries.find((e: any) => Number(e.debitAmount) > 0);
    const creditEntry = entries.find((e: any) => Number(e.creditAmount) > 0);

    if (!debitEntry || !creditEntry) {
      return res
        .status(400)
        .json({ error: "Ledger entries invalid for recovery", requestId });
    }

    await axios.post(
      `${process.env.ACCOUNT_SERVICE_URL}/accounts/${debitEntry.accountId}/adjust`,
      {
        amount: -Number(debitEntry.debitAmount),
        adjustmentId: debitAdjustmentId,
      },
    );
    await axios.post(
      `${process.env.ACCOUNT_SERVICE_URL}/accounts/${creditEntry.accountId}/adjust`,
      {
        amount: Number(creditEntry.creditAmount),
        adjustmentId: creditAdjustmentId,
      },
    );

    await prisma.transaction.update({
      where: { id: txRecord.id },
      data: { status: "COMPLETED" },
    });
    return res.json({ id: txRecord.id, status: "COMPLETED", requestId });
  } catch (err: any) {
    console.error("Recovery failed", err);
    return res.status(500).json({ error: "Recovery failed", requestId });
  }
});

const port = process.env.TRANSACTION_PORT || 3002;
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () =>
    console.log("Transaction-service listening on port " + port),
  );
}
