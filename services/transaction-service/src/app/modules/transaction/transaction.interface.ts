export interface ITransaction {
  id: string;
  idempotencyKey: string;
  payloadHash: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  senderId: string;
  receiverId: string;
  amount: number;
  currency: string;
  fxQuoteId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInternationalTransfer {
  idempotencyKey: string;
  senderId: string;
  receiverId: string;
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  fxQuoteId?: string;
}
