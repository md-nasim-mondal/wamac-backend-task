import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { PrismaClient } from "../prisma/generated/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import client from "prom-client";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
if (process.env.NODE_ENV !== "test") {
  require("../../../tracing");
}

export const app = express();
const pool = new Pool({ connectionString: process.env.FX_DB_URL });
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

app.post("/fx/quote", async (req, res) => {
  const { fromCurrency, toCurrency } = req.body;

  // Simulate fetching from a provider
  const simulatedRate =
    fromCurrency === "USD" && toCurrency === "EUR" ? 0.92 : 1.1;

  // Create quote with 60s TTL
  const expiresAt = new Date(Date.now() + 60 * 1000);

  try {
    const quote = await prisma.fxQuote.create({
      data: {
        fromCurrency,
        toCurrency,
        rate: simulatedRate,
        expiresAt,
      },
    });
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate FX quote" });
  }
});

app.get("/fx/quote/:id", async (req, res) => {
  try {
    const quote = await prisma.fxQuote.findUnique({
      where: { id: req.params.id },
    });
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    const now = new Date();
    const expired = now > quote.expiresAt;
    if (expired) {
      return res.status(400).json({ error: "Quote expired", expired: true });
    }
    const timeRemainingMs = Math.max(
      0,
      quote.expiresAt.getTime() - now.getTime(),
    );
    res.json({ ...quote, timeRemainingMs });
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve quote" });
  }
});

app.post("/fx/quote/:id/use", async (req, res) => {
  try {
    const result = await prisma.fxQuote.updateMany({
      where: {
        id: req.params.id,
        status: "UNUSED",
        expiresAt: { gt: new Date() },
      },
      data: { status: "USED" },
    });

    if (result.count === 0) {
      return res
        .status(400)
        .json({ error: "Quote already used, expired, or not found" });
    }

    const quote = await prisma.fxQuote.findUnique({
      where: { id: req.params.id },
    });
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: "Failed to redeem quote" });
  }
});

const port = process.env.FX_PORT || 3004;
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => console.log("Fx-service listening on port " + port));
}
