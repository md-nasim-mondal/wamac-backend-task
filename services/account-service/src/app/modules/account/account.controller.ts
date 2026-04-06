import { Request, Response } from "express";
import { AccountService } from "./account.service";
import catchAsync from "../../../shared/catchAsync";

const getAccountBalance = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await AccountService.getAccountBalance(id);
  res.json(result);
});

const createAccount = catchAsync(async (req: Request, res: Response) => {
  const result = await AccountService.createAccount(req.body);
  res.json({
    id: result.id,
    currencyCode: result.currencyCode,
    balance: result.balance,
    createdAt: result.createdAt,
    requestId: res.locals.requestId,
  });
});

const adjustBalance = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await AccountService.adjustBalance(id, req.body);
  res.json({ balance: result.balance, requestId: res.locals.requestId });
});

const getAccountSecret = catchAsync(async (req: Request, res: Response) => {
  if (!req.query.owner || req.query.owner !== "true") {
    return res.status(403).json({ error: "Access denied" });
  }
  const { id } = req.params;
  const result = await AccountService.getAccountSecret(id);
  res.json({ ...result, requestId: res.locals.requestId });
});

export const AccountController = {
  getAccountBalance,
  createAccount,
  adjustBalance,
  getAccountSecret,
};
