const Redis = require("ioredis");

let redisClient = null;
let redisPub = null;
let redisSub = null;
let isRedisAvailable = false;

const getRedisConfig = () => {
  const url = process.env.REDIS_URL || process.env.REDIS_URI;
  if (url) {
    return {
      url,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
      maxRetriesPerRequest: 20,
      enableReadyCheck: true,
      connectTimeout: 10000,
    };
  }

  return {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || "0", 10),
    retryStrategy(times) {
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
    maxRetriesPerRequest: 20,
    enableReadyCheck: true,
    connectTimeout: 10000,
  };
};

const createRedisClient = (role = "default", overrides = {}) => {
  const config = getRedisConfig();
  let client;

  try {
    if (config.url) {
      client = new Redis(config.url, { ...config, ...overrides });
    } else {
      client = new Redis({ ...config, ...overrides });
    }

    client.on("connect", () => {
      console.log(`[Redis:${role}] Connection established`);
      if (role === "default") isRedisAvailable = true;
    });

    client.on("ready", () => {
      console.log(`[Redis:${role}] Client ready`);
      if (role === "default") isRedisAvailable = true;
    });

    client.on("error", (err) => {
      console.warn(`[Redis:${role}] Warning:`, err.message || err);
      if (role === "default" && client.status !== "ready") {
        isRedisAvailable = false;
      }
    });

    client.on("close", () => {
      if (role === "default") isRedisAvailable = false;
    });

    return client;
  } catch (error) {
    console.warn(`[Redis:${role}] Initialization error:`, error.message);
    return null;
  }
};

const initRedis = () => {
  if (!redisClient) {
    redisClient = createRedisClient("default");
  }
  if (!redisPub) {
    redisPub = createRedisClient("pub");
  }
  if (!redisSub) {
    redisSub = createRedisClient("sub");
  }

  return { redisClient, redisPub, redisSub };
};

const getRedisClient = () => {
  if (!redisClient) {
    initRedis();
  }
  return redisClient;
};

const getRedisPubSub = () => {
  if (!redisPub || !redisSub) {
    initRedis();
  }
  return { pubClient: redisPub, subClient: redisSub };
};

// Dedicated connection generator for BullMQ (BullMQ requires maxRetriesPerRequest: null)
const getBullMQConnection = () => {
  const config = getRedisConfig();
  if (config.url) {
    return new Redis(config.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
};

const checkRedisHealth = async () => {
  const client = getRedisClient();
  if (!client) {
    return { status: "disconnected", error: "Redis client not initialized" };
  }

  try {
    const ping = await Promise.race([
      client.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Redis ping timeout")), 2000)),
    ]);
    return {
      status: ping === "PONG" ? "healthy" : "degraded",
      details: { ping, status: client.status },
    };
  } catch (err) {
    return {
      status: "unhealthy",
      error: err.message,
    };
  }
};

const closeRedisConnections = async () => {
  console.log("Closing Redis connections...");
  const clients = [redisClient, redisPub, redisSub].filter(Boolean);
  await Promise.allSettled(
    clients.map(async (client) => {
      try {
        await client.quit();
      } catch {
        client.disconnect();
      }
    })
  );
  redisClient = null;
  redisPub = null;
  redisSub = null;
  isRedisAvailable = false;
};

module.exports = {
  initRedis,
  getRedisClient,
  getRedisPubSub,
  getBullMQConnection,
  checkRedisHealth,
  closeRedisConnections,
  isRedisConnected: () => isRedisAvailable && redisClient?.status === "ready",
};
