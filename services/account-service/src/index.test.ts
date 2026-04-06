import request from "supertest";

process.env.MASTER_KEY = "0123456789abcdef0123456789abcdef";
process.env.ACCOUNT_DB_URL = "postgres://localhost:5432/testdb";

jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("@prisma/adapter-pg", () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({})),
}));

const mockWallet = {
  findUnique: jest.fn().mockResolvedValue({
    id: "acct-123",
    balance: 1000,
    currencyCode: "USD",
    ownerNameEncrypted: null,
    ownerNameIv: null,
    ownerNameAuthTag: null,
    ownerNameKey: null,
    ownerNameKeyIv: null,
    ownerNameKeyAuthTag: null,
  }),
  create: jest.fn().mockResolvedValue({
    id: "acct-123",
    currencyCode: "USD",
    balance: 1000,
    createdAt: "2026-04-06T00:00:00.000Z",
  }),
  update: jest.fn().mockResolvedValue({ balance: 900 }),
};

const mockTx = {
  wallet: mockWallet,
  $queryRaw: jest.fn().mockResolvedValue([{ adjustment_key: "adj-1" }]),
};

jest.mock("../prisma/generated/client", () => {
  const PrismaClient = jest.fn().mockImplementation(() => ({
    wallet: mockWallet,
    $transaction: jest
      .fn()
      .mockImplementation(async (callback: any) => callback(mockTx)),
  }));
  return { PrismaClient };
});

let app: any;

beforeAll(async () => {
  const module = await import("./index");
  app = module.app;
});

describe("Account service", () => {
  it("returns account balance", async () => {
    const response = await request(app).get("/accounts/acct-123/balance");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ balance: 1000, currency: "USD" });
  });

  it("creates an account", async () => {
    const response = await request(app).post("/accounts").send({
      userId: "user-123",
      currencyCode: "USD",
      initialBalance: 1000,
      ownerName: "Alice Example",
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: "acct-123",
        currencyCode: "USD",
        balance: 1000,
      }),
    );
  });

  it("applies a balance adjustment", async () => {
    const response = await request(app)
      .post("/accounts/acct-123/adjust")
      .send({ amount: -100, adjustmentId: "tx-123-debit" });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      balance: 900,
      requestId: expect.any(String),
    });
  });
});
