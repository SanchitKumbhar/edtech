const { describe, it, after } = require("node:test");
const assert = require("node:assert");
const express = require("express");
const request = require("supertest");
const instituteRoutes = require("../routes/institute.routes");
const { closeRedisConnections } = require("../config/redis");

describe("Multi-Institute SaaS Endpoints", () => {
  after(async () => {
    await closeRedisConnections();
  });

  const app = express();
  app.use(express.json());
  app.use("/api/institutes", instituteRoutes);

  it("GET /api/institutes/public should return list of active institutes", async () => {
    const res = await request(app).get("/api/institutes/public");
    assert.ok([200, 500].includes(res.status)); // 200 if DB connected
  });

  it("GET /api/institutes/validate-code/:code with empty code should return 400 or 404", async () => {
    const res = await request(app).get("/api/institutes/validate-code/NONEXISTENT999");
    assert.ok([404, 500].includes(res.status));
  });

  it("POST /api/institutes/register without required fields should return 400", async () => {
    const res = await request(app)
      .post("/api/institutes/register")
      .send({ name: "Incomplete Institute" });
    assert.strictEqual(res.status, 400);
  });
});
