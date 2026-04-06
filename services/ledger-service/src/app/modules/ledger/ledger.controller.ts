import { Request, Response } from "express";
import { LedgerService } from "./ledger.service";
import catchAsync from "../../../shared/catchAsync";

const createLedgerEntries = catchAsync(async (req: Request, res: Response) => {
  await LedgerService.createLedgerEntries(req.body);
  res.status(201).json({ message: "Ledger entries recorded successfully" });
});

const getTransactionLedger = catchAsync(async (req: Request, res: Response) => {
  const result = await LedgerService.getTransactionLedger(
    req.params.transactionId,
  );
  res.json(result);
});

const verifyAuditChain = catchAsync(async (req: Request, res: Response) => {
  const result = await LedgerService.verifyAuditChain();
  res.json(result);
});

export const LedgerController = {
  createLedgerEntries,
  getTransactionLedger,
  verifyAuditChain,
};
