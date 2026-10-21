# Focus Flair: Production-Ready Horizontal Scalability Architecture Audit

## Executive Summary

Focus Flair has been re-architected from a single-instance Node.js application into a **horizontally scalable, resilient distributed system**. Multiple backend API instances can now run concurrently behind a load balancer with full cross-instance synchronization, centralized Redis-backed state coordination, atomic exam state transitions, distributed rate limiting, and asynchronous background worker processing via BullMQ.

---

## 1. Architectural Audit & Bottlenecks Identified

### A. Real-Time Communication (Socket.IO)
- **Previous Bottleneck:** Socket.IO ran in-memory on a single Node.js process without any adapter. When examinees connected to Server A and administrators connected to Server B, `tab_switch` events emitted by examinees were never received by administrators.
- **Previous Vulnerability:** WebSockets accepted unauthenticated connections without verifying JWT tokens, and broadcasted events indiscriminately to all clients via `io.emit("admin_tab_switch", data)` instead of using authenticated, room-based isolation.
- **Remediation:** 
  - Implemented `@socket.io/redis-adapter` with dedicated Redis Publisher and Subscriber clients, synchronizing broadcasts across all API instances.
  - Added strict JWT authentication in Socket.IO handshake (`io.use(socketAuthMiddleware)`).
  - Segregated rooms: `exam:${examId}` (examinees), `exam:${examId}:admin` (administrators), `admin:monitoring` (global monitoring), and `user:${userId}` (personal notifications).

### B. Exam Lifecycle & Submission Race Conditions
- **Previous Bottleneck:** Final submission read the `ExamSession` record, computed scores in-memory, and wrote it back. If a user double-clicked "Submit" or experienced network retries, concurrent submissions caused duplicate executions, score corruption, and race conditions.
- **Previous Vulnerability:** Exam duration was not validated server-side. A rogue client could manipulate local clocks or keep an exam open for hours past its scheduled duration. Concurrent autosave requests could overwrite answers after the final score was calculated.
- **Remediation:**
  - Implemented **Atomic Compare-And-Swap (CAS)** status transition:
    ```javascript
    const activeSession = await ExamSession.findOneAndUpdate(
      { _id: sessionId, studentId: req.user._id, status: "active" },
      { $set: { status: "submitting" } },
      { new: false }
    );
    ```
    Exactly one request can transition the session to `submitting`. Subsequent concurrent submissions receive the finalized session idempotently.
  - Server-side duration validation: `Exam.durationMinutes` is strictly enforced against `session.startedAt` + 30s grace window. Answer saves after expiration are rejected with `403 Forbidden`.
  - Autosave requests verify `session.status === "active"`. If `submitting` or `submitted`, saves are blocked.
  - Options validation: `selectedOptionId` must belong to the question's option list.

### C. Read Latency & Database Load
- **Previous Bottleneck:** Heavy endpoints like Syllabus (`/api/syllabus/classes`, `/api/syllabus/topics`), Leaderboard (`/api/leaderboard`), and Dashboard summaries (`/api/dashboard/admin`, `/api/dashboard/student`) executed unindexed, repetitive queries against MongoDB on every request.
- **Remediation:**
  - Implemented reusable cache utility (`backend/utils/cache.js`) with cache-aside pattern, namespaced keys (`focusflair:cache:...`), and **stampede protection (single-flight promise coalescing)**.
  - Cached static syllabus metadata for 1 hour, leaderboards for 2 minutes, and dashboard summaries for 30 seconds, with immediate cache invalidation on writes.
  - Added compound indexes to `ExamSession`, `QuestionAttempt`, `StudentTopicStat`, and `AntiCheatEvent`.

### D. Anti-Cheat Misconduct Deduplication & Distributed Presence
- **Previous Bottleneck:** A single physical tab-switch or window blur could fire multiple OS events, triggering auto-submission on threshold 2 due to spurious rapid events. Furthermore, online status was tracked solely in memory.
- **Remediation:**
  - Implemented distributed sliding-window deduplication (`backend/utils/presence.js`) via Redis `SET ... EX 2 NX`. Rapid duplicate triggers within 2 seconds are coalesced.
  - Distributed presence tracking: examinees hold a 45-second heartbeat lease in Redis (`focusflair:presence:${examId}:${studentId}`).
  - Multi-tab awareness: tracks active socket IDs per user so a user remains online until all sockets disconnect.

