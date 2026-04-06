import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import crypto from "crypto";
import client from "prom-client";
import routes from "./app/routes";

const app = express();

app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  res.locals.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
});

app.use(cors());
app.use(express.json());

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

app.use("/", routes);

const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  console.error(err);
  res.status(status).json({ error: message });
};

const notFound = (req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
};

app.use(globalErrorHandler);
app.use(notFound);

export default app;
