# Focus Flair Platform — Feature Specification Document

This document provides a comprehensive functional and architectural catalog of all active, working features within the **Focus Flair** web platform.

---

## 1. Feature Catalog Overview

| Module | Features Included | Primary User Roles |
| :--- | :--- | :--- |
| **1. Authentication & Multi-Tenancy** | Multi-role registration (Student, Institute Admin), Institute Code linking, JWT authentication, persistent sessions, route guards | Student, Admin |
| **2. Exam Management & Creation** | Exam builder, multi-question drafting, marking schemes (+/- marks), schedule windows, instructions & rule definitions, auto-code generation | Admin |
| **3. Live Examination Engine** | Alphanumeric entry verification, full-screen examination sandbox, question navigation palette, autosave attempt pipeline, review flagging, countdown timer | Student |
| **4. Anti-Cheat & Real-time Proctoring** | Client-side visibility & blur tracking, distributed deduplication, live Socket.IO alerts, automated CAS auto-submit, proctor revert override | Student, Admin |
| **5. Live Monitoring Command Center** | Real-time examinee roster, active session telemetry, incident stream, instant auto-submit revert dialog, live presence updates | Admin |
| **6. Performance Analytics & Review** | Chronological score/accuracy trend charts, topic accuracy distribution, weak topic detection, exam scorecards, question-by-question review with explanations | Student |
| **7. Adaptive Practice Mode** | Syllabus topic hierarchy, adaptive difficulty unlocking (Easy → Medium → Hard), streak bonus multiplier, real-time feedback & explanation | Student |
| **8. Question Ingestion & Bulk CSV** | Single question creator, CSV drag-and-drop parser, sample template injection, bulk database insertion, topic auto-provisioning | Admin |
| **9. Previous Year Questions (PYQs)** | Year & exam multi-filtering, interactive paper solver, immediate scoring, question explanations, official paper resource linking, admin CRUD & publishing | Student, Admin |
| **10. Gamification, Badges & Points** | Dynamic badge evaluation engine, automatic point rewards, locked/unlocked achievement showcase, streak tracking | Student |
| **11. Periodic Leaderboard** | Periodic window filtering (Weekly, Monthly, All-Time), podium medals, dynamic points aggregation, snapshot support | Student |
| **12. Syllabus Manager** | Hierarchical curriculum configuration (Class → Subject → Topic), dynamic synchronization across builder and practice modules | Admin |
| **13. Announcements & Notices** | Targeted role posting (All, Student, Admin), pin-to-top support, publish/expiry scheduling, live dashboard feed | Student, Admin |
| **14. User & Institute Profiles** | Student profile management, admin institute details editing, student directory search, scorebook inspection | Student, Admin |

---

## 2. Detailed Functional Breakdown

### 2.1 Authentication & Multi-Tenancy
* **Multi-Role Registration (`/register`)**:
  - **Student Mode**: Captures Name, Email, Password, Class Level (Class 11, Class 12, Dropper), Target Exam (JEE, NEET, GATE), and optional Institute Code.
  - **Institute Admin Mode**: Onboards a new institution by capturing Institute Name, custom code, Admin credentials, and provisions an isolated tenant scope.
* **Stateless JWT Security**: Issues a digitally signed JSON Web Token (24h validity) containing `userId`, `role`, and `instituteId`. Tokens are verified on every protected HTTP request and Socket.IO handshake.
* **Role-Based Guards (`ProtectedRoute.tsx`)**: Enforces strict client-side and server-side authorization. Unauthenticated requests redirect to `/login`, while unauthorized role attempts redirect to respective dashboards.

---

### 2.2 Exam Creation & Scheduling (`/admin/create-exam`)
* **Flexible Metadata**:
  - Title, Exam Type (Mock, Unit Test, Practice), Class Level.
  - Duration configuration in minutes.
  - Start and End schedule timestamps.
  - Custom rules and anti-cheat instructions.
* **Integrated Question Builder**:
  - Add questions dynamically with Subject, Topic, Difficulty, Question Text, Options A-D, Correct Option selector, positive marks (e.g. +4), and negative deduction marks (e.g. -1).
* **Automatic Code Provisioning**:
  - When published, the system automatically assigns an alphanumeric code (e.g., `JEE2024-T1`) used by students to enter the exam.

---

