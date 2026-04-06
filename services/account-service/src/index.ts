import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import crypto from "crypto";
import { PrismaClient } from "../prisma/generated/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import client from "prom-client";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
if (process.env.NODE_ENV !== "test") {
  require("../../../tracing");
}

export const app = express();
const pool = new Pool({ connectionString: process.env.ACCOUNT_DB_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const MASTER_KEY = process.env.MASTER_KEY || "";
if (MASTER_KEY.length !== 32) {
  throw new Error(
    "MASTER_KEY must be 32 bytes for AES-256 envelope encryption",
  );
}
const masterKey = Buffer.from(MASTER_KEY, "utf8");

function encryptText(plaintext: string) {
  const dataKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dataKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const keyIv = crypto.randomBytes(12);
  const keyCipher = crypto.createCipheriv("aes-256-gcm", masterKey, keyIv);
  const wrappedKey = Buffer.concat([
    keyCipher.update(dataKey),
    keyCipher.final(),
  ]);
  const keyAuthTag = keyCipher.getAuthTag();

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    wrappedKey: wrappedKey.toString("base64"),
    keyIv: keyIv.toString("base64"),
    keyAuthTag: keyAuthTag.toString("base64"),
  };
}

function decryptText(payload: {
  ciphertext: string;
  iv: string;
  authTag: string;
  wrappedKey: string;
  keyIv: string;
  keyAuthTag: string;
}) {
  const keyIv = Buffer.from(payload.keyIv, "base64");
  const keyAuthTag = Buffer.from(payload.keyAuthTag, "base64");
  const wrappedKey = Buffer.from(payload.wrappedKey, "base64");
  const keyDecipher = crypto.createDecipheriv("aes-256-gcm", masterKey, keyIv);
  keyDecipher.setAuthTag(keyAuthTag);
  const dataKey = Buffer.concat([
    keyDecipher.update(wrappedKey),
    keyDecipher.final(),
  ]);

  const iv = Buffer.from(payload.iv, "base64");
  const authTag = Buffer.from(payload.authTag, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", dataKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  res.locals.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
});

function log(
  message: string,
  context: Record<string, any> = {},
  requestId?: string,
) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId: requestId || null,
      ...context,
      message,
    }),
  );
}

app.use(cors());
app.use(express.json());

// Metrics
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

app.get("/accounts/:id/balance", async (req, res) => {
  const account = (await prisma.wallet.findUnique({
    where: { id: req.params.id },
  })) as any;
  if (!account) return res.status(404).json({ error: "Account not found" });
  res.json({ balance: account.balance, currency: account.currencyCode });
});

// For admin/setup
app.post("/accounts", async (req, res) => {
  const { userId, currencyCode, initialBalance, ownerName } = req.body;
  const encrypted = ownerName ? encryptText(ownerName) : null;

  try {
    const account = await prisma.wallet.create({
      data: {
        userId,
        currencyCode,
        balance: initialBalance || 0,
        ownerNameEncrypted: encrypted?.ciphertext ?? null,
        ownerNameIv: encrypted?.iv ?? null,
        ownerNameAuthTag: encrypted?.authTag ?? null,
        ownerNameKey: encrypted?.wrappedKey ?? null,
        ownerNameKeyIv: encrypted?.keyIv ?? null,
        ownerNameKeyAuthTag: encrypted?.keyAuthTag ?? null,
      } as any,
    });
    res.json({
      id: account.id,
      currencyCode: account.currencyCode,
      balance: account.balance,
      createdAt: account.createdAt,
      requestId: res.locals.requestId,
    });
  } catch (createError: any) {
    res.status(500).json({ error: "Failed to create account" });
  }
});

app.post("/accounts/:id/adjust", async (req, res) => {
  const { amount, adjustmentId } = req.body;
  if (typeof amount !== "number" || !adjustmentId) {
    return res
      .status(400)
      .json({ error: "amount and adjustmentId are required" });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const inserted = await tx.$queryRaw<Array<{ adjustment_key: string }>>`
        INSERT INTO account_adjustment (id, wallet_id, amount, adjustment_key, created_at)
        VALUES (${crypto.randomUUID()}, ${req.params.id}, ${amount}, ${adjustmentId}, now())
        ON CONFLICT (adjustment_key) DO NOTHING
        RETURNING adjustment_key
      `;

      if (inserted.length === 0) {
        return tx.wallet.findUnique({ where: { id: req.params.id } });
      }

      return tx.wallet.update({
        where: { id: req.params.id },
        data: {
          balance: {
            increment: amount,
          },
        },
      });
    });

    if (!result) {
      return res
        .status(404)
        .json({ error: "Account not found or adjustment already processed" });
    }

    res.json({ balance: result.balance, requestId: res.locals.requestId });
  } catch (err: any) {
    res.status(500).json({ error: "Adjustment failed" });
  }
});

app.get("/accounts/:id/secret", async (req, res) => {
  const account = (await prisma.wallet.findUnique({
    where: { id: req.params.id },
  })) as any;
  if (!account) return res.status(404).json({ error: "Account not found" });
  if (!req.query.owner || req.query.owner !== "true") {
    return res.status(403).json({ error: "Access denied" });
  }

  if (
    !account.ownerNameEncrypted ||
    !account.ownerNameIv ||
    !account.ownerNameAuthTag ||
    !account.ownerNameKey ||
    !account.ownerNameKeyIv ||
    !account.ownerNameKeyAuthTag
  ) {
    return res.status(404).json({ error: "Sensitive data not available" });
  }

  const ownerName = decryptText({
    ciphertext: account.ownerNameEncrypted,
    iv: account.ownerNameIv,
    authTag: account.ownerNameAuthTag,
    wrappedKey: account.ownerNameKey,
    keyIv: account.ownerNameKeyIv,
    keyAuthTag: account.ownerNameKeyAuthTag,
  });

  res.json({ ownerName, requestId: res.locals.requestId });
});

const port = process.env.ACCOUNT_PORT || 3001;
if (process.env.NODE_ENV !== "test") {
  app.listen(port, () =>
    console.log("Account-service listening on port " + port),
  );
}
