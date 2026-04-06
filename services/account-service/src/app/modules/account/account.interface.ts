export interface IAccount {
  id: string;
  userId: string;
  currencyCode: string;
  balance: number;
  ownerNameEncrypted?: string;
  ownerNameIv?: string;
  ownerNameAuthTag?: string;
  ownerNameKey?: string;
  ownerNameKeyIv?: string;
  ownerNameKeyAuthTag?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateAccount {
  userId: string;
  currencyCode: string;
  initialBalance?: number;
  ownerName?: string;
}

export interface IAdjustBalance {
  amount: number;
  adjustmentId: string;
}
