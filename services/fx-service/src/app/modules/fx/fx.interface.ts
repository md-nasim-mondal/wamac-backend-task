export interface IFxQuote {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  status: "UNUSED" | "USED";
  expiresAt: Date;
  createdAt: Date;
}

export interface ICreateFxQuote {
  fromCurrency: string;
  toCurrency: string;
}
