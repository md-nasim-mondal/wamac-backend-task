import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const config = {
  port: process.env.LEDGER_PORT || 3003,
  dbUrl: process.env.LEDGER_DB_URL,
};
