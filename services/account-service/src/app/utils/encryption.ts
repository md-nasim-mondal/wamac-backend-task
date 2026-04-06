import crypto from "crypto";
import { config } from "../../config";

export function encryptText(plaintext: string) {
  const dataKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dataKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const keyIv = crypto.randomBytes(12);
  const keyCipher = crypto.createCipheriv(
    "aes-256-gcm",
    config.masterKey,
    keyIv,
  );
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

export function decryptText(payload: {
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
  const keyDecipher = crypto.createDecipheriv(
    "aes-256-gcm",
    config.masterKey,
    keyIv,
  );
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
