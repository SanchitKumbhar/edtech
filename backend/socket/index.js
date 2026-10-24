const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const jwt = require("jsonwebtoken");
const { getRedisPubSub, isRedisConnected } = require("../config/redis");
const {
  registerPresence,
  refreshPresence,
  removePresence,
  isTabSwitchDuplicate,
} = require("../utils/presence");
const AntiCheatEvent = require("../models/AntiCheatEvent");
const ExamSession = require("../models/ExamSession");
const MonitoringSession = require("../models/MonitoringSession");

let ioInstance = null;

/**
 * Socket Authentication Middleware
 */
const socketAuthMiddleware = (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");

    if (!token) {
      // In development or backwards-compatibility mode, allow unauthenticated with guest role
      // But log a warning. For strict production, reject.
      if (process.env.STRICT_SOCKET_AUTH === "false") {
        socket.user = { role: "guest", isAnonymous: true };
        return next();
      }
      return next(new Error("Authentication error: Token required"));
    }

    const secret = process.env.JWT_SECRET || "change-this-secret";
    const decoded = jwt.verify(token, secret);

    socket.user = {
      _id: decoded.sub || decoded.id,
      role: decoded.role || "student",
      email: decoded.email,
      instituteId: decoded.instituteId,
    };

    return next();
  } catch (err) {
    return next(new Error(`Authentication error: ${err.message}`));
  }
};

/**
 * Initialize Socket.IO server with Redis adapter and events
 */
const initSocketServer = (httpServer) => {
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

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || origin === "null") return callback(null, true);
        if (process.env.CORS_ORIGIN === "*") return callback(null, true);
        if (allowedOriginsSet.has(origin)) return callback(null, true);
        if (process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // Attach Redis Adapter if Redis is connected
  try {
    const { pubClient, subClient } = getRedisPubSub();
    if (pubClient && subClient) {
      io.adapter(createAdapter(pubClient, subClient));
      console.log("🔌 Socket.IO Redis Adapter mounted successfully across backend instances");
    }
  } catch (adapterErr) {
    console.warn("Socket.IO Redis adapter setup error (fallback to local adapter):", adapterErr.message);
  }

  // Socket Authentication Middleware
  io.use(socketAuthMiddleware);

  // Connection handling
  io.on("connection", (socket) => {
    const user = socket.user || { role: "guest" };
    console.log(`[Socket] Client connected: ${socket.id} (user: ${user._id || "anon"}, role: ${user.role})`);

    // Automatically join user personal room if authenticated
    if (user._id) {
      socket.join(`user:${user._id}`);
    }

    // Examinee joins an exam room
    socket.on("join_exam", async (data = {}) => {
      const { examId, sessionId } = data;
      if (!examId) return;

      const room = `exam:${examId}`;
      socket.join(room);
      socket.currentExamId = examId;
      socket.currentSessionId = sessionId;

      if (user._id) {
        await registerPresence(examId, user._id.toString(), socket.id, { sessionId });
        io.to(`exam:${examId}:admin`).emit("examinee_presence_update", {
          studentId: user._id,
          examId,
          status: "online",
          socketId: socket.id,
        });
      }

      socket.emit("joined_exam_room", { examId, room });
    });

    // Admin joins monitoring room for an exam or institute monitoring
    socket.on("join_monitoring", (data = {}) => {
      if (user.role !== "admin" && user.role !== "superadmin") {
        socket.emit("error", { message: "Unauthorized: Admin role required for monitoring" });
        return;
      }

      const { examId } = data;
      const instPrefix = user.instituteId ? `institute:${user.instituteId}:` : "";

      if (examId) {
        const room = `${instPrefix}exam:${examId}:admin`;
        socket.join(room);
        socket.emit("joined_monitoring_room", { examId, room });
      }

      // Join institute-wide admin channel
      const instRoom = user.instituteId ? `institute:${user.instituteId}:admin` : "admin:monitoring";
      socket.join(instRoom);
      socket.emit("joined_monitoring_room", { room: instRoom });
    });

    // Examinee leaves exam room
    socket.on("leave_exam", async (data = {}) => {
      const examId = data.examId || socket.currentExamId;
      if (!examId) return;

      socket.leave(`exam:${examId}`);
      if (user._id) {
        await removePresence(examId, user._id.toString(), socket.id);
        const instPrefix = user.instituteId ? `institute:${user.instituteId}:` : "";
        io.to(`${instPrefix}exam:${examId}:admin`).emit("examinee_presence_update", {
          studentId: user._id,
          examId,
          status: "offline",
        });
      }
    });

    // Periodic heartbeat from active examinee
    socket.on("heartbeat", async (data = {}) => {
      const examId = data.examId || socket.currentExamId;
      if (examId && user._id) {
        await refreshPresence(examId, user._id.toString());
      }
    });

    // Anti-cheat tab switch event
    socket.on("tab_switch", async (data = {}) => {
      try {
        const sessionId = data.sessionId || socket.currentSessionId;
        const examId = data.examId || socket.currentExamId;

        if (!sessionId) {
          console.warn("[Socket] tab_switch received without sessionId");
          return;
        }

        // Deduplicate rapid consecutive tab-switch triggers
        const isDuplicate = await isTabSwitchDuplicate(sessionId);
        if (isDuplicate) {
          console.log(`[Socket] Ignored duplicate tab_switch event for session: ${sessionId}`);
          return;
        }

        console.log(`[Socket] Validated tab_switch event for session: ${sessionId}`);

        let eventPayload = {
          sessionId,
          examId,
          studentId: user._id,
          occurredAt: data.occurredAt || new Date().toISOString(),
          eventType: "tab_switch",
        };

        if (sessionId) {
          const session = await ExamSession.findById(sessionId);
          if (session && session.status === "active") {
            session.warningCount = (session.warningCount || 0) + 1;
            session.tabSwitchCount = (session.tabSwitchCount || 0) + 1;
            await session.save();

            eventPayload.tabSwitchCount = session.tabSwitchCount;
            eventPayload.examId = session.examId;

            // Broadcast to specific exam admin room within the institute
            const targetExamId = (session.examId || examId || "").toString();
            const instId = session.instituteId || user.instituteId;
            const instPrefix = instId ? `institute:${instId}:` : "";

            if (targetExamId) {
              io.to(`${instPrefix}exam:${targetExamId}:admin`).emit("admin_tab_switch", eventPayload);
              io.to(`exam:${targetExamId}:admin`).emit("admin_tab_switch", eventPayload); // compatibility
            }

            if (instId) {
              io.to(`institute:${instId}:admin`).emit("admin_tab_switch", eventPayload);
            }
          }
        }

        io.to("admin:monitoring").emit("admin_tab_switch", eventPayload);
      } catch (err) {
        console.error("[Socket] Error handling tab_switch:", err.message);
      }
    });

    // Clean disconnect handling
    socket.on("disconnect", async () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
      const examId = socket.currentExamId;
      if (examId && user._id) {
        await removePresence(examId, user._id.toString(), socket.id);
        io.to(`exam:${examId}:admin`).emit("examinee_presence_update", {
          studentId: user._id,
          examId,
          status: "offline",
        });
      }
    });
  });

  ioInstance = io;
  return io;
};

const getIO = () => {
  return ioInstance;
};

module.exports = {
  initSocketServer,
  getIO,
};
