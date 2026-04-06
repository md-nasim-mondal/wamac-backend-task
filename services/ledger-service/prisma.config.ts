import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.LEDGER_DB_URL,
  },
});
