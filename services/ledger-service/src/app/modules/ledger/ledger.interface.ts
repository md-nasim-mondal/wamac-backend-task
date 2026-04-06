export interface ILedgerEntry {
  transactionId: string;
  accountId: string;
  debitAmount: number;
  creditAmount: number;
  currency: string;
  fxQuoteId?: string;
  fxRate?: number;
}

export interface ICreateLedgerEntries {
  transactionId: string;
  entries: ILedgerEntry[];
}
