import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import client from "prom-client";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const app = express();
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

const port = process.env.ADMIN_PORT || 3006;
app.listen(port, () => console.log("Admin-service listening on port " + port));
