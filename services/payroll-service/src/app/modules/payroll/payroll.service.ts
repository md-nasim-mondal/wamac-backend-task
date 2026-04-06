import prisma from "../../../shared/prisma";
import { payrollQueue } from "../../utils/queue";
import {
  IBulkPayrollRequest,
  IPayrollDisbursement,
} from "./payroll.interface";

const enqueuePayroll = async (data: IBulkPayrollRequest) => {
  const { employerId, disbursements, currency } = data;
  const totalAmount = disbursements.reduce(
    (sum: number, d: IPayrollDisbursement) => sum + d.amount,
    0,
  );

  const jobRecord = await prisma.payrollJob.create({
    data: {
      employerId,
      totalAmount,
      currency,
      totalCount: disbursements.length,
      status: "PENDING",
    },
  });

  await payrollQueue.add(
    "processPayroll",
    {
      jobId: jobRecord.id,
      employerId,
      disbursements,
      currency,
    },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    },
  );

  return jobRecord;
};

export const PayrollService = {
  enqueuePayroll,
};
