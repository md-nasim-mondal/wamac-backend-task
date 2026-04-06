import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import client from "prom-client";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
if (process.env.NODE_ENV !== "test") {
  require("../../../tracing");
}

export const app = express();
app.use(cors());
app.use(express.json());

// Metrics
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

app.get("/health", (req, res) => res.send("Admin OK"));

app.get("/admin/transactions/recent", async (req, res) => {
  // In real implementation, would query transaction service or shared audit DB
  res.json({ transactions: [] });
});

app.get("/admin/ledger/audit", async (req, res) => {
  // In real implementation, would call ledger service audit endpoint
  res.json({ chainValid: true, issues: [] });
});

app.post("/admin/system/shutdown", (req, res) => {
  // Graceful shutdown logic
  res.json({ message: "Shutdown initiated" });
  process.exit(0);
});

const port = process.env.ADMIN_PORT || 3006;
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () =>
    console.log("Admin-service listening on port " + port),
  );
}
