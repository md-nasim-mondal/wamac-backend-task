import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const config = {
  port: process.env.PAYROLL_PORT || 3005,
  dbUrl: process.env.PAYROLL_DB_URL,
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  transactionServiceUrl: process.env.TRANSACTION_SERVICE_URL,
};
