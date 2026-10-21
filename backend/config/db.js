const mongoose = require("mongoose");

let isConnecting = false;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (isConnecting) {
    return;
  }

  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.DATABASE_URL;

  if (!mongoUri) {
    throw new Error(
      "MongoDB URI is missing. Set one of MONGODB_URI, MONGO_URI, or DATABASE_URL in backend/.env"
    );
  }

  isConnecting = true;

  const maxPoolSize = parseInt(process.env.MONGO_MAX_POOL_SIZE || "50", 10);
  const minPoolSize = parseInt(process.env.MONGO_MIN_POOL_SIZE || "5", 10);
  const serverSelectionTimeoutMS = parseInt(process.env.MONGO_TIMEOUT_MS || "15000", 10);

  try {
    await mongoose.connect(String(mongoUri).trim(), {
      maxPoolSize,
      minPoolSize,
      serverSelectionTimeoutMS,
      socketTimeoutMS: 45000,
      family: 4,
    });

    const host = mongoose.connection?.host || "unknown-host";
    const dbName = mongoose.connection?.name || "unknown-db";
    console.log(`MongoDB connected (${host}/${dbName}) [pool: ${minPoolSize}-${maxPoolSize}]`);
    isConnecting = false;
    return mongoose.connection;
  } catch (error) {
    isConnecting = false;
    const message = error?.message || "Unknown MongoDB error";
    const hint = [
      "Check MongoDB Atlas IP allowlist (add current IP or 0.0.0.0/0 for dev).",
      "Verify credentials and database name in the URI.",
      "Confirm cluster is active and network is reachable.",
      "Ensure URI starts with mongodb:// or mongodb+srv://.",
    ].join(" ");

    throw new Error(`${message}. ${hint}`);
  }
};

const checkDbHealth = async () => {
  const state = mongoose.connection.readyState;
  const stateMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  const status = state === 1 ? "healthy" : "unhealthy";

  let pingTimeMs = null;
  if (state === 1) {
    try {
      const start = Date.now();
      await mongoose.connection.db.admin().ping();
      pingTimeMs = Date.now() - start;
    } catch {
      // ping failed
    }
  }

  return {
    status,
    connectionState: stateMap[state] || "unknown",
    pingTimeMs,
  };
};

const closeDbConnection = async () => {
  if (mongoose.connection.readyState !== 0) {
    console.log("Closing MongoDB connection...");
    await mongoose.connection.close(false);
  }
};

module.exports = { connectDB, checkDbHealth, closeDbConnection };
