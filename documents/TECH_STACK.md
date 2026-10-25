# Focus Flair Platform — Technical Specification & Tech Stack Document

This document outlines the complete technical architecture, software libraries, database schemas, Redis key taxonomy, background queues, and API contracts powering the **Focus Flair** platform.

---

## 1. System Technology Stack

### 1.1 Frontend (Client Application)
* **Framework**: React 18 (Functional components with React Hooks)
* **Build Tool & Bundler**: Vite 5 (Fast ESM-based HMR and optimized production bundling)
* **Language**: TypeScript 5 (Strict type checking, zero `any` leaks where possible)
* **Styling & Design System**: Tailwind CSS with CSS custom properties (HSL design tokens, dark mode, glassmorphism card elevation)
* **UI Component Primitives**: Radix UI (Accessible headless primitives for Dialogs, Dropdowns, Tooltips, Progress bars)
* **Data Fetching & State Management**: `@tanstack/react-query` v5 (Declarative caching, query invalidation, mutation life cycles, optimistic updates)
* **Data Visualization & Charts**: Recharts (Responsive SVG-based Line charts, Bar charts, Cartesian grids, Tooltips)
* **Icons**: `lucide-react` (Lightweight SVG vector iconography)
* **Real-time Client**: `socket.io-client` v4 (Authenticated WebSocket communication, auto-reconnection, heartbeat monitoring)
* **Client Routing**: `react-router-dom` v6 (Protected route wrappers, layout outlets, full-screen examination escapes)

### 1.2 Backend (Application Server)
* **Runtime**: Node.js v20+ / v22 (LTS)
* **Web Framework**: Express.js v5 (Modern asynchronous route handling, middleware pipelining)
* **Database**: MongoDB v7+ (NoSQL document store for persistent domain data)
* **Object Data Modeling (ODM)**: Mongoose v8 (Strict schema definitions, cascading delete hooks, compound indexing)
* **In-Memory Cache & Key-Value Store**: Redis v7+ via `ioredis` v5 (Sliding-window rate limiters, anti-cheat deduplication, presence leases, cache-aside read wrappers)
* **Real-Time Engine**: Socket.IO v4 with `@socket.io/redis-adapter` v8 (Horizontally scalable Pub/Sub across multi-node server clusters)
* **Distributed Task Queue**: BullMQ v5 (Redis-backed reliable message queue with retry backoff and concurrency control)
* **Security & Cryptography**:
  - `jsonwebtoken` v9: Cryptographically signed HMAC-SHA256 JWT tokens
  - `bcrypt` v6: High-entropy salt hashing for user passwords
  - `cors`: Configured cross-origin resource sharing policies
* **Environment Management**: `dotenv` for configuration injection

---

## 2. Directory Architecture

