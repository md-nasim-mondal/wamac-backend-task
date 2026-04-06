import request from "supertest";

process.env.PAYROLL_DB_URL = "postgres://localhost:5432/testdb";
process.env.TRANSACTION_SERVICE_URL = "http://transaction-service";

jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("@prisma/adapter-pg", () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("bullmq", () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn().mockResolvedValue({}),
  })),
  Worker: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("ioredis", () => jest.fn());

const mockPayrollJob = {
  create: jest.fn().mockResolvedValue({
    id: "job-123",
    employerId: "emp-123",
    totalAmount: 1000,
    currency: "USD",
    totalCount: 2,
    status: "PENDING",
  }),
};

jest.mock("../prisma/generated/client", () => {
  const PrismaClient = jest.fn().mockImplementation(() => ({
    payrollJob: mockPayrollJob,
  }));
  return { PrismaClient };
});

let app: any;

beforeAll(async () => {
  const module = await import("./index");
  app = module.app;
});

describe("Payroll service", () => {
  it("queues bulk payroll job", async () => {
    const response = await request(app)
      .post("/payroll/bulk")
      .send({
        employerId: "emp-123",
        disbursements: [
          { employeeId: "emp-1", amount: 500 },
          { employeeId: "emp-2", amount: 500 },
        ],
        currency: "USD",
      });

    expect(response.status).toBe(202);
    expect(response.body).toEqual(
      expect.objectContaining({
        message: "Payroll queued successfully",
        jobId: "job-123",
      }),
    );
    expect(mockPayrollJob.create).toHaveBeenCalledTimes(1);
  });
});
