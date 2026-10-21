const dotenv = require("dotenv");
const path = require("path");
const { connectDB, closeDbConnection } = require("../config/db");
const { initRedis, closeRedisConnections } = require("../config/redis");
const { startExamWorker, stopExamWorker } = require("./examWorker");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const startWorkerProcess = async () => {
  try {
    console.log("🚀 Starting standalone Focus Flair BullMQ Worker process...");

    // Connect to database
    await connectDB();

    // Initialize Redis
    initRedis();

    // Start workers
    const worker = startExamWorker();

    if (!worker) {
      console.error("Worker failed to start. Exiting...");
      process.exit(1);
    }

    console.log("✅ Worker process is running and waiting for jobs");

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Gracefully stopping worker process...`);
      await stopExamWorker();
      await closeRedisConnections();
      await closeDbConnection();
      console.log("Worker process stopped cleanly.");
      process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (err) {
    console.error("Worker process startup error:", err.message);
    process.exit(1);
  }
};

startWorkerProcess();
