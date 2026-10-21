const { getRedisClient, isRedisConnected } = require("../config/redis");

// In-memory fallback if Redis is unavailable
const memoryBuckets = new Map();

/**
 * Creates a sliding-window rate limiter middleware
 *
 * @param {Object} options
 * @param {string} options.type - Unique type name for this limiter
 * @param {number} options.windowSeconds - Window duration in seconds
 * @param {number} options.max - Maximum allowed requests in the window
 * @param {Function} [options.keyGenerator] - Optional custom key extractor (default: req.ip)
 * @param {string} [options.message] - Custom error message
 */
const createRateLimiter = ({
  type = "general",
  windowSeconds = 60,
  max = 100,
  keyGenerator = (req) => req.ip || req.headers["x-forwarded-for"] || "anonymous",
  message = "Too many requests. Please try again later.",
}) => {
  return async (req, res, next) => {
    const rawKey = keyGenerator(req);
    const redisKey = `focusflair:ratelimit:${type}:${rawKey}`;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const clearBefore = now - windowMs;

    if (isRedisConnected()) {
      const client = getRedisClient();
      try {
        // Sliding window using Redis Sorted Set (ZADD, ZREMRANGEBYSCORE, ZCARD, EXPIRE)
        const multi = client.multi();
        multi.zremrangebyscore(redisKey, 0, clearBefore);
        multi.zadd(redisKey, now, `${now}-${Math.random()}`);
        multi.zcard(redisKey);
        multi.expire(redisKey, windowSeconds + 1);

        const results = await multi.exec();
        const requestCount = results[2][1];

        const remaining = Math.max(0, max - requestCount);
        const resetSeconds = Math.ceil(windowSeconds);

        res.setHeader("RateLimit-Limit", max);
        res.setHeader("RateLimit-Remaining", remaining);
        res.setHeader("RateLimit-Reset", resetSeconds);

        if (requestCount > max) {
          res.setHeader("Retry-After", resetSeconds);
          return res.status(429).json({
            status: "error",
            message,
            retryAfter: resetSeconds,
          });
        }

        return next();
      } catch (err) {
        console.warn(`[RateLimiter:${type}] Redis error, falling back to memory:`, err.message);
      }
    }

    // In-memory fallback
    const memKey = `${type}:${rawKey}`;
    let timestamps = memoryBuckets.get(memKey) || [];
    timestamps = timestamps.filter((t) => t > clearBefore);
    timestamps.push(now);
    memoryBuckets.set(memKey, timestamps);

    const remaining = Math.max(0, max - timestamps.length);
    res.setHeader("RateLimit-Limit", max);
    res.setHeader("RateLimit-Remaining", remaining);
    res.setHeader("RateLimit-Reset", windowSeconds);

    if (timestamps.length > max) {
      res.setHeader("Retry-After", windowSeconds);
      return res.status(429).json({
        status: "error",
        message,
        retryAfter: windowSeconds,
      });
    }

    return next();
  };
};

// Specialized preconfigured rate limiters
const authRateLimiter = createRateLimiter({
  type: "auth",
  windowSeconds: 60,
  max: 10,
  message: "Too many authentication attempts. Please try again after a minute.",
});

const examAttemptLimiter = createRateLimiter({
  type: "exam_attempt",
  windowSeconds: 60,
  max: 120,
  keyGenerator: (req) => (req.user?._id ? req.user._id.toString() : req.ip),
  message: "Exam autosave rate limit exceeded. Please pace your requests.",
});

const examSubmitLimiter = createRateLimiter({
  type: "exam_submit",
  windowSeconds: 60,
  max: 5,
  keyGenerator: (req) => (req.user?._id ? req.user._id.toString() : req.ip),
  message: "Exam submission in progress. Please do not submit repeatedly.",
});

const apiRateLimiter = createRateLimiter({
  type: "api",
  windowSeconds: 60,
  max: 300,
  message: "Global rate limit exceeded. Please slow down.",
});

module.exports = {
  createRateLimiter,
  authRateLimiter,
  examAttemptLimiter,
  examSubmitLimiter,
  apiRateLimiter,
};
