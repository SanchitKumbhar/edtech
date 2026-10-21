const { describe, it, after } = require("node:test");
const assert = require("node:assert");
const express = require("express");
const request = require("supertest");
const { createRateLimiter } = require("../middleware/rateLimiter");
const { closeRedisConnections } = require("../config/redis");

describe("Distributed Rate Limiter Middleware", () => {
  after(async () => {
    await closeRedisConnections();
  });
  it("should enforce limits and return standard rate limit headers", async () => {
    const app = express();
    const testLimiter = createRateLimiter({
      type: `test_limit_${Date.now()}`,
      windowSeconds: 5,
      max: 3,
      message: "Rate limit exceeded in test",
    });

    app.get("/test", testLimiter, (req, res) => {
      res.json({ ok: true });
    });

    // Request 1: Allowed
    const res1 = await request(app).get("/test");
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.headers["ratelimit-limit"], "3");
    assert.strictEqual(res1.headers["ratelimit-remaining"], "2");

    // Request 2: Allowed
    const res2 = await request(app).get("/test");
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.headers["ratelimit-remaining"], "1");

    // Request 3: Allowed (last allowed in window)
    const res3 = await request(app).get("/test");
    assert.strictEqual(res3.status, 200);
    assert.strictEqual(res3.headers["ratelimit-remaining"], "0");

    // Request 4: Blocked with 429
    const res4 = await request(app).get("/test");
    assert.strictEqual(res4.status, 429);
    assert.strictEqual(res4.body.status, "error");
    assert.strictEqual(res4.body.message, "Rate limit exceeded in test");
    assert.ok(res4.headers["retry-after"]);
  });
});