```
pg/
├── backend/
│   ├── config/
│   │   ├── db.js             # Mongoose MongoDB connection pooling
│   │   ├── redis.js          # ioredis client factory & BullMQ connection pool
│   │   └── queue.js          # BullMQ queue instantiations & job publishers
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── dashboard.controller.js
│   │   ├── exams.controller.js
│   │   ├── institute.controller.js
│   │   ├── leaderboard.controller.js
│   │   ├── monitoring.controller.js
│   │   ├── notice.controller.js
│   │   ├── practice.controller.js
│   │   ├── profiles.controller.js
│   │   ├── pyq.controller.js
│   │   ├── syllabus.controller.js
│   │   └── users.controller.js
│   ├── middleware/
│   │   ├── auth.js           # JWT verification & role authorization (student/admin)
│   │   ├── error.js          # Centralized error handler & status mapper
│   │   ├── rateLimiter.js    # Redis sliding-window distributed rate limiters
│   │   └── tenant.js         # Multi-institute tenant resolution
│   ├── models/
│   │   ├── AntiCheatEvent.js
│   │   ├── Badge.js
│   │   ├── Exam.js
│   │   ├── ExamAssignment.js
│   │   ├── ExamQuestion.js
│   │   ├── ExamSession.js
│   │   ├── Institute.js
│   │   ├── LeaderboardSnapshot.js
│   │   ├── Notice.js
│   │   ├── PracticeAttempt.js
│   │   ├── PracticeQuestion.js
│   │   ├── PracticeTopic.js
│   │   ├── PyqSet.js
│   │   ├── QuestionAttempt.js
│   │   ├── StudentBadge.js
│   │   ├── StudentProfile.js
│   │   ├── StudentTopicStat.js
│   │   └── User.js
│   ├── routes/               # Express REST routers matching controller modules
│   ├── socket/
│   │   └── index.js          # Socket.IO connection handler & room manager
│   ├── utils/
│   │   ├── auth.js           # JWT token generator
│   │   ├── badgeService.js   # Automated badge evaluator & system seeder
│   │   ├── cache.js          # Cache-aside wrapper with stampede protection
│   │   └── presence.js       # Redis presence tracker & event deduplication
│   ├── workers/
│   │   ├── examWorker.js     # BullMQ asynchronous exam scoring & ranking worker
│   │   └── index.js          # Worker entry point
│   ├── test/                 # Native Node.js automated test suites
│   ├── index.js              # HTTP & WebSocket server entry point
│   └── package.json
│
├── focus-flair/              # React + Vite frontend application
│   ├── src/
│   │   ├── components/       # Radix UI, layout wrappers & navigation bars
│   │   ├── hooks/            # Custom React hooks (useToast, etc.)
│   │   ├── lib/              # api.ts (fetch wrapper), auth.ts, socket.ts
│   │   ├── pages/            # 23 view pages (ExamLive, Monitoring, Practice, etc.)
│   │   ├── App.tsx           # Route declarations & QueryClient provider
│   │   └── main.tsx
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   └── package.json
│
├── documents/                # System documentation
│   ├── USER_MANUAL.md
│   ├── FEATURE_DOCUMENT.md
│   ├── TECH_STACK.md
│   └── APP_ARCHITECTURE.md
├── docker-compose.yml        # Multi-container orchestration (App, Redis, Mongo, Nginx)
└── nginx.conf                # Reverse proxy & WebSocket load balancing configuration
```

---

## 3. Database Schemas & Models

### 3.1 Identity & Multi-Tenancy
* **`User`**: `_id`, `fullName`, `email` (unique index), `passwordHash`, `role` (`student` | `admin`), `instituteId` (ref: Institute), `createdAt`.
* **`Institute`**: `_id`, `name`, `code` (unique, uppercase index), `adminUserId`, `isActive`, `createdAt`.
* **`StudentProfile`**: `_id`, `userId` (ref: User, unique), `pointsTotal`, `badgesCount`, `currentStreakDays`, `longestStreakDays`, `avgAccuracyPct`, `practiceAttemptCount`, `levelNo`, `avatarUrl`.

### 3.2 Examination Subsystem
* **`Exam`**: `_id`, `title`, `description`, `examCode` (unique index), `examType`, `classLevel`, `durationMinutes`, `totalQuestions`, `maxMarks`, `status` (`draft` | `scheduled` | `live` | `completed` | `archived`), `schedule` (`startAt`, `endAt`), `rules`, `markingScheme`, `createdBy` (ref: User).
* **`ExamQuestion`**: `_id`, `examId` (ref: Exam, indexed), `questionNo`, `questionType`, `questionText`, `topic`, `subject`, `difficulty`, `marks`, `negativeMarks`, `options` (`[ { label, text, isCorrect } ]`), `explanation`.
* **`ExamAssignment`**: `_id`, `examId` (ref: Exam), `studentId` (ref: User), `status` (`assigned` | `in_progress` | `submitted`), `assignedAt`. Index: `{ examId: 1, studentId: 1 }` (unique).
* **`ExamSession`**: `_id`, `examId` (ref: Exam), `studentId` (ref: User), `status` (`active` | `submitted` | `auto_submitted`), `startedAt`, `submittedAt`, `scoreObtained`, `accuracyPct`, `rankInExam`, `percentile`, `tabSwitchCount`, `warningCount`, `entryMeta`.
* **`QuestionAttempt`**: `_id`, `sessionId` (ref: ExamSession), `examId`, `studentId`, `questionId` (ref: ExamQuestion), `selectedOptionId`, `visitStatus`, `isMarkedForReview`, `isCorrect`, `marksAwarded`, `answeredAt`. Index: `{ sessionId: 1, questionId: 1 }` (unique).
* **`AntiCheatEvent`**: `_id`, `sessionId`, `examId`, `studentId`, `eventType` (`tab_switch` | `window_blur`), `severity` (`low` | `medium` | `high`), `occurredAt`.

