import * as crypto from "crypto";
import request from "supertest";

process.env.TRANSACTION_DB_URL = "postgres://localhost:5432/testdb";
process.env.FX_SERVICE_URL = "http://fx-service";
process.env.ACCOUNT_SERVICE_URL = "http://account-service";
process.env.LEDGER_SERVICE_URL = "http://ledger-service";

jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("@prisma/adapter-pg", () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("axios", () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

const mockTransaction = {
  create: jest.fn().mockResolvedValue({
    id: "tx-123",
    createdAt: new Date(),
  }),
  update: jest.fn().mockResolvedValue({
    id: "tx-123",
    status: "COMPLETED",
  }),
  findUnique: jest.fn().mockResolvedValue(null),
};

jest.mock("../prisma/generated/client", () => {
  const PrismaClient = jest.fn().mockImplementation(() => ({
    transaction: mockTransaction,
  }));
  return { PrismaClient };
});

let app: any;

beforeAll(async () => {
  const module = await import("./index");
  app = module.app;
});

describe("Transaction service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("completes an international transfer without FX quote", async () => {
    const axios = require("axios");
    axios.get.mockResolvedValueOnce({ data: { balance: 1000 } });
    axios.post.mockResolvedValue({ data: {} });

    const response = await request(app).post("/transfers/international").send({
      idempotencyKey: "idem-123",
      senderId: "acct-1",
      receiverId: "acct-2",
      amount: 100,
      fromCurrency: "USD",
      toCurrency: "USD",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        status: "COMPLETED",
        requestId: expect.any(String),
      }),
    );
    expect(mockTransaction.create).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(
      "http://ledger-service/ledger/entries",
      expect.any(Object),
    );
  });

  it("returns duplicate response for repeated idempotency key with same payload", async () => {
    mockTransaction.create.mockRejectedValueOnce({ code: "P2002" });
    const payloadHash = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          senderId: "acct-1",
          receiverId: "acct-2",
          amount: 100,
          fromCurrency: "USD",
          toCurrency: "USD",
          fxQuoteId: undefined,
        }),
      )
      .digest("hex");

    mockTransaction.findUnique.mockResolvedValueOnce({
      id: "tx-123",
      status: "COMPLETED",
      payloadHash,
      createdAt: new Date(Date.now() - 1000),
    });

    const response = await request(app).post("/transfers/international").send({
      idempotencyKey: "idem-123",
      senderId: "acct-1",
      receiverId: "acct-2",
      amount: 100,
      fromCurrency: "USD",
      toCurrency: "USD",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: "tx-123",
        status: "COMPLETED",
        message: "Duplicate request ignored",
      }),
    );
  });
});
