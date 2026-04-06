import prisma from "../../../shared/prisma";
import { config } from "../../../config";
import { hashPayload } from "../../utils/hash";
import { IInternationalTransfer } from "./transaction.interface";
import axios from "axios";

const createInternationalTransfer = async (data: IInternationalTransfer) => {
  const {
    idempotencyKey,
    senderId,
    receiverId,
    amount,
    fromCurrency,
    toCurrency,
    fxQuoteId,
  } = data;

  const payloadHash = hashPayload({
    senderId,
    receiverId,
    amount,
    fromCurrency,
    toCurrency,
    fxQuoteId,
  });

  let lockedRate: number | null = null;

  if (fxQuoteId) {
    const quote = await axios.get(
      `${config.fxServiceUrl}/fx/quote/${fxQuoteId}`,
    );
    lockedRate = quote.data.rate;
  }

  const newTx = await prisma.transaction.create({
    data: {
      idempotencyKey,
      payloadHash,
      senderId,
      receiverId,
      amount,
      currency: fromCurrency,
      fxQuoteId,
      status: "PENDING",
    },
  });

  if (fxQuoteId) {
    try {
      await axios.post(`${config.fxServiceUrl}/fx/quote/${fxQuoteId}/use`);
    } catch (err: any) {
      await prisma.transaction.update({
        where: { id: newTx.id },
        data: { status: "FAILED" },
      });
      throw new Error("FX Quote expired or already used");
    }
  }

  const accountRes = await axios.get(
    `${config.accountServiceUrl}/accounts/${senderId}/balance`,
  );
  const { balance } = accountRes.data;

  if (balance < amount) {
    await prisma.transaction.update({
      where: { id: newTx.id },
      data: { status: "FAILED" },
    });
    throw new Error("Insufficient balance");
  }

  const debitAmount = amount;
  let creditAmount = amount;
  if (fxQuoteId && lockedRate !== null) {
    creditAmount = Number((amount * lockedRate).toFixed(6));
  }

  const entries = [
    {
      accountId: senderId,
      debitAmount,
      creditAmount: 0,
      currency: fromCurrency,
      fxQuoteId,
      fxRate: lockedRate,
    },
    {
      accountId: receiverId,
      debitAmount: 0,
      creditAmount,
      currency: toCurrency,
      fxQuoteId,
      fxRate: lockedRate,
    },
  ];

  try {
    await axios.post(`${config.ledgerServiceUrl}/ledger/entries`, {
      transactionId: newTx.id,
      entries,
    });

    const debitAdjustmentId = `${newTx.id}-debit`;
    const creditAdjustmentId = `${newTx.id}-credit`;

    await axios.post(
      `${config.accountServiceUrl}/accounts/${senderId}/adjust`,
      {
        amount: -debitAmount,
        adjustmentId: debitAdjustmentId,
      },
    );
    await axios.post(
      `${config.accountServiceUrl}/accounts/${receiverId}/adjust`,
      {
        amount: creditAmount,
        adjustmentId: creditAdjustmentId,
      },
    );

    await prisma.transaction.update({
      where: { id: newTx.id },
      data: { status: "COMPLETED" },
    });
    return newTx;
  } catch (executionErr: any) {
    throw new Error(
      "Transaction could not be completed, recovery may be required",
    );
  }
};

const recoverTransaction = async (id: string) => {
  const txRecord = await prisma.transaction.findUnique({
    where: { id },
  });
  if (!txRecord) throw new Error("Transaction not found");
  if (txRecord.status === "COMPLETED") return txRecord;

  const ledgerRes = await axios.get(
    `${config.ledgerServiceUrl}/ledger/transaction/${txRecord.id}`,
  );
  const entries = ledgerRes.data.entries;
  if (!entries || entries.length === 0)
    throw new Error("No ledger entries found for transaction");

  const debitEntry = entries.find((e: any) => Number(e.debitAmount) > 0);
  const creditEntry = entries.find((e: any) => Number(e.creditAmount) > 0);

  if (!debitEntry || !creditEntry)
    throw new Error("Ledger entries invalid for recovery");

  await axios.post(
    `${config.accountServiceUrl}/accounts/${debitEntry.accountId}/adjust`,
    {
      amount: -Number(debitEntry.debitAmount),
      adjustmentId: `${txRecord.id}-debit`,
    },
  );
  await axios.post(
    `${config.accountServiceUrl}/accounts/${creditEntry.accountId}/adjust`,
    {
      amount: Number(creditEntry.creditAmount),
      adjustmentId: `${txRecord.id}-credit`,
    },
  );

  await prisma.transaction.update({
    where: { id: txRecord.id },
    data: { status: "COMPLETED" },
  });
  return txRecord;
};

export const TransactionService = {
  createInternationalTransfer,
  recoverTransaction,
};
