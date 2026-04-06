export interface IPayrollDisbursement {
  employeeId: string;
  amount: number;
}

export interface IBulkPayrollRequest {
  employerId: string;
  disbursements: IPayrollDisbursement[];
  currency: string;
}

export interface IPayrollJob {
  id: string;
  employerId: string;
  totalAmount: number;
  currency: string;
  status: string;
  processedCount: number;
  totalCount: number;
  createdAt: Date;
  updatedAt: Date;
}