### 3.3 Practice & Syllabus Subsystem
* **`PracticeTopic`**: `_id`, `classLevel`, `subject`, `topicName`, `icon`, `isActive`, `easyToMediumUnlockCount`, `mediumToHardUnlockCount`. Index: `{ classLevel: 1, subject: 1, topicName: 1 }` (unique).
* **`PracticeQuestion`**: `_id`, `topicId` (ref: PracticeTopic, indexed), `difficulty` (`easy` | `medium` | `hard`), `questionText`, `options` (`[ { label, text, isCorrect } ]`), `pointsReward`, `explanation`.
* **`PracticeAttempt`**: `_id`, `studentId` (ref: User), `questionId` (ref: PracticeQuestion), `topicId`, `selectedOptionId`, `isCorrect`, `pointsEarned`, `attemptedAt`.
* **`StudentTopicStat`**: `_id`, `studentId` (ref: User), `topicId` (ref: PracticeTopic), `masteryPct`, `accuracyPct`, `solvedCount`, `totalAttempted`. Index: `{ studentId: 1, topicId: 1 }` (unique).

### 3.4 Gamification, PYQ & Notices
* **`Badge`**: `_id`, `code` (unique), `title`, `description`, `icon`, `pointsReward`, `criteria`.
* **`StudentBadge`**: `_id`, `studentId` (ref: User), `badgeId` (ref: Badge), `unlockedAt`. Index: `{ studentId: 1, badgeId: 1 }` (unique).
* **`PyqSet`**: `_id`, `examName`, `examYear`, `title`, `subject`, `description`, `paperUrl`, `durationMinutes`, `totalMarks`, `isPublished`, `questions` (`[ { questionNo, questionText, options, correctOption, explanation, marks } ]`).
* **`LeaderboardSnapshot`**: `_id`, `boardType` (`weekly` | `monthly` | `all_time`), `snapshotDate`, `studentId`, `name`, `points`, `rankNo`.
* **`Notice`**: `_id`, `title`, `body`, `targetRole` (`student` | `admin` | `all`), `isPinned`, `publishAt`, `expiresAt`, `authorId`.

---

## 4. Redis Key Taxonomy & Distributed Policies

| Key Pattern | Data Structure | TTL | Purpose |
| :--- | :--- | :--- | :--- |
| `cache:dashboard:student:<userId>` | String (JSON) | 30s | Cached student dashboard metrics |
| `cache:dashboard:admin` | String (JSON) | 30s | Cached admin dashboard counts |
| `cache:leaderboard:<boardType>` | String (JSON) | 60s | Cached leaderboard rankings |
| `presence:session:<sessionId>` | String | 60s (heartbeat) | Ephemeral presence lease of live student |
| `anticheat:dedup:<sessionId>` | String | 1500ms | Sliding-window deduplication of blur events |
| `ratelimit:auth:<ip>` | Sorted Set | 60s | Sliding window rate limit on login/register |
| `ratelimit:attempt:<userId>` | Sorted Set | 60s | Rate limiter on exam autosave mutations |
| `ratelimit:submit:<userId>` | Sorted Set | 60s | Rate limiter on exam final submissions |

---

## 5. BullMQ Asynchronous Task Pipeline

To maintain high throughput on live exam submit endpoints, heavy post-processing is offloaded to background BullMQ workers:
* **Queue**: `exam-processing-queue`
* **Worker Process**: `workers/examWorker.js`
* **Job Types**:
  1. `process-exam-result`:
     - Recalculates student ranks and percentiles across all submitted sessions for the exam.
     - Aggregates topic stats across question attempts.
     - Updates student cumulative points.
     - Evaluates and awards qualifying achievement badges via `badgeService.js`.
     - Invalidates student and admin dashboard caches in Redis.
  2. `leaderboard-snapshot`:
     - Compiles and persists historical weekly and monthly leaderboard snapshots.

---

## 6. Complete REST API Specification

### Authentication (`/api/auth`)
* `POST /api/auth/register` — Register student or admin account
* `POST /api/auth/login` — Login and receive JWT token
* `GET /api/auth/me` — Retrieve current authenticated user session