### 2.3 Live Examination Engine (`/exam/live`)
* **Entry Code Verification (`/student/exam/instructions`)**:
  - Validates the exam code, checks assignment eligibility, verifies scheduled windows, and captures client entry metadata (screen dimensions, timezone, user-agent).
* **Examination Workspace**:
  - Clean, distraction-free, full-screen UI.
  - Server-synchronized countdown timer with automatic submission on expiration.
  - Interactive **Question Palette**:
    - *Green*: Answered
    - *Red*: Visited & Unanswered
    - *Purple*: Marked for Review
    - *Gray*: Not Visited
* **Instant Autosave Pipeline**:
  - Every option selection fires an immediate background mutation to `/api/exams/sessions/attempt`, ensuring zero progress loss in case of browser refresh or power failure.
* **Atomic Submission**:
  - Employs Compare-And-Swap (CAS) locking to ensure tests can only be submitted once, preventing duplicate submissions or race conditions.

---

### 2.4 Anti-Cheat & Real-Time Proctoring
* **Tab Switch & Window Blur Detection**:
  - Monitored using browser `visibilitychange` and `window.onblur` listeners.
* **Sliding-Window Deduplication**:
  - Redis-backed deduplication leases prevent false burst triggers when window transitions occur rapidly.
* **Graduated Warning System**:
  - 1st to 3rd violation: Displays a warning dialog to the examinee and dispatches a high-priority WebSocket alert to the admin proctoring console.
  - 4th violation: Automatically locks the test, marks the session as `auto_submitted`, and immediately evicts the student from the live test environment.
* **Proctor Revert Override**:
  - Admins can investigate auto-submitted sessions in real time and click **Revert Submission** to restore the session to `active` if the violation was determined to be accidental.

---

### 2.5 Live Monitoring Command Center (`/admin/monitoring`)
* **WebSocket Pub/Sub Integration**:
  - Connects to exam-specific Socket.IO rooms (`exam:<examId>`).
* **Real-time Live Examinees Roster**:
  - Displays each student currently taking the test, start time, and current tab-switch count.
* **Auto-Submitted Sessions Ledger**:
  - Lists locked sessions with violation counts, start times, and submission timestamps.
* **Incident Audit Stream**:
  - Chronological live feed logging all security events with student email, timestamp, and severity level.

---

### 2.6 Performance Analytics & Scorecard Review (`/student/analytics`)
* **Chronological Exam Trend Line**:
  - Plots student exam scores and accuracy percentages across all submitted exam sessions over time.
* **Topic Accuracy Distribution**:
  - Bar chart measuring percentage accuracy across all attempted topics.
* **Recommended Focus Topics**:
  - Automated detection highlighting topics where accuracy falls below 60%.
* **Exam Scorecards & Historical Ledger**:
  - Detailed table showing Exam Title, Submission Date, Score Obtained, Accuracy %, and Percentile.
* **Interactive Question Review Modal**:
  - Inspect every question from any submitted session.
  - Filter by **All**, **Correct**, **Incorrect**, or **Skipped**.
  - Review your selected choice versus the verified correct answer, points scored/lost, and in-depth explanations.

---

### 2.7 Adaptive Practice Mode (`/student/practice`)
* **Topic Selection**:
  - Browse syllabus topics categorized by Class and Subject.
* **Dynamic 3-Tier Difficulty Progression**:
  - **Easy**: Baseline conceptual questions.
  - **Medium**: Unlocks upon solving the required quota of Easy questions.
  - **Hard**: Unlocks upon mastering Medium difficulty.
* **Streak & Points Multipliers**:
  - Consecutive correct answers earn streak bonuses on top of standard base question points.
* **Instant Explanations**:
  - Immediate correct/incorrect feedback with full explanations.

---

### 2.8 Bulk Question Ingestion & CSV Processor
* **Admin Dashboard Quick Upload (`/admin`)**:
  - Direct modal on the main dashboard for rapid question ingestion.
* **Full Practice Builder (`/admin/create-practice`)**:
  - Single question builder or CSV bulk ingestion.
* **Intelligent CSV Parser**:
  - Handles escaped quotes, commas, and line breaks.
  - Supports standard `Question,OptionA,OptionB,OptionC,OptionD,Correct` schemas.
  - Automatically provisions new topics if they do not yet exist.

---

