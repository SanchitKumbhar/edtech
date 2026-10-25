# Focus Flair Platform — Complete Application Architecture

This document provides a comprehensive technical architecture specification for the **Focus Flair** web application, featuring system topologies, sequence flows, data pipelines, entity-relationship diagrams, and scalability models.

---

## 1. High-Level System Architecture

The Focus Flair platform is architected around a distributed, decoupled, horizontally scalable topology designed to handle concurrent live examinations with real-time proctoring telemetry.

```mermaid
graph TB
    subgraph ClientLayer ["Client Layer"]
        StudentBrowser["Student Browser (React 18 / Vite SPA)"]
        AdminBrowser["Admin Proctor Console (React 18 / Vite SPA)"]
    end

    subgraph IngressLayer ["Ingress & Load Balancing Layer"]
        ReverseProxy["Nginx / ALB Reverse Proxy (SSL Termination / Sticky WebSockets)"]
    end

    subgraph AppCluster ["Stateless Application Cluster"]
        Node1["Node.js API + Socket.IO Server #1"]
        Node2["Node.js API + Socket.IO Server #2"]
        NodeN["Node.js API + Socket.IO Server #N"]
    end

    subgraph InMemLayer ["Distributed In-Memory Layer (Redis 7+)"]
        RedisAdapter["Socket.IO Redis Adapter (Cross-Node Pub/Sub)"]
        RedisCache["Cache-Aside Layer (Dashboards & Leaderboards)"]
        RedisRateLimit["Sliding-Window Rate Limiters"]
        RedisPresence["Examinee Presence Leases & Anti-Cheat Dedup"]
        BullMQQueue["BullMQ Distributed Job Queues"]
    end

    subgraph WorkerLayer ["Asynchronous Background Worker Layer"]
        Worker1["BullMQ Exam Worker #1 (Scoring, Ranks, Percentiles, Badges)"]
        Worker2["BullMQ Exam Worker #2"]
    end

    subgraph DataLayer ["Durable Persistence Layer (MongoDB 7+)"]
        MongoCluster[("MongoDB Replica Set (Users, Exams, Sessions, Attempts, PYQs)")]
    end

    StudentBrowser -->|HTTP REST / WebSocket| ReverseProxy
    AdminBrowser -->|HTTP REST / WebSocket| ReverseProxy

    ReverseProxy -->|Round-Robin HTTP| Node1
    ReverseProxy -->|Sticky IP Hash WebSocket| Node2
    ReverseProxy --> NodeN

    Node1 <-->|Pub/Sub| RedisAdapter
    Node2 <-->|Pub/Sub| RedisAdapter
    NodeN <-->|Pub/Sub| RedisAdapter

    Node1 --> RedisCache
    Node1 --> RedisRateLimit
    Node1 --> RedisPresence
    Node1 --> BullMQQueue

    BullMQQueue --> Worker1
    BullMQQueue --> Worker2

    Node1 --> MongoCluster
    Node2 --> MongoCluster
    Worker1 --> MongoCluster
    Worker2 --> MongoCluster
    Worker1 --> RedisCache
```

---

## 2. Real-Time Anti-Cheat Proctoring Architecture

The anti-cheat subsystem captures client-side tab switching and window blur events, deduplicates them through Redis, logs durable incident records, and broadcasts alerts instantly to the proctor's monitoring dashboard.

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student (ExamLive)
    participant ClientHook as Browser Visibility Event
    participant API as Express API Server
    participant Redis as Redis In-Memory Store
    participant SocketServer as Socket.IO Server
    actor Admin as Proctor (LiveMonitoring)

    Student->>ClientHook: Switches browser tab or minimizes window
    ClientHook->>API: POST /api/monitoring/events (sessionId, eventType: "tab_switch")
    
    API->>Redis: Check anticheat:dedup:<sessionId> (1500ms lease)
    alt Event Is Duplicate (Burst Glitch)
        Redis-->>API: Duplicate detected (ignore)
    else Event Is Fresh
        Redis->>Redis: Set anticheat:dedup:<sessionId> EX 1.5
        API->>API: Increment session.tabSwitchCount & warningCount
        API->>API: Persist AntiCheatEvent in MongoDB
        
        API->>SocketServer: Emit "admin_tab_switch" to room exam:<examId>
        SocketServer-->>Admin: Real-time Incident Alert & Updated Counter
        
        alt warningCount < 4 (Warning Phase)
            API-->>Student: 200 OK (warningCount: N, message: "Please stay on test window")
            Student->>Student: Display In-Exam Warning Banner
        else warningCount >= 4 (Malpractice Limit Reached)
            API->>API: Execute CAS Atomic Auto-Submit
            API->>API: Set session.status = "auto_submitted"
            API->>SocketServer: Emit "examinee_auto_submitted"
            API-->>Student: 403 Forbidden (status: "auto_submitted", locked out)
            SocketServer-->>Admin: Update Proctor Console (Student moved to Auto-Submitted column)
        end
    end

    opt Proctor Revert Override
        Admin->>API: POST /api/monitoring/sessions/:id/revert
        API->>API: Set session.status = "active", reset warningCount
        API->>SocketServer: Emit "examinee_presence_update"
        API-->>Admin: 200 OK (Session restored)
        Admin-->>Student: Student re-enters exam session
    end
