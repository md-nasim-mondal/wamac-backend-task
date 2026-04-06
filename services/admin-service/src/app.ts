import express from "express";
import cors from "cors";
import client from "prom-client";
import routes from "./app/routes";

const app = express();

app.use(cors());
app.use(express.json());

const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

app.use("/", routes);

export default app;
