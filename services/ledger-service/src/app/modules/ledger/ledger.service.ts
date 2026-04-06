import prisma from "../../../shared/prisma";
import { ICreateLedgerEntries } from "./ledger.interface";
import crypto from "crypto";

const createLedgerEntries = async (data: ICreateLedgerEntries) => {
  const { transactionId, entries } = data;

  if (!entries || entries.length < 2) {
    throw new Error(
      "At least two entries are required for double-entry bookkeeping",
    );
  }

  // Invariant Check
  let totalDebit = 0;
  let totalCredit = 0;
  for (const entry of entries) {
    totalDebit += parseFloat(entry.debitAmount?.toString() || "0");
    totalCredit += parseFloat(entry.creditAmount?.toString() || "0");
  }

  // Floating point precision handling
  if (Math.abs(totalDebit - totalCredit) > 0.0001) {
    throw new Error(
      "Ledger invariant violation: Total Debit must equal Total Credit",
    );
  }

  // Get the last audit hash for chaining
  const lastEntry = await prisma.ledgerEntry.findFirst({
    orderBy: { createdAt: "desc" },
  });
  let previousHash = lastEntry?.auditHash || "genesis";

  const entriesWithHashes = [];
  for (const entry of entries) {
    const entryData = JSON.stringify({
      transactionId,
      accountId: entry.accountId,
      debitAmount: entry.debitAmount || 0,
      creditAmount: entry.creditAmount || 0,
      currency: entry.currency,
      fxQuoteId: entry.fxQuoteId || null,
      fxRate: entry.fxRate || null,
    });
    const chainInput = previousHash + entryData;
    const auditHash = crypto
      .createHash("sha256")
      .update(chainInput)
      .digest("hex");
    previousHash = auditHash; // Update for next entry

    entriesWithHashes.push({
      ...entry,
      auditHash,
    });
  }

  await prisma.$transaction(
    entriesWithHashes.map((entry: any) =>
      prisma.ledgerEntry.create({
        data: {
          transactionId,
          accountId: entry.accountId,
          debitAmount: entry.debitAmount || 0,
          creditAmount: entry.creditAmount || 0,
          currency: entry.currency,
          fxQuoteId: entry.fxQuoteId || null,
          fxRate: entry.fxRate || null,
          auditHash: entry.auditHash,
        },
      }),
    ),
  );
};

const getTransactionLedger = async (transactionId: string) => {
  const entries = await prisma.ledgerEntry.findMany({
    where: { transactionId },
    orderBy: { createdAt: "asc" },
  });
  if (!entries || entries.length === 0) {
    throw new Error("Ledger transaction not found");
  }
  return { entries };
};

const verifyAuditChain = async () => {
  const allEntries = await prisma.ledgerEntry.findMany({
    orderBy: { createdAt: "asc" },
  });

  let previousHash = "genesis";
  let tampered = false;
  const issues = [];

  for (const entry of allEntries) {
    const entryData = JSON.stringify({
      transactionId: entry.transactionId,
      accountId: entry.accountId,
      debitAmount: Number(entry.debitAmount),
      creditAmount: Number(entry.creditAmount),
      currency: entry.currency,
      fxQuoteId: entry.fxQuoteId,
      fxRate: entry.fxRate ? Number(entry.fxRate) : null,
    });
    const expectedHash = crypto
      .createHash("sha256")
      .update(previousHash + entryData)
      .digest("hex");

    if (expectedHash !== entry.auditHash) {
      tampered = true;
      issues.push({
        id: entry.id,
        expected: expectedHash,
        actual: entry.auditHash,
      });
    }
    previousHash = entry.auditHash;
  }

  return {
    totalEntries: allEntries.length,
    chainValid: !tampered,
    issues,
  };
};

export const LedgerService = {
  createLedgerEntries,
  getTransactionLedger,
  verifyAuditChain,
};