### 2.9 Previous Year Questions (PYQs) (`/student/pyq` & `/admin/pyq`)
* **Multi-Exam Repository**:
  - Pre-seeded with authentic questions from JEE Main, NEET, and GATE.
* **Direct Open PDF**:
  - One-click action to open official past-year question paper PDFs directly in a new browser tab.
  - Zero quiz/solve distractions — purely dedicated to viewing and studying official exam PDFs.
* **Official Resource Links**:
  - Direct external links to official examination portals for complete downloadable papers.
* **Admin Paper Management**:
  - Admins can create new PYQ sets, upload question lists, toggle publish/unpublish status, and delete old papers.

---

### 2.10 Gamification, Badges & Points Engine
* **Automatic Achievement Unlocks**:
  - `FIRST_EXAM`: Awarded upon submitting your first live test.
  - `CENTURY_CLUB`: Awarded upon crossing 100 total platform points.
  - `HIGH_ACCURACY`: Awarded upon scoring 80%+ accuracy on any test or practice session.
  - `STREAK_WARRIOR`: Awarded for maintaining a 3-day practice streak.
  - `PRACTICE_CHAMP`: Awarded for solving 10+ practice questions.
  - `TOPIC_MASTER`: Awarded for achieving 90%+ mastery in any topic.
* **Asynchronous & Real-time Evaluation**:
  - Evaluated in background BullMQ workers upon exam submission and immediately during practice mode.
* **Badges Showcase (`/student/profile`)**:
  - Visual cards with achievement icons, unlock dates, bonus points awarded, and unlock progress bar.

---

### 2.11 Dynamic Leaderboard (`/student/leaderboard`)
* **Time-Window Filtering**:
  - **Weekly**: Aggregates points earned strictly within the trailing 7 days.
  - **Monthly**: Aggregates points earned strictly within the trailing 30 days.
  - **All Time**: Ranks students by cumulative platform points.
* **Podium Presentation**:
  - Visual Gold, Silver, and Bronze medal podium for top 3 examinees.

---

### 2.12 Syllabus & Curriculum Manager (`/admin/syllabus`)
* **Structured Hierarchy**:
  - Create Class Levels (e.g., Class 11, Class 12, Dropper).
  - Add Subjects (e.g., Physics, Chemistry, Mathematics, Biology).
  - Create Topics with associated icon representations.
* **Real-time Invalidation**:
  - Topics created here immediately populate dropdowns in Create Exam, Practice Builder, and Student Dashboard.

---

### 2.13 Notice Board & Announcements (`/admin/notices`)
* **Audience Targeting**:
  - Target announcements to Students Only, Admins Only, or All Users.
* **Pinning & Scheduling**:
  - Pin important notices to the top of the student dashboard.
  - Optional publication dates and expiration timestamps.

---

## 3. Role-Based Permissions Matrix

| Feature / Capability | Public / Unauthenticated | Student Role | Admin / Institute Role |
| :--- | :---: | :---: | :---: |
| View Landing Page (`/`) | ✅ | ✅ | ✅ |
| Register Account (`/register`) | ✅ | ✅ | ✅ |
| Login (`/login`) | ✅ | ✅ | ✅ |
| Student Dashboard (`/student/dashboard`) | ❌ | ✅ | ❌ |
| Start / Take Live Exam (`/exam/live`) | ❌ | ✅ | ❌ |
| View Exam Scorecards & Review | ❌ | ✅ | ❌ |
| Adaptive Practice Drills | ❌ | ✅ | ❌ |
| Open PYQ PDF | ❌ | ✅ | ✅ |
| View Leaderboards | ❌ | ✅ | ✅ |
| Student Profile & Badges | ❌ | ✅ | ❌ |
| Admin Dashboard (`/admin`) | ❌ | ❌ | ✅ |
| Create & Schedule Exams | ❌ | ❌ | ✅ |
| Live Proctoring & Revert Auto-Submits | ❌ | ❌ | ✅ |
| Submitted Exam Scores Audit | ❌ | ❌ | ✅ |
| Create Practice Questions & CSV Upload | ❌ | ❌ | ✅ |
| Add / Manage PYQ Papers | ❌ | ❌ | ✅ |
| Syllabus Configuration | ❌ | ❌ | ✅ |
| Post & Delete Announcements | ❌ | ❌ | ✅ |
| View Student Directory | ❌ | ❌ | ✅ |
| Update Admin Profile | ❌ | ❌ | ✅ |
