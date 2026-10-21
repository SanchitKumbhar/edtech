/**
 * Focus Flair - Real-Time Socket.IO Load Test Script
 *
 * Evaluates:
 * - Concurrent WebSocket connections across instances
 * - Handshake latency
 * - Room joins (examinees and admins)
 * - Broadcast distribution through Redis adapter
 *
 * Usage:
 *   node load-tests/socket-load-test.js --clients 50 --target http://localhost:5000
 */

const { io } = require("socket.io-client");
const jwt = require("jsonwebtoken");

const args = process.argv.slice(2);
const getArg = (flag, defaultValue) => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : defaultValue;
};

const TARGET_URL = getArg("--target", process.env.SOCKET_URL || "http://localhost:5000");
const CLIENT_COUNT = parseInt(getArg("--clients", "30"), 10);
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";

const createTestToken = (id, role = "student") => {
  return jwt.sign(
    { sub: id, role, email: `${id}@test.com` },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
};

const main = async () => {
  console.log("=================================================");
  console.log(" 🔌 Focus Flair Socket.IO Real-Time Load Tester");
  console.log("=================================================");
  console.log(` Target Server:   ${TARGET_URL}`);
  console.log(` Active Clients:  ${CLIENT_COUNT}`);
  console.log("-------------------------------------------------");

  let connectedCount = 0;
  let disconnectCount = 0;
  let errorCount = 0;
  let eventsReceived = 0;
  const connectionLatencies = [];

  const clients = [];

  for (let i = 0; i < CLIENT_COUNT; i += 1) {
    const isMonitor = i === 0; // First client acts as admin monitor
    const role = isMonitor ? "admin" : "student";
    const userId = `sim-user-${i}`;
    const token = createTestToken(userId, role);
    const start = Date.now();

    const socket = io(TARGET_URL, {
      transports: ["websocket"],
      auth: { token },
      reconnection: false,
      timeout: 5000,
    });

    socket.on("connect", () => {
      connectedCount += 1;
      connectionLatencies.push(Date.now() - start);

      if (isMonitor) {
        socket.emit("join_monitoring", { examId: "sim-exam-1" });
        socket.on("admin_tab_switch", (data) => {
          eventsReceived += 1;
        });
      } else {
        socket.emit("join_exam", { examId: "sim-exam-1", sessionId: `sim-session-${i}` });
        // Emit occasional simulated tab switch
        if (i % 5 === 0) {
          setTimeout(() => {
            socket.emit("tab_switch", {
              examId: "sim-exam-1",
              sessionId: `sim-session-${i}`,
              occurredAt: new Date().toISOString(),
            });
          }, 500);
        }
      }
    });

    socket.on("connect_error", (err) => {
      errorCount += 1;
    });

    socket.on("disconnect", () => {
      disconnectCount += 1;
    });

    clients.push(socket);
  }

  // Allow clients to communicate for 3 seconds
  await new Promise((r) => setTimeout(r, 3000));

  // Disconnect all
  clients.forEach((s) => s.disconnect());

  const avgConnectTime = connectionLatencies.length
    ? (connectionLatencies.reduce((a, b) => a + b, 0) / connectionLatencies.length).toFixed(1)
    : 0;

  console.log("\n================ SOCKET RESULTS ================");
  console.log(` Clients Attempted:    ${CLIENT_COUNT}`);
  console.log(` Successfully Connected: ${connectedCount}`);
  console.log(` Connection Errors:    ${errorCount}`);
  console.log(` Average Connect Time: ${avgConnectTime} ms`);
  console.log(` Real-time Events Rx:  ${eventsReceived}`);
  console.log("================================================\n");
};

main();
