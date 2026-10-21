const { describe, it, after } = require("node:test");
const assert = require("node:assert");
const express = require("express");
const request = require("supertest");
const healthRoutes = require("../routes/health.routes");
const { closeRedisConnections } = require("../config/redis");

describe("Health & Probes API", () => {
  after(async () => {
    await closeRedisConnections();
  });
  const app = express();
  app.use("/api/health", healthRoutes);

  it("GET /api/health should return 200 with uptime and status", async () => {
    const res = await request(app).get("/api/health");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, "ok");
    assert.ok(typeof res.body.uptime === "number");
    assert.ok(res.body.timestamp);
  });

  it("GET /api/health/liveness should return 200 with alive status", async () => {
    const res = await request(app).get("/api/health/liveness");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, "alive");
    assert.ok(typeof res.body.uptime === "number");
  });

  it("GET /api/health/readiness should inspect dependencies", async () => {
    const res = await request(app).get("/api/health/readiness");
    // Depending on whether local MongoDB is connected, status is 200 or 503
    assert.ok([200, 503].includes(res.status));
    assert.ok(res.body.dependencies);
    assert.ok(res.body.dependencies.database);
    assert.ok(res.body.dependencies.redis);
  });
});
