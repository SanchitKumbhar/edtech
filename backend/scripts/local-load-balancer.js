/**
 * Focus Flair - Local Development Load Balancer (Zero-dependency Node.js)
 *
 * Balances HTTP and WebSocket traffic across multiple backend instances
 * using Round-Robin with health check tracking.
 *
 * Usage:
 *   node scripts/local-load-balancer.js
 */

const http = require("http");
const net = require("net");

const PORT = parseInt(process.env.LB_PORT || "8000", 10);

const TARGETS = [
  { host: "127.0.0.1", port: 5000, alive: true },
  { host: "127.0.0.1", port: 5001, alive: true },
];

let currentIndex = 0;

const getNextTarget = () => {
  const healthy = TARGETS.filter((t) => t.alive);
  if (healthy.length === 0) return TARGETS[0]; // fallback
  const target = healthy[currentIndex % healthy.length];
  currentIndex += 1;
  return target;
};

// Check health of target servers periodically
const checkTargetsHealth = () => {
  TARGETS.forEach((target) => {
    const req = http.get(
      { host: target.host, port: target.port, path: "/api/health/liveness", timeout: 2000 },
      (res) => {
        target.alive = res.statusCode === 200;
      }
    );
    req.on("error", () => {
      target.alive = false;
    });
    req.on("timeout", () => {
      target.alive = false;
      req.destroy();
    });
  });
};

setInterval(checkTargetsHealth, 5000);

const server = http.createServer((req, res) => {
  const target = getNextTarget();

  const options = {
    hostname: target.host,
    port: target.port,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      "x-forwarded-for": req.socket.remoteAddress,
      "x-forwarded-proto": "http",
      "x-forwarded-port": PORT,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", (err) => {
    console.error(`[LoadBalancer] Proxy error routing to ${target.port}:`, err.message);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Bad Gateway", message: `Instance on port ${target.port} unreachable` }));
    }
  });

  req.pipe(proxyReq, { end: true });
});

// Support WebSocket Upgrade tunneling (for Socket.IO)
server.on("upgrade", (req, socket, head) => {
  const target = getNextTarget();
  const proxySocket = net.connect(target.port, target.host, () => {
    proxySocket.write(
      `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n` +
        Object.keys(req.headers)
          .map((key) => `${key}: ${req.headers[key]}`)
          .join("\r\n") +
        "\r\n\r\n"
    );
    if (head && head.length) proxySocket.write(head);
    socket.pipe(proxySocket).pipe(socket);
  });

  proxySocket.on("error", (err) => {
    console.error(`[LoadBalancer] WebSocket upgrade error to ${target.port}:`, err.message);
    socket.destroy();
  });
});

server.listen(PORT, () => {
  console.log("==========================================================");
  console.log(` ⚖️  Focus Flair Load Balancer running on port ${PORT}`);
  console.log(" Balancing traffic across:");
  TARGETS.forEach((t) => console.log(`   - http://${t.host}:${t.port}`));
  console.log("==========================================================");
});
