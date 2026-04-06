import request from "supertest";

process.env.LEDGER_DB_URL = "postgres://localhost:5432/testdb";

jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("@prisma/adapter-pg", () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({})),
}));

const mockLedgerEntry = {
  create: jest.fn().mockImplementation(async (data: any) => ({
    id: `entry-${data.data.transactionId}`,
    ...data.data,
  })),
  findFirst: jest.fn().mockResolvedValue({
    auditHash: "genesis",
  }),
};

jest.mock("../prisma/generated/client", () => {
  const PrismaClient = jest.fn().mockImplementation(() => ({
    ledgerEntry: mockLedgerEntry,
    $transaction: jest
      .fn()
      .mockImplementation(async (operations: any[]) => Promise.all(operations)),
  }));
  return { PrismaClient };
});

let app: any;

beforeAll(async () => {
  const module = await import("./server");
  app = module.default;
});

describe("Ledger service", () => {
  it("has app", () => {
    expect(app).toBeDefined();
  });

  it("records balanced ledger entries", async () => {
    const response = await request(app)
      .post("/ledger/entries")
      .send({
        transactionId: "tx-123",
        entries: [
          {
            accountId: "acct-1",
            debitAmount: 100,
            creditAmount: 0,
            currency: "USD",
          },
          {
            accountId: "acct-2",
            debitAmount: 0,
            creditAmount: 100,
            currency: "USD",
          },
        ],
      });

    expect(response.status).toBe(201);
  });

  it("rejects unbalanced entries", async () => {
    const response = await request(app)
      .post("/ledger/entries")
      .send({
        transactionId: "tx-123",
        entries: [
          {
            accountId: "acct-1",
            debitAmount: 100,
            creditAmount: 0,
            currency: "USD",
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "At least two entries are required for double-entry bookkeeping",
    });
  });
});
