import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const config = {
  port: process.env.FX_PORT || 3004,
  dbUrl: process.env.FX_DB_URL,
};
