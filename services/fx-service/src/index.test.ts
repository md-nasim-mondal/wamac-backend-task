import request from "supertest";

process.env.FX_DB_URL = "postgres://localhost:5432/testdb";

jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("@prisma/adapter-pg", () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({})),
}));

const mockFxQuote = {
  create: jest.fn().mockResolvedValue({
    id: "quote-123",
    fromCurrency: "USD",
    toCurrency: "EUR",
    rate: 0.92,
    expiresAt: new Date(Date.now() + 60000),
    status: "UNUSED",
  }),
  findUnique: jest.fn().mockResolvedValue({
    id: "quote-123",
    fromCurrency: "USD",
    toCurrency: "EUR",
    rate: 0.92,
    expiresAt: new Date(Date.now() + 60000),
    status: "UNUSED",
  }),
  updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  findFirst: jest.fn().mockResolvedValue({
    id: "quote-123",
    fromCurrency: "USD",
    toCurrency: "EUR",
    rate: 0.92,
    expiresAt: new Date(Date.now() + 60000),
    status: "USED",
  }),
};

jest.mock("../prisma/generated/client", () => {
  const PrismaClient = jest.fn().mockImplementation(() => ({
    fxQuote: mockFxQuote,
  }));
  return { PrismaClient };
});

let app: any;

beforeAll(async () => {
  const module = await import("./index");
  app = module.app;
});

describe("FX service", () => {
  it("creates a locked quote", async () => {
    const response = await request(app).post("/fx/quote").send({
      fromCurrency: "USD",
      toCurrency: "EUR",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: "quote-123",
        fromCurrency: "USD",
        toCurrency: "EUR",
        rate: 0.92,
        status: "UNUSED",
      }),
    );
  });

  it("retrieves quote validity", async () => {
    const response = await request(app).get("/fx/quote/quote-123");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: "quote-123",
        status: "UNUSED",
        timeRemainingMs: expect.any(Number),
      }),
    );
  });

  it("redeems quote successfully", async () => {
    mockFxQuote.findUnique.mockResolvedValueOnce({
      id: "quote-123",
      fromCurrency: "USD",
      toCurrency: "EUR",
      rate: 0.92,
      expiresAt: new Date(Date.now() + 60000),
      status: "USED",
    });

    const response = await request(app).post("/fx/quote/quote-123/use");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: "quote-123",
        status: "USED",
      }),
    );
  });
});
