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

// Global error handler middleware
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const status = err.status || 500;
    const message = err.message || "Internal Server Error";

    // Check for specific error messages to determine status code
    if (message.includes("required for double-entry bookkeeping")) {
      return res.status(400).json({ error: message });
    }

    if (
      message.includes("Ledger invariant violation") ||
      message.includes("not found")
    ) {
      return res.status(400).json({ error: message });
    }

    res.status(status).json({ error: message });
  },
);

const notFound = (req: express.Request, res: express.Response) => {
  res.status(404).json({ error: "Route not found" });
};

app.use(notFound);

export default app;
