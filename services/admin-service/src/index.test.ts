import request from "supertest";

let app: any;

beforeAll(async () => {
  const module = await import("./index");
  app = module.app;
});

describe("Admin service", () => {
  it("returns health status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.text).toBe("Admin OK");
  });
});
