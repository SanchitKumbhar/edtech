/**
 * Focus Flair - HTTP & Caching Load Test Script
 *
 * Runs a realistic multi-user simulation:
 * - Tests public/cached endpoints (Health, Syllabus, Dashboard)
 * - Measures throughput (RPS), latency percentiles (p50, p95, p99), and error rates.
 *
 * Usage:
 *   node load-tests/exam-load-test.js
 *   node load-tests/exam-load-test.js --concurrency 50 --requests 1000 --target http://localhost:5000
 */

const http = require("http");

const args = process.argv.slice(2);
const getArg = (flag, defaultValue) => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : defaultValue;
};

const TARGET_URL = getArg("--target", process.env.API_TARGET_URL || "http://localhost:5000");
const CONCURRENCY = parseInt(getArg("--concurrency", "25"), 10);
const TOTAL_REQUESTS = parseInt(getArg("--requests", "500"), 10);

const ENDPOINTS = [
  { path: "/api/health", weight: 30 },
  { path: "/api/health/readiness", weight: 20 },
  { path: "/api/syllabus/classes", weight: 30 },
  { path: "/", weight: 20 },
];

const latencies = [];
let completedRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
const statusCounts = {};

const pickEndpoint = () => {
  const rand = Math.random() * 100;
  let cumulative = 0;
  for (const ep of ENDPOINTS) {
    cumulative += ep.weight;
    if (rand <= cumulative) return ep.path;
  }
  return ENDPOINTS[0].path;
};

const makeRequest = (path) => {
  return new Promise((resolve) => {
    const url = new URL(path, TARGET_URL);
    const start = Date.now();

    const req = http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const duration = Date.now() - start;
        latencies.push(duration);
        completedRequests += 1;

        statusCounts[res.statusCode] = (statusCounts[res.statusCode] || 0) + 1;
        if (res.statusCode >= 200 && res.statusCode < 400) {
          successfulRequests += 1;
        } else {
          failedRequests += 1;
        }
        resolve();
      });
    });

    req.on("error", (err) => {
      const duration = Date.now() - start;
      latencies.push(duration);
      completedRequests += 1;
      failedRequests += 1;
      statusCounts["ERR"] = (statusCounts["ERR"] || 0) + 1;
      resolve();
    });

    req.setTimeout(5000, () => {
      req.destroy();
    });
  });
};

const calculatePercentile = (sortedArray, percentile) => {
  if (sortedArray.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, index)];
};

const runWorker = async () => {
  while (completedRequests < TOTAL_REQUESTS) {
    const path = pickEndpoint();
    await makeRequest(path);
  }
};

const main = async () => {
  console.log("=================================================");
  console.log(" 🚀 Focus Flair Production Load Test Runner");
  console.log("=================================================");
  console.log(` Target Server:   ${TARGET_URL}`);
  console.log(` Concurrency:     ${CONCURRENCY} virtual users`);
  console.log(` Total Requests:  ${TOTAL_REQUESTS}`);
  console.log("-------------------------------------------------");

  const startTime = Date.now();

  const workers = [];
  for (let i = 0; i < CONCURRENCY; i += 1) {
    workers.push(runWorker());
  }

  await Promise.all(workers);

  const totalTimeMs = Date.now() - startTime;
  const totalTimeSeconds = totalTimeMs / 1000;
  const rps = (completedRequests / totalTimeSeconds).toFixed(2);

  latencies.sort((a, b) => a - b);
  const p50 = calculatePercentile(latencies, 50);
  const p95 = calculatePercentile(latencies, 95);
  const p99 = calculatePercentile(latencies, 99);
  const avg = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1);
  const errorRate = ((failedRequests / completedRequests) * 100).toFixed(2);

  console.log("\n================ LOAD TEST RESULTS ================");
  console.log(` Duration:            ${totalTimeSeconds.toFixed(2)}s`);
  console.log(` Total Requests:      ${completedRequests}`);
  console.log(` Successful (2xx):    ${successfulRequests}`);
  console.log(` Failed (4xx/5xx):    ${failedRequests}`);
  console.log(` Error Rate:          ${errorRate}%`);
  console.log(` Throughput:          ${rps} req/sec`);
  console.log("---------------- Latency Percentiles ---------------");
  console.log(` Average Latency:     ${avg} ms`);
  console.log(` p50 (Median):        ${p50} ms`);
  console.log(` p95:                 ${p95} ms`);
  console.log(` p99:                 ${p99} ms`);
  console.log("---------------- Status Code Distribution ----------");
  console.log(JSON.stringify(statusCounts, null, 2));
  console.log("====================================================\n");
};

main();
