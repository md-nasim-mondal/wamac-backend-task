import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { PrismaClient } from "../prisma/generated/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import client from "prom-client";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const app = express();
const pool = new Pool({ connectionString: process.env.LEDGER_DB_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

app.use(cors());
app.use(express.json());

// Metrics
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

// Alert Metric for Invariant violation
const ledgerInvariantViolations = new client.Counter({
  name: "ledger_invariant_violations_total",
  help: "Total number of ledger invariant violations detected",
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

app.post("/ledger/entries", async (req, res) => {
  // Array of { accountId, debitAmount, creditAmount, currency, fxQuoteId, fxRate }
  const { transactionId, entries } = req.body;

  if (!entries || entries.length < 2) {
    return res.status(400).json({
      error: "At least two entries are required for double-entry bookkeeping",
    });
  }

  // Invariant Check
  let totalDebit = 0;
  let totalCredit = 0;
  for (const entry of entries) {
    totalDebit += parseFloat(entry.debitAmount || 0);
    totalCredit += parseFloat(entry.creditAmount || 0);
  }

  // Floating point precision handling
  if (Math.abs(totalDebit - totalCredit) > 0.0001) {
    ledgerInvariantViolations.inc();
    return res.status(400).json({
      error: "Ledger invariant violation: Total Debit must equal Total Credit",
    });
  }

  try {
    await prisma.$transaction(
      entries.map((entry: any) =>
        prisma.ledgerEntry.create({
          data: {
            transactionId,
            accountId: entry.accountId,
            debitAmount: entry.debitAmount || 0,
            creditAmount: entry.creditAmount || 0,
            currency: entry.currency,
            fxQuoteId: entry.fxQuoteId || null,
            fxRate: entry.fxRate || null,
          },
        }),
      ),
    );
    res.status(201).json({ message: "Ledger entries recorded successfully" });
  } catch (err) {
    console.error("Ledger insertion failed", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/ledger/transaction/:transactionId", async (req, res) => {
  try {
    const entries = await prisma.ledgerEntry.findMany({
      where: { transactionId: req.params.transactionId },
      orderBy: { createdAt: "asc" },
    });
    if (!entries || entries.length === 0) {
      return res.status(404).json({ error: "Ledger transaction not found" });
    }
    res.json({ entries });
  } catch (err) {
    console.error("Failed to query ledger transaction", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const port = process.env.LEDGER_PORT || 3003;
app.listen(port, () => console.log("Ledger-service listening on port " + port));