### E. Rate Limiting & Abuse Prevention
- **Previous Bottleneck:** Authentication endpoints (`/api/auth/login`, `/api/auth/register`) and exam endpoints had no rate limiting, leaving them susceptible to brute-force and DDoS attacks.
- **Remediation:**
  - Implemented sliding-window distributed rate limiting (`backend/middleware/rateLimiter.js`) backed by Redis Sorted Sets.
  - Applied route-specific thresholds: 10 req/min for auth, 120 req/min for autosave, 5 req/min for final submissions, and 300 req/min general API limits.
  - Returns standard RFC headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`).
  - Graceful in-memory fallback if Redis is temporarily unreachable.

### F. Asynchronous Background Processing
- **Previous Bottleneck:** Heavy result calculations (percentiles, ranks across all examinees, badge awards, student topic stats) executed synchronously inside the HTTP submit request.
- **Remediation:**
  - Integrated **BullMQ** (`backend/config/queue.js`).
  - Final submission immediately saves durable score and returns `200 OK` to the examinee, then enqueues a `process-exam-result` job to calculate rankings, percentiles, and badges asynchronously with exponential backoff retries.
  - Provided a dedicated worker runner (`backend/workers/index.js`) capable of scaling independently in containerized deployments.

---

## 2. Distributed Architecture Diagram

```
                             [ Client Browsers / Mobile ]
                                         │
                                         ▼
                            [ Nginx / HAProxy / ALB ]
                         (Round-Robin / Least Connections)
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
     [ API Instance 1 :5000 ]                        [ API Instance 2 :5001 ]
     ├─ Express REST Server                          ├─ Express REST Server
     ├─ Socket.IO Server                             ├─ Socket.IO Server
     ├─ Sliding-Window Rate Limiter                  ├─ Sliding-Window Rate Limiter
     └─ Cache-Aside Layer                            └─ Cache-Aside Layer
                 │                                               │
                 ├───────────────────────┬───────────────────────┤
                 ▼                       ▼                       ▼
      [ Redis Cluster / Standalone ]             [ MongoDB Replica Set ]
      ├─ Socket.IO Redis Adapter (Pub/Sub)       ├─ Durable Exam Attempts
      ├─ Distributed Rate Limit Counters         ├─ Questions & Syllabus
      ├─ Cache-Aside Store (TTLs + Stampede)     ├─ Users & Profiles
      ├─ Ephemeral Presence Leases (TTLs)        └─ Anti-Cheat Events
      └─ BullMQ Job Queues (exam-processing)
                 │
                 ▼
      [ BullMQ Worker Process(es) ]
      ├─ Percentile & Rank Computation
      ├─ Student Topic Mastery Aggregation
      └─ Leaderboard Snapshot Generation
```

---

## 3. Redis Key Taxonomy & TTL Strategy

| Key Pattern | Purpose | TTL | Eviction / Invalidation |
| :--- | :--- | :--- | :--- |
| `focusflair:cache:syllabus:*` | Static syllabus & topics | 3600s (1 hr) | Invalidate on `createTopic` |
| `focusflair:cache:leaderboard:*` | Leaderboard queries | 120s (2 min) | Invalidate on snapshot / worker |
| `focusflair:cache:dashboard:*` | Student / Admin dashboard stats | 30s | Invalidate on exam submission |
| `focusflair:cache:exams:*` | Public exam listings & details | 60s | Invalidate on exam CRUD |
| `focusflair:presence:${examId}:${studentId}` | Examinee online presence lease | 45s | Heartbeat lease / disconnect |
| `focusflair:presence:roster:${examId}` | Active student ID set per exam | 90s | Cleaned on socket close |
| `focusflair:dedup:tabswitch:${sessionId}` | Anti-cheat deduplication lock | 2s | Sliding window expiration |
| `focusflair:ratelimit:${type}:${key}` | Sliding window request counts | Window + 1s | Redis sorted set score sweep |
| `bull:exam-processing:*` | BullMQ queues and job state | - | Managed by BullMQ retention rules |

---

## 4. Resilience & Fallback Matrix

| Component | Failure Mode | Behavior & Mitigation |
| :--- | :--- | :--- |
| **Redis Outage** | Connection drops / unreachable | **Fail-Safe:** Cache layer bypasses cache and queries MongoDB directly without crashing. Rate limiter falls back to in-memory sliding window. Sockets fall back to single-instance broadcast with logged warnings. |
| **MongoDB Outage** | Primary failover / disconnect | Readiness probe (`/api/health/readiness`) returns `503 Service Unavailable`. Express returns structured errors. |
| **Worker Process Crash** | Process terminated mid-job | BullMQ automatically locks jobs and re-assigns them to active workers after lock timeout with exponential backoff. |
| **Network Hiccup (Client)** | Examinee loses internet connection | Socket auto-reconnects with exponential backoff (1s-5s), re-authenticates with JWT, and rejoins `exam:${examId}` room. Presence lease is renewed. |
| **Concurrent Submissions** | Client retries or double-clicks | Atomic CAS (`findOneAndUpdate status: active -> submitting`) guarantees exactly one execution path evaluates scores; duplicates receive idempotent `200 OK`. |
