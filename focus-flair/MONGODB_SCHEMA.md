# MongoDB Schema - Student Exam Preparation Portal

## Database: exam_prep_db

---

## Collection: users

**Purpose:** Store user authentication and basic info for both students and admins

```json
{
  _id: ObjectId,
  fullName: String (required),
  email: String (required, unique),
  passwordHash: String (required),
  role: String (enum: ["student", "admin"], required),
  isActive: Boolean (default: true),
  lastLoginAt: Date,
  createdAt: Date (default: now),
  updatedAt: Date (default: now)
}
```

**Indexes:**
- `{ email: 1 }` (unique)
- `{ role: 1, isActive: 1 }`
- `{ createdAt: -1 }`

---

## Collection: student_profiles

**Purpose:** Extended student profile with academic details and gamification stats

```json
{
  _id: ObjectId,
  userId: ObjectId (ref: users._id, unique),
  academicProgram: String (e.g., "B.Tech CSE"),
  yearOfStudy: Number,
  batchCode: String (e.g., "A", "B"),
  avatarUrl: String,
  pointsTotal: Number (default: 0),
  currentStreakDays: Number (default: 0),
  levelNo: Number (default: 1),
  rankGlobal: Number,
  examsAttemptedCount: Number (default: 0),
  avgAccuracyPct: Number (default: 0),
  updatedAt: Date
}
```

**Indexes:**
- `{ userId: 1 }` (unique)
- `{ batchCode: 1, rankGlobal: 1 }`
- `{ pointsTotal: -1 }`

---

## Collection: admin_profiles

**Purpose:** Admin-specific settings and preferences

```json
{
  _id: ObjectId,
  userId: ObjectId (ref: users._id, unique),
  avatarUrl: String,
  settings: {
    emailAlertsEnabled: Boolean (default: true),
    strictAntiCheatEnabled: Boolean (default: true),
    darkModeEnabled: Boolean (default: false)
  },
  updatedAt: Date
}
```

**Indexes:**
- `{ userId: 1 }` (unique)

---

## Collection: exams

**Purpose:** Store exam metadata and configuration

