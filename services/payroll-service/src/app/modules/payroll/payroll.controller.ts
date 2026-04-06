import { Request, Response } from "express";
import { PayrollService } from "./payroll.service";
import catchAsync from "../../../shared/catchAsync";

const enqueuePayroll = catchAsync(async (req: Request, res: Response) => {
  const result = await PayrollService.enqueuePayroll(req.body);
  res
    .status(202)
    .json({ message: "Payroll queued successfully", jobId: result.id });
});

export const PayrollController = {
  enqueuePayroll,
};
