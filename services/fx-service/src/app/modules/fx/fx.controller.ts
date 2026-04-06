import { Request, Response } from "express";
import { FxService } from "./fx.service";
import catchAsync from "../../../shared/catchAsync";

const createQuote = catchAsync(async (req: Request, res: Response) => {
  const result = await FxService.createQuote(req.body);
  res.json(result);
});

const getQuote = catchAsync(async (req: Request, res: Response) => {
  const result = await FxService.getQuote(req.params.id);
  res.json(result);
});

const useQuote = catchAsync(async (req: Request, res: Response) => {
  const result = await FxService.useQuote(req.params.id);
  res.json(result);
});

export const FxController = {
  createQuote,
  getQuote,
  useQuote,
};