```

---

## 3. Exam Submission & Asynchronous Scoring Pipeline

To prevent slow response times and database deadlocks when hundreds of examinees submit simultaneously at the end of a timed test, Focus Flair employs a two-tier submission pipeline:
1. **Synchronous Tier**: Calculates durable exam marks immediately and returns a verified `200 OK` response to the examinee in under 50ms.
2. **Asynchronous Tier**: Enqueues heavy ranking, percentile distributions, topic mastery aggregations, and badge evaluations into BullMQ workers.

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student Browser
    participant API as Express API Server
    participant DB as MongoDB
    participant Queue as BullMQ (Redis)
    participant Worker as examWorker Process
    participant Cache as Redis Cache

    Student->>API: POST /api/exams/sessions/submit { sessionId }
    API->>DB: Atomic CAS update: status "active" -> "submitted"
    
    alt Session Already Submitted (Idempotency Guard)
        DB-->>API: 0 documents modified
        API-->>Student: 400 Bad Request ("Session already submitted")
    else Session Locked Successfully
        API->>DB: Calculate question scores based on ExamQuestion markingScheme
        API->>DB: Save session.scoreObtained, accuracyPct, submittedAt
        API->>Queue: Enqueue job "process-exam-result" { sessionId, examId, studentId }
        API-->>Student: 200 OK { status: "submitted", scoreObtained, accuracyPct }
        
        Note over Queue,Worker: Asynchronous Background Execution
        Queue->>Worker: Dispatch "process-exam-result" job
        Worker->>DB: Query all submitted sessions for this exam
        Worker->>Worker: Compute Rank in Exam and Percentile: ((Total - Rank) / (Total - 1)) * 100
        Worker->>DB: Update session.rankInExam, session.percentile
        Worker->>DB: Aggregate QuestionAttempts into StudentTopicStats
        Worker->>DB: Increment StudentProfile.pointsTotal
        Worker->>Worker: Run badgeService.evaluateBadges(studentId)
        opt Qualified for New Badges
            Worker->>DB: Insert StudentBadge records & award bonus points
        end
        Worker->>Cache: Invalidate cache:dashboard:student:<studentId>
        Worker->>Cache: Invalidate cache:leaderboard:*
        Worker-->>Queue: Acknowledge job completion
    end
```

---

## 4. Adaptive Practice Engine State Machine

Practice Mode adapts dynamically to examinee proficiency by enforcing progression gates and difficulty milestones.

```mermaid
stateDiagram-v2
    [*] --> EasyUnlocked : Start Topic Practice
    
    state EasyUnlocked {
        [*] --> SolvingEasy
        SolvingEasy --> EasyCorrect : Answer Correct (+15 pts + Streak)
        SolvingEasy --> EasyIncorrect : Answer Incorrect (0 pts, Streak reset)
        EasyIncorrect --> SolvingEasy
        EasyCorrect --> SolvingEasy
    }

    EasyCorrect --> MediumUnlocked : Cleared Required Easy Quota
    
    state MediumUnlocked {
        [*] --> SolvingMedium
        SolvingMedium --> MediumCorrect : Answer Correct (+25 pts + Streak)
        SolvingMedium --> MediumIncorrect : Answer Incorrect (0 pts, Streak reset)
        MediumIncorrect --> SolvingMedium
        MediumCorrect --> SolvingMedium
    }

    MediumCorrect --> HardUnlocked : Cleared Required Medium Quota
    
    state HardUnlocked {
        [*] --> SolvingHard
        SolvingHard --> HardCorrect : Answer Correct (+40 pts + Streak)
        SolvingHard --> HardIncorrect : Answer Incorrect (0 pts, Streak reset)
        HardIncorrect --> SolvingHard
        HardCorrect --> SolvingHard
    }

    HardCorrect --> TopicMastery : Reached 90%+ Topic Accuracy
    TopicMastery --> [*] : Award TOPIC_MASTER Badge (+60 pts)
```

---

