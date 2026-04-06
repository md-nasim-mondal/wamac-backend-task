import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const config = {
  port: process.env.TRANSACTION_PORT || 3002,
  dbUrl: process.env.TRANSACTION_DB_URL,
  fxServiceUrl: process.env.FX_SERVICE_URL,
  accountServiceUrl: process.env.ACCOUNT_SERVICE_URL,
  ledgerServiceUrl: process.env.LEDGER_SERVICE_URL,
};
