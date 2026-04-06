import express from "express";
import cors from "cors";
import client from "prom-client";
import routes from "./app/routes";

const app = express();

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

app.use("/", routes);

export default app;
