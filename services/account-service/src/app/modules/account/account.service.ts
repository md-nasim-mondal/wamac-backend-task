import crypto from "crypto";
import prisma from "../../../shared/prisma";
import { encryptText } from "../../utils/encryption";
import {
  ICreateAccount,
  IAdjustBalance,
} from "./account.interface";

const getAccountBalance = async (id: string) => {
  const account = await prisma.wallet.findUnique({
    where: { id },
  });
  if (!account) throw new Error("Account not found");
  return { balance: account.balance, currency: account.currencyCode };
};

const createAccount = async (data: ICreateAccount) => {
  const { userId, currencyCode, initialBalance, ownerName } = data;
  const encrypted = ownerName ? encryptText(ownerName) : null;

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
  return account;
};

const adjustBalance = async (id: string, data: IAdjustBalance) => {
  const { amount, adjustmentId } = data;

  const result = await prisma.$transaction(async (tx) => {
    const inserted = await tx.$queryRaw<Array<{ adjustment_key: string }>>`
      INSERT INTO account_adjustment (id, wallet_id, amount, adjustment_key, created_at)
      VALUES (${crypto.randomUUID()}, ${id}, ${amount}, ${adjustmentId}, now())
      ON CONFLICT (adjustment_key) DO NOTHING
      RETURNING adjustment_key
    `;

    if (inserted.length === 0) {
      return tx.wallet.findUnique({ where: { id } });
    }

    return tx.wallet.update({
      where: { id },
      data: {
        balance: {
          increment: amount,
        },
      },
    });
  });

  if (!result)
    throw new Error("Account not found or adjustment already processed");
  return result;
};

const getAccountSecret = async (id: string) => {
  const account = await prisma.wallet.findUnique({
    where: { id },
  });
  if (!account) throw new Error("Account not found");

  if (
    !account.ownerNameEncrypted ||
    !account.ownerNameIv ||
    !account.ownerNameAuthTag ||
    !account.ownerNameKey ||
    !account.ownerNameKeyIv ||
    !account.ownerNameKeyAuthTag
  ) {
    throw new Error("Sensitive data not available");
  }

  const { decryptText } = await import("../../utils/encryption");
  const ownerName = decryptText({
    ciphertext: account.ownerNameEncrypted,
    iv: account.ownerNameIv,
    authTag: account.ownerNameAuthTag,
    wrappedKey: account.ownerNameKey,
    keyIv: account.ownerNameKeyIv,
    keyAuthTag: account.ownerNameKeyAuthTag,
  });

  return { ownerName };
};

export const AccountService = {
  getAccountBalance,
  createAccount,
  adjustBalance,
  getAccountSecret,
};
