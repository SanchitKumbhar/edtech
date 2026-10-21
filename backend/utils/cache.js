const { getRedisClient, isRedisConnected } = require("../config/redis");

const PREFIX = "focusflair:cache:";
const inFlightRequests = new Map();

/**
 * Normalizes cache key with prefix
 */
const formatKey = (key) => (key.startsWith(PREFIX) ? key : `${PREFIX}${key}`);

/**
 * Get cached value parsed from JSON
 */
const get = async (key) => {
  if (!isRedisConnected()) return null;
  const client = getRedisClient();
  if (!client) return null;

  try {
    const raw = await client.get(formatKey(key));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[Cache] Get error for key "${key}":`, err.message);
    return null;
  }
};

/**
 * Set value in cache with TTL in seconds
 */
const set = async (key, value, ttlSeconds = 300) => {
  if (!isRedisConnected()) return false;
  const client = getRedisClient();
  if (!client) return false;

  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await client.set(formatKey(key), serialized, "EX", ttlSeconds);
    } else {
      await client.set(formatKey(key), serialized);
    }
    return true;
  } catch (err) {
    console.warn(`[Cache] Set error for key "${key}":`, err.message);
    return false;
  }
};

/**
 * Delete a specific key
 */
const del = async (key) => {
  if (!isRedisConnected()) return false;
  const client = getRedisClient();
  if (!client) return false;

  try {
    await client.del(formatKey(key));
    return true;
  } catch (err) {
    console.warn(`[Cache] Del error for key "${key}":`, err.message);
    return false;
  }
};

/**
 * Delete keys matching a pattern (e.g., "syllabus:*")
 */
const delPattern = async (pattern) => {
  if (!isRedisConnected()) return false;
  const client = getRedisClient();
  if (!client) return false;

  try {
    const fullPattern = formatKey(pattern);
    let cursor = "0";
    let deletedCount = 0;

    do {
      const [nextCursor, keys] = await client.scan(cursor, "MATCH", fullPattern, "COUNT", 100);
      cursor = nextCursor;

      if (keys && keys.length > 0) {
        await client.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== "0");

    return deletedCount;
  } catch (err) {
    console.warn(`[Cache] DelPattern error for pattern "${pattern}":`, err.message);
    return false;
  }
};

/**
 * Cache-aside wrapper with stampede prevention (promise coalescing)
 *
 * @param {string} key - Cache key
 * @param {number} ttlSeconds - Expiration in seconds
 * @param {Function} fetchFn - Async function returning fresh data if cache miss
 */
const wrap = async (key, ttlSeconds, fetchFn) => {
  const cached = await get(key);
  if (cached !== null) {
    return cached;
  }

  const inflightKey = formatKey(key);
  if (inFlightRequests.has(inflightKey)) {
    return inFlightRequests.get(inflightKey);
  }

  const promise = (async () => {
    try {
      const freshData = await fetchFn();
      if (freshData !== undefined && freshData !== null) {
        await set(key, freshData, ttlSeconds);
      }
      return freshData;
    } finally {
      inFlightRequests.delete(inflightKey);
    }
  })();

  inFlightRequests.set(inflightKey, promise);
  return promise;
};

module.exports = {
  get,
  set,
  del,
  delPattern,
  wrap,
  formatKey,
};
