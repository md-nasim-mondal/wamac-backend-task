import { NextFunction, Request, Response } from "express";

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  console.error(err);

  // Ledger-specific error handling
  if (message.includes("required for double-entry bookkeeping")) {
    return res.status(400).json({ error: message });
  }

  if (
    message.includes("Ledger invariant violation") ||
    message.includes("not found")
  ) {
    return res.status(400).json({ error: message });
  }

  res.status(status).json({ error: message });
};

export const notFound = (req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
};
