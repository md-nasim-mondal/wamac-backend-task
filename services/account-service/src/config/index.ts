import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const MASTER_KEY = process.env.MASTER_KEY || "0123456789abcdef0123456789abcdef";
if (MASTER_KEY.length !== 32) {
  throw new Error(
    "MASTER_KEY must be 32 bytes for AES-256 envelope encryption",
  );
}

export const config = {
  port: process.env.ACCOUNT_PORT || 3001,
  masterKey: Buffer.from(MASTER_KEY, "utf8"),
  dbUrl: process.env.ACCOUNT_DB_URL,
};
