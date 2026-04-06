import { Request, Response } from "express";
import { TransactionService } from "./transaction.service";
import { hashPayload } from "../../utils/hash";
import prisma from "../../../shared/prisma";
import catchAsync from "../../../shared/catchAsync";

const createInternationalTransfer = catchAsync(
  async (req: Request, res: Response) => {
    const requestId = res.locals.requestId;
    const data = req.body;

    if (!data.idempotencyKey) {
      return res
        .status(400)
        .json({ error: "Idempotency key required", requestId });
    }

    const payloadHash = hashPayload({
      senderId: data.senderId,
      receiverId: data.receiverId,
      amount: data.amount,
      fromCurrency: data.fromCurrency,
      toCurrency: data.toCurrency,
      fxQuoteId: data.fxQuoteId,
    });

    try {
      const result = await TransactionService.createInternationalTransfer(data);
      return res.json({ id: result.id, status: "COMPLETED", requestId });
    } catch (dbErr: any) {
      if (dbErr.code === "P2002") {
        const existingTx = await prisma.transaction.findUnique({
          where: { idempotencyKey: data.idempotencyKey },
        });
        if (!existingTx)
          return res
            .status(500)
            .json({ error: "Concurrency conflict, please retry", requestId });

        const ageMs = Date.now() - existingTx.createdAt.getTime();
        if (ageMs > 24 * 60 * 60 * 1000) {
          return res.status(400).json({
            error: "Idempotency key expired after 24h. Use a new key.",
            requestId,
          });
        }

        if (existingTx.payloadHash !== payloadHash) {
          return res.status(400).json({
            error: "Idempotency key exists but payload changed",
            requestId,
          });
        }

        return res.json({
          id: existingTx.id,
          status: existingTx.status,
          message: "Duplicate request ignored",
          requestId,
        });
      }
      return res.status(500).json({ error: "Internal error", requestId });
    }
  },
);

const recoverTransaction = catchAsync(async (req: Request, res: Response) => {
  const requestId = res.locals.requestId;
  const result = await TransactionService.recoverTransaction(req.params.id);
  res.json({ id: result.id, status: result.status, requestId });
});

export const TransactionController = {
  createInternationalTransfer,
  recoverTransaction,
};
