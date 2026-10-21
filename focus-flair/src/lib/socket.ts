import { io, Socket } from "socket.io-client";
import { getToken } from "./auth";

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/api$/, "") || "http://localhost:5000";

let socket: Socket | null = null;

export function getSocket(): Socket {
  const token = getToken();

  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on("connect", () => {
      console.log("[Socket] Connected to server:", socket?.id);
    });

    socket.on("connect_error", (err) => {
      console.warn("[Socket] Connection error:", err.message);
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
    });
  } else if (token && socket.io.opts.auth && typeof socket.io.opts.auth === "object") {
    (socket.io.opts.auth as Record<string, unknown>).token = token;
  }

  return socket;
}

export function joinExamRoom(examId: string, sessionId?: string) {
  const s = getSocket();
  if (s.connected) {
    s.emit("join_exam", { examId, sessionId });
  } else {
    s.once("connect", () => {
      s.emit("join_exam", { examId, sessionId });
    });
  }
}

export function leaveExamRoom(examId: string) {
  const s = getSocket();
  if (s.connected) {
    s.emit("leave_exam", { examId });
  }
}

export function joinMonitoringRoom(examId?: string) {
  const s = getSocket();
  if (s.connected) {
    s.emit("join_monitoring", { examId });
  } else {
    s.once("connect", () => {
      s.emit("join_monitoring", { examId });
    });
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
