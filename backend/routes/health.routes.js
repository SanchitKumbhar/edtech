const express = require("express");
const { checkDbHealth } = require("../config/db");
const { checkRedisHealth, isRedisConnected } = require("../config/redis");

const router = express.Router();

/**
 * Basic health status
 */
router.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    pid: process.pid,
  });
});

/**
 * Liveness Probe (checks whether process is responsive)
 */
router.get("/liveness", (req, res) => {
  res.status(200).json({
    status: "alive",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness Probe (checks MongoDB and Redis connectivity)
 */
router.get("/readiness", async (req, res) => {
  try {
    const [dbHealth, redisHealth] = await Promise.all([
      checkDbHealth(),
      checkRedisHealth(),
    ]);

    const isDbReady = dbHealth.status === "healthy";
    const isRedisReady = redisHealth.status === "healthy" || isRedisConnected();

    // MongoDB is critical; Redis is non-fatal if caching/fallbacks are active, but documented
    const isReady = isDbReady;
    const statusCode = isReady ? 200 : 503;

    res.status(statusCode).json({
      status: isReady ? "ready" : "not_ready",
      timestamp: new Date().toISOString(),
      dependencies: {
        database: dbHealth,
        redis: redisHealth,
      },
    });
  } catch (err) {
    res.status(503).json({
      status: "not_ready",
      error: err.message,
    });
  }
});

module.exports = router;
