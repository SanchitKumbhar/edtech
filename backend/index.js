const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const http = require("http");
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, ".env") });

const { connectDB, closeDbConnection } = require("./config/db");
const { initRedis, closeRedisConnections } = require("./config/redis");
const { initSocketServer } = require("./socket");
const { startExamWorker, stopExamWorker } = require("./workers/examWorker");
const { closeQueues } = require("./config/queue");
const { apiRateLimiter } = require("./middleware/rateLimiter");
const { notFound, errorHandler } = require("./middleware/error");

// Routes
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const examRoutes = require("./routes/exam.routes");
const practiceRoutes = require("./routes/practice.routes");
const noticeRoutes = require("./routes/notice.routes");
const leaderboardRoutes = require("./routes/leaderboard.routes");
const monitoringRoutes = require("./routes/monitoring.routes");
const pyqRoutes = require("./routes/pyq.routes");
const profileRoutes = require("./routes/profile.routes");
const syllabusRoutes = require("./routes/syllabus.routes");
const instituteRoutes = require("./routes/institute.routes");

const app = express();
const server = http.createServer(app);

// ✅ Trust reverse proxy headers (HAProxy, Nginx, ALB) for accurate IP rate limiting
app.set("trust proxy", parseInt(process.env.TRUST_PROXY || "1", 10));

// ✅ Standard Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  // Request ID / Correlation ID
  const requestId = req.headers["x-request-id"] || `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  req.id = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
});

// ✅ CORS CONFIG
const defaultOrigins = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const configuredOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOriginsSet = new Set([...defaultOrigins, ...configuredOrigins]);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (process.env.CORS_ORIGIN === "*") return true;
  if (allowedOriginsSet.has(origin)) return true;
  if (process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }
  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  credentials: true,
};
app.use(cors(corsOptions));

// ✅ Body parsers with bounded memory size limits (supports PDF uploads)
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// PORT
const PORT = process.env.PORT || 5000;

// Root status
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Focus Flair API server is running",
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0",
  });
});

// Health & Probe routes
app.use("/api/health", healthRoutes);

// Apply general API rate limiting to all business routes
app.use("/api", apiRateLimiter);

// API Resource Routes
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/practice", practiceRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/notice", noticeRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/monitoring", monitoringRoutes);
app.use("/api/pyq", pyqRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/syllabus", syllabusRoutes);
app.use("/api/institutes", instituteRoutes);

// Error middleware
app.use(notFound);
app.use(errorHandler);

// Global server reference for graceful shutdown
let httpServer = null;
let io = null;

// Graceful Shutdown Function
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 [${signal}] Initiating graceful shutdown...`);

  // Stop accepting new HTTP connections
  if (httpServer) {
    httpServer.close(() => {
      console.log("🔒 HTTP server stopped accepting connections");
    });
  }

  // Close socket connections
  if (io) {
    console.log("🔌 Closing Socket.IO server...");
    io.close();
  }

  // Stop background workers
  try {
    await stopExamWorker();
  } catch (err) {
    console.warn("Worker stop error:", err.message);
  }

  // Close BullMQ queues
  try {
    await closeQueues();
  } catch (err) {
    console.warn("Queues close error:", err.message);
  }

  // Close Redis connections
  try {
    await closeRedisConnections();
  } catch (err) {
    console.warn("Redis close error:", err.message);
  }

  // Close MongoDB connection
  try {
    await closeDbConnection();
  } catch (err) {
    console.warn("MongoDB close error:", err.message);
  }

  console.log("✅ Focus Flair backend shutdown complete. Exiting process.");
  process.exit(0);
};

// Start server
const startServer = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Initialize Redis connection pool
    initRedis();

    // 3. Initialize Socket.IO with Redis Adapter
    io = initSocketServer(server);
    app.set("io", io);

    // 4. Optionally run embedded worker in development or if explicitly enabled
    if (process.env.RUN_EMBEDDED_WORKER === "true" || process.env.NODE_ENV !== "production") {
      startExamWorker();
    }

    // 5. Start HTTP Server
    httpServer = server.listen(PORT, () => {
      console.log(`🚀 Focus Flair server running on port ${PORT} [PID: ${process.pid}]`);
      console.log(`🔌 WebSocket server active with Redis multi-instance adapter`);
    });

    // Register process termination handlers
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    console.error("❌ Server start failed:", error.message);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server };