```json
{
  _id: ObjectId,
  title: String (required),
  description: String,
  examType: String (e.g., "JEE Mock", "CAT", "Physics Unit Test"),
  durationMinutes: Number (required),
  totalQuestions: Number (default: 0),
  maxMarks: Number,
  markingScheme: {
    positiveMark: Number (default: 4),
    negativeMark: Number (default: 1)
  },
  schedule: {
    startAt: Date,
    endAt: Date
  },
  status: String (enum: ["draft", "scheduled", "live", "completed", "archived"]),
  rules: {
    instructions: String,
    antiCheatWarning: String,
    autoSubmitTabSwitchLimit: Number (default: 5),
    allowReviewMark: Boolean (default: true)
  },
  assignedTo: {
    batchCodes: [String],
    specificStudentIds: [ObjectId]
  },
  createdBy: ObjectId (ref: users._id, admin),
  publishedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `{ status: 1, "schedule.startAt": 1 }`
- `{ createdBy: 1, createdAt: -1 }`
- `{ "assignedTo.batchCodes": 1 }`
- `{ createdAt: -1 }`

---

## Collection: exam_questions

**Purpose:** Store MCQ questions for exams with media support

```json
{
  _id: ObjectId,
  examId: ObjectId (ref: exams._id, required),
  questionNo: Number (required),
  questionType: String (enum: ["mcq_single"], default: "mcq_single"),
  questionText: String (required),
  topic: String,
  difficulty: String (enum: ["easy", "medium", "hard"]),
  marks: Number (required, default: 4),
  negativeMarks: Number (required, default: 1),
  options: [
    {
      _id: ObjectId,
      label: String (enum: ["A", "B", "C", "D"]),
      text: String (required),
      isCorrect: Boolean (default: false)
    }
  ],
  media: {
    imageUrl: String,
    imageName: String,
    videoUrl: String,
    videoName: String
  },
  explanation: String,
  createdAt: Date
}
```

**Indexes:**
- `{ examId: 1, questionNo: 1 }` (unique)
- `{ examId: 1, topic: 1 }`

---

## Collection: exam_assignments

**Purpose:** Track which students are assigned to which exams

```json
{
  _id: ObjectId,
  examId: ObjectId (ref: exams._id, required),
  studentId: ObjectId (ref: users._id, required),
  assignedBy: ObjectId (ref: users._id, admin),
  status: String (enum: ["assigned", "started", "submitted", "expired"], default: "assigned"),
  assignedAt: Date (default: now)
}
```

**Indexes:**
- `{ examId: 1, studentId: 1 }` (unique)
- `{ studentId: 1, status: 1 }`
- `{ examId: 1, status: 1 }`

---

## Collection: exam_sessions

**Purpose:** Track individual student exam attempts and performance

```json
{
  _id: ObjectId,
  examId: ObjectId (ref: exams._id, required),
  studentId: ObjectId (ref: users._id, required),
  status: String (enum: ["active", "submitted", "auto_submitted", "disqualified"], default: "active"),
  startedAt: Date (default: now),
  submittedAt: Date,
  timeTakenSeconds: Number,
  tabSwitchCount: Number (default: 0),
  warningCount: Number (default: 0),
  scoreObtained: Number,
  accuracyPct: Number,
  percentile: Number,
  rankInExam: Number
}
```

**Indexes:**
- `{ examId: 1, studentId: 1 }` (unique)
- `{ examId: 1, status: 1 }`
- `{ studentId: 1, startedAt: -1 }`

---

## Collection: question_attempts

**Purpose:** Store detailed per-question attempt data during exams

```json
{
  _id: ObjectId,
  sessionId: ObjectId (ref: exam_sessions._id, required),
  examId: ObjectId (denormalized for fast queries),
  studentId: ObjectId (denormalized),
  questionId: ObjectId (ref: exam_questions._id, required),
  selectedOptionId: ObjectId (ref: exam_questions.options._id),
  visitStatus: String (enum: ["not_visited", "not_answered", "answered", "review"], default: "not_visited"),
  isMarkedForReview: Boolean (default: false),
  isCorrect: Boolean,
  marksAwarded: Number,
  viewedAt: Date,
  answeredAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `{ sessionId: 1, questionId: 1 }` (unique)
- `{ examId: 1, studentId: 1 }`

---

## Collection: anti_cheat_events

**Purpose:** Log all anti-cheat violations during exams for monitoring

```json
{
  _id: ObjectId,
  sessionId: ObjectId (ref: exam_sessions._id, required),
  examId: ObjectId (required),
  studentId: ObjectId (ref: users._id, required),
  eventType: String (enum: ["tab_switch", "fullscreen_exit", "window_blur", "copy_attempt", "right_click", "devtools_open"], required),
  severity: String (enum: ["low", "medium", "high"], default: "low"),
  payload: Object (optional metadata),
  occurredAt: Date (default: now)
}
```

**Indexes:**
- `{ sessionId: 1, occurredAt: -1 }`
- `{ examId: 1, severity: 1, occurredAt: -1 }`
- `{ studentId: 1, occurredAt: -1 }`

---

## Collection: practice_topics

**Purpose:** Define available practice topics by subject

```json
{
  _id: ObjectId,
  subject: String (e.g., "Physics", "Mathematics", "Chemistry"),
  topicName: String (e.g., "Mechanics", "Algebra", "Optics"),
  icon: String (emoji, e.g., "⚙️", "📐", "🔥"),
  isActive: Boolean (default: true),
  createdAt: Date
}
```

**Indexes:**
- `{ subject: 1, topicName: 1 }` (unique)
- `{ isActive: 1, subject: 1 }`

---

## Collection: practice_questions

**Purpose:** Store MCQ practice questions with difficulty levels (gamified)

```json
{
  _id: ObjectId,
  topicId: ObjectId (ref: practice_topics._id, required),
  difficulty: String (enum: ["easy", "medium", "hard"], required),
  questionText: String (required),
  explanation: String,
  pointsReward: Number (default: 20),
  options: [
    {
      _id: ObjectId,
      label: String (enum: ["A", "B", "C", "D"]),
      text: String (required),
      isCorrect: Boolean (default: false)
    }
  ],
  media: {
    imageUrl: String,
    imageName: String,
    videoUrl: String,
    videoName: String
  },
  createdBy: ObjectId (ref: users._id, admin),
  createdAt: Date
}
```

**Indexes:**
- `{ topicId: 1, difficulty: 1 }`
- `{ createdBy: 1, createdAt: -1 }`

---

## Collection: practice_attempts

**Purpose:** Track student practice question attempts and scores

```json
{
  _id: ObjectId,
  studentId: ObjectId (ref: users._id, required),
  topicId: ObjectId (ref: practice_topics._id, required),
  practiceQuestionId: ObjectId (ref: practice_questions._id, required),
  selectedOptionId: ObjectId (ref: practice_questions.options._id),
  isCorrect: Boolean (required),
  pointsEarned: Number (default: 0),
  attemptedAt: Date (default: now)
}
```

**Indexes:**
- `{ studentId: 1, attemptedAt: -1 }`
- `{ studentId: 1, topicId: 1 }`
- `{ practiceQuestionId: 1, isCorrect: 1 }`

---

## Collection: student_topic_stats

**Purpose:** Aggregate mastery and accuracy stats per student per topic

```json
{
  _id: ObjectId,
  studentId: ObjectId (ref: users._id, required),
  topicId: ObjectId (ref: practice_topics._id, required),
  masteryPct: Number (default: 0),
  accuracyPct: Number (default: 0),
  solvedCount: Number (default: 0),
  totalAttempted: Number (default: 0),
  updatedAt: Date
}
```

**Indexes:**
- `{ studentId: 1, topicId: 1 }` (unique)
- `{ studentId: 1, masteryPct: -1 }`

---

## Collection: badges

**Purpose:** Define achievement badges in the gamification system

```json
{
  _id: ObjectId,
  code: String (unique, e.g., "first_blood", "streak_master"),
  title: String (e.g., "First Blood", "Streak Master"),
  description: String,
  icon: String (emoji or icon name),
  pointsReward: Number (default: 0),
  criteria: Object (conditions to unlock)
}
```

**Indexes:**
- `{ code: 1 }` (unique)

---

## Collection: student_badges

**Purpose:** Track which badges are unlocked by each student

```json
{
  _id: ObjectId,
  studentId: ObjectId (ref: users._id, required),
  badgeId: ObjectId (ref: badges._id, required),
  unlockedAt: Date (default: now)
}
```

**Indexes:**
- `{ studentId: 1, badgeId: 1 }` (unique)
- `{ studentId: 1, unlockedAt: -1 }`

---

## Collection: leaderboard_snapshots

**Purpose:** Store periodic leaderboard snapshots (weekly, monthly, all-time)

```json
{
  _id: ObjectId,
  boardType: String (enum: ["weekly", "monthly", "all_time"], required),
  snapshotDate: Date (required),
  studentId: ObjectId (ref: users._id, required),
  points: Number (required),
  rankNo: Number (required),
  name: String (denormalized for display)
}
```

**Indexes:**
- `{ boardType: 1, snapshotDate: 1, studentId: 1 }` (unique)
- `{ boardType: 1, snapshotDate: 1, rankNo: 1 }`
- `{ boardType: 1, snapshotDate: -1, points: -1 }`

---

## Collection: notices

**Purpose:** Announcements and notices for students/admins

```json
{
  _id: ObjectId,
  title: String (required),
  body: String (required),
  postedBy: ObjectId (ref: users._id, admin),
  targetRole: String (enum: ["student", "admin", "all"], default: "all"),
  isPinned: Boolean (default: false),
  publishAt: Date (default: now),
  expiresAt: Date,
  createdAt: Date
}
```

**Indexes:**
- `{ targetRole: 1, publishAt: -1 }`
- `{ isPinned: 1, publishAt: -1 }`

---

## Collection: monitoring_sessions

**Purpose:** Per-exam monitoring data (test-wise)

**Note:** This can be derived from exam_sessions + anti_cheat_events on-the-fly, or stored separately for quick access.

```json
{
  _id: ObjectId,
  examId: ObjectId (ref: exams._id, unique in this context),
  examTitle: String,
  activeStudentsCount: Number,
  totalStudentsCount: Number,
  warningEventsCount: Number,
  highSeverityCount: Number,
  lastUpdatedAt: Date
}
```

**Indexes:**
- `{ examId: 1 }`

---

## Collection: pyq_sets

**Purpose:** Previous Year Questions organization (future feature)

```json
{
  _id: ObjectId,
  examName: String (e.g., "JEE Advanced"),
  examYear: Number,
  title: String,
  subject: String,
  isPublished: Boolean (default: false),
  createdAt: Date
}
```

**Indexes:**
- `{ examName: 1, examYear: -1 }`

---

## Summary of Key Relationships

- **users** → **student_profiles** (1:1, student role)
- **users** → **admin_profiles** (1:1, admin role)
- **exams** → **exam_questions** (1:many)
- **exams** → **exam_assignments** (1:many)
- **exam_assignments** → **exam_sessions** (1:1 per student per exam)
- **exam_sessions** → **question_attempts** (1:many)
- **exam_sessions** → **anti_cheat_events** (1:many)
- **practice_topics** → **practice_questions** (1:many)
- **practice_questions** → **practice_attempts** (1:many)
- **student_profiles** → **student_topic_stats** (1:many)
- **student_profiles** → **student_badges** (1:many)
- **badges** → **student_badges** (1:many)
- **leaderboard_snapshots** references **student_profiles** (denormalized)

---

## Performance Considerations

1. **Denormalization Strategy:**
   - Store `examId`, `studentId` in `question_attempts` for faster exam-wide queries
   - Store student name in `leaderboard_snapshots` to avoid lookups during ranking display
   - Store `topicId` alongside practice attempts for efficient topic-wise analytics

2. **TTL Indexes (Optional):**
   - `anti_cheat_events` can have TTL if you want auto-deletion after 90 days:
     ```
     db.anti_cheat_events.createIndex({ occurredAt: 1 }, { expireAfterSeconds: 7776000 })
     ```

3. **Aggregation Pipelines for Analytics:**
   - Use aggregation pipeline to compute `student_topic_stats` from `practice_attempts`
   - Use aggregation to build leaderboard snapshots from `student_profiles` + `practice_attempts`

4. **Sharding Recommendation:**
   - Shard `exam_sessions` and `question_attempts` by `examId` for large scale
   - Shard `practice_attempts` by `studentId` for distributed loads

---

## Status Enums Definition

```
User.role: ["student", "admin"]
Exam.status: ["draft", "scheduled", "live", "completed", "archived"]
ExamAssignment.status: ["assigned", "started", "submitted", "expired"]
ExamSession.status: ["active", "submitted", "auto_submitted", "disqualified"]
QuestionAttempt.visitStatus: ["not_visited", "not_answered", "answered", "review"]
PracticeQuestion.difficulty: ["easy", "medium", "hard"]
AntiCheatEvent.eventType: ["tab_switch", "fullscreen_exit", "window_blur", "copy_attempt", "right_click", "devtools_open"]
AntiCheatEvent.severity: ["low", "medium", "high"]
Notice.targetRole: ["student", "admin", "all"]
LeaderboardSnapshot.boardType: ["weekly", "monthly", "all_time"]
```

---

## Example Query Patterns

**Get all students in an exam with their tab switch count:**
```javascript
db.exam_sessions.aggregate([
  { $match: { examId: ObjectId("...") } },
  { $lookup: { from: "users", localField: "studentId", foreignField: "_id", as: "student" } },
  { $project: { studentName: "$student.fullName", tabSwitchCount: 1, status: 1 } }
])
```

**Get per-topic mastery for a student:**
```javascript
db.student_topic_stats.find({ studentId: ObjectId("...") }).sort({ masteryPct: -1 })
```

**Get warning events for an exam (test-wise monitoring):**
```javascript
db.anti_cheat_events.aggregate([
  { $match: { examId: ObjectId("..."), severity: { $in: ["medium", "high"] } } },
  { $lookup: { from: "users", localField: "studentId", foreignField: "_id", as: "student" } },
  { $sort: { occurredAt: -1 } }
])
```

**Get leaderboard for a time period:**
```javascript
db.leaderboard_snapshots.find({
  boardType: "weekly",
  snapshotDate: { $gte: new Date("2026-03-25") }
}).sort({ rankNo: 1 })
```

---

End of MongoDB Schema Document