### Multi-Institute (`/api/institutes`)
* `POST /api/institutes/register` — Onboard new institution with admin credentials
* `GET /api/institutes/public` — List active institutions
* `GET /api/institutes/validate-code/:code` — Validate institute code during student registration

### Examination Engine (`/api/exams`)
* `GET /api/exams` — List exams (filter by status)
* `POST /api/exams` — Create new exam (Admin)
* `GET /api/exams/:examId` — Get exam details
* `PUT /api/exams/:examId` — Update exam metadata (Admin)
* `DELETE /api/exams/:examId` — Delete exam (Admin)
* `GET /api/exams/:examId/questions` — List exam questions (sanitizes correct answers for active students)
* `POST /api/exams/:examId/questions` — Add question to exam (Admin)
* `POST /api/exams/entry/validate` — Validate exam code and eligibility (Student)
* `POST /api/exams/sessions/start` — Start timed exam session (Student)
* `POST /api/exams/sessions/attempt` — Autosave question answer (Student, Rate-limited)
* `POST /api/exams/sessions/submit` — Final exam submission (Student, CAS locked)
* `GET /api/exams/sessions/my-history` — Retrieve student submitted exam history with scores & ranks
* `GET /api/exams/sessions/:sessionId/review` — Retrieve full scorecard and question-by-question review with explanations
* `GET /api/exams/admin/submitted-scores` — Audit student scores across exams (Admin)

### Practice & Drills (`/api/practice`)
* `GET /api/practice/topics` — List syllabus topics
* `POST /api/practice/topics` — Create practice topic (Admin)
* `GET /api/practice/topics/:topicId/questions` — Get practice questions by difficulty
* `GET /api/practice/topics/:topicId/unlock-status` — Check Easy/Medium/Hard difficulty unlock progress
* `POST /api/practice/questions` — Add single practice question (Admin)
* `POST /api/practice/questions/bulk` — Bulk CSV question upload (Admin)
* `POST /api/practice/attempts` — Submit drill answer, update streak, evaluate badges (Student)
* `GET /api/practice/stats/me` — Retrieve student topic mastery and accuracy stats (Student)

### Previous Year Questions (`/api/pyq`)
* `GET /api/pyq` — List published PYQ sets (Admins see drafts)
* `GET /api/pyq/:pyqId` — Get PYQ paper and questions
* `POST /api/pyq` — Create new PYQ paper (Admin)
* `PUT /api/pyq/:pyqId` — Update or publish/unpublish PYQ set (Admin)
* `DELETE /api/pyq/:pyqId` — Delete PYQ set (Admin)

### Gamification & Leaderboard (`/api/leaderboard`)
* `GET /api/leaderboard?boardType=weekly|monthly|allTime` — Get dynamic periodic rankings
* `POST /api/leaderboard/snapshot` — Generate leaderboard snapshot (Admin)
* `GET /api/leaderboard/students/:studentId` — Retrieve student unlocked and locked badges showcase

### Announcements (`/api/notices`)
* `GET /api/notices` — Retrieve active notices for current user role
* `POST /api/notices` — Publish announcement (Admin)
* `DELETE /api/notices/:noticeId` — Delete announcement (Admin)

### Live Monitoring (`/api/monitoring`)
* `GET /api/monitoring/exams/:examId` — Get active examinees, auto-submits, and incident audit log (Admin)
* `POST /api/monitoring/events` — Log client anti-cheat violation event (Student)
* `POST /api/monitoring/sessions/:sessionId/revert` — Revert auto-submitted student back to active (Admin)

### Health & Probes (`/api/health`)
* `GET /api/health` — Basic uptime and status probe
* `GET /api/health/liveness` — Kubernetes/Container liveness probe
* `GET /api/health/readiness` — Inspects MongoDB and Redis connection readiness

---

## 7. Environment Variables Reference (`.env`)

```env
# Server
PORT=5000
NODE_ENV=development
JWT_SECRET=super_secret_jwt_key_here
CLIENT_URL=http://localhost:5173

# Database
MONGO_URI=mongodb://localhost:27017/edtech

# Redis & Caching
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# BullMQ Background Worker
ENABLE_WORKERS=true
```