## 5. Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    INSTITUTE ||--o{ USER : "registers"
    USER ||--|| STUDENT_PROFILE : "has"
    USER ||--o{ EXAM : "creates (admin)"
    USER ||--o{ EXAM_ASSIGNMENT : "assigned to"
    USER ||--o{ EXAM_SESSION : "attempts"
    USER ||--o{ QUESTION_ATTEMPT : "records"
    USER ||--o{ PRACTICE_ATTEMPT : "solves"
    USER ||--o{ STUDENT_TOPIC_STAT : "tracks"
    USER ||--o{ STUDENT_BADGE : "unlocks"
    
    EXAM ||--o{ EXAM_QUESTION : "contains"
    EXAM ||--o{ EXAM_ASSIGNMENT : "distributed via"
    EXAM ||--o{ EXAM_SESSION : "instantiates"
    
    EXAM_SESSION ||--o{ QUESTION_ATTEMPT : "groups"
    EXAM_SESSION ||--o{ ANTI_CHEAT_EVENT : "logs"
    
    PRACTICE_TOPIC ||--o{ PRACTICE_QUESTION : "categorizes"
    PRACTICE_TOPIC ||--o{ PRACTICE_ATTEMPT : "records"
    PRACTICE_TOPIC ||--o{ STUDENT_TOPIC_STAT : "measures"
    
    BADGE ||--o{ STUDENT_BADGE : "awarded to"
    
    USER {
        ObjectId _id PK
        string fullName
        string email UK
        string passwordHash
        string role
        ObjectId instituteId FK
    }

    INSTITUTE {
        ObjectId _id PK
        string name
        string code UK
        ObjectId adminUserId FK
    }

    STUDENT_PROFILE {
        ObjectId _id PK
        ObjectId userId FK
        number pointsTotal
        number badgesCount
        number currentStreakDays
        number avgAccuracyPct
    }

    EXAM {
        ObjectId _id PK
        string title
        string examCode UK
        string status
        number durationMinutes
        number totalQuestions
        number maxMarks
        ObjectId createdBy FK
    }

    EXAM_QUESTION {
        ObjectId _id PK
        ObjectId examId FK
        number questionNo
        string questionText
        number marks
        number negativeMarks
        string explanation
    }

    EXAM_SESSION {
        ObjectId _id PK
        ObjectId examId FK
        ObjectId studentId FK
        string status
        number scoreObtained
        number accuracyPct
        number rankInExam
        number percentile
        number tabSwitchCount
    }

    QUESTION_ATTEMPT {
        ObjectId _id PK
        ObjectId sessionId FK
        ObjectId questionId FK
        ObjectId selectedOptionId
        boolean isCorrect
        number marksAwarded
    }

    PRACTICE_TOPIC {
        ObjectId _id PK
        string classLevel
        string subject
        string topicName
        number easyToMediumUnlockCount
        number mediumToHardUnlockCount
    }

    PRACTICE_QUESTION {
        ObjectId _id PK
        ObjectId topicId FK
        string difficulty
        string questionText
        number pointsReward
    }

    BADGE {
        ObjectId _id PK
        string code UK
        string title
        string description
        string icon
        number pointsReward
    }

    STUDENT_BADGE {
        ObjectId _id PK
        ObjectId studentId FK
        ObjectId badgeId FK
        date unlockedAt
    }
```

---

## 6. Scalability, Security & High Availability Guarantees

### 6.1 Horizontal Scaling
* **Stateless Web Nodes**: Application instances do not retain in-memory user session state. Any incoming request can be served by any container behind the load balancer.
* **Sticky IP Sockets with Redis Cross-Talk**: Socket.IO connections use IP-hash affinity on Nginx, while `@socket.io/redis-adapter` relays events across nodes through Redis Pub/Sub channels.

### 6.2 Fault Tolerance & Idempotency
* **Compare-And-Swap (CAS) Submission Guard**: Prevents duplicate final submissions or double scoring via atomic MongoDB condition: `{ _id: sessionId, status: "active" }`.
* **Sliding-Window Anti-Cheat Deduplication**: 1500ms ephemeral Redis leases absorb rapid client window-blur triggers, ensuring stable telemetry without false warnings.
* **Database Connection Resilience**: MongoDB connection pool with auto-reconnect and 10-second buffer timeouts prevents process crashes during transient network partitions.

### 6.3 Security Hardening
* **Stateless JWT Signatures**: All protected API endpoints require `Bearer <token>` headers with role-based checks (`requireRole('admin')`, `requireRole('student')`).
* **Answer Masking During Active Tests**: When students fetch questions via `GET /api/exams/:examId/questions`, the controller strips `isCorrect` flags from option schemas so correct answers cannot be inspected in browser DevTools.
* **Server-Side Expiration Enforcement**: Exam durations are enforced by server timestamps rather than relying solely on client-side JavaScript timers.
