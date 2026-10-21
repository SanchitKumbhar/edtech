const asyncHandler = require("express-async-handler");
const Exam = require("../models/Exam");
const ExamQuestion = require("../models/ExamQuestion");
const ExamAssignment = require("../models/ExamAssignment");
const ExamSession = require("../models/ExamSession");
const QuestionAttempt = require("../models/QuestionAttempt");
const cache = require("../utils/cache");
const { enqueueExamResultProcessing } = require("../config/queue");

// Grace period for network latency / clock skew during exam submission (seconds)
const EXAM_GRACE_PERIOD_MS = 30 * 1000;

// List all submitted exam sessions with scores, filterable by examId
const listSubmittedExamScores = asyncHandler(async (req, res) => {
  const { examId } = req.query;
  const filter = { status: "submitted" };
  if (req.instituteId) filter.instituteId = req.instituteId;
  if (examId) filter.examId = examId;
  const sessions = await ExamSession.find(filter)
    .populate("studentId", "fullName email")
    .populate("examId", "title")
    .sort({ submittedAt: -1 })
    .lean();
  res.status(200).json(sessions);
});

const shuffleArray = (items = []) => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const generateExamCode = () => `EX${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const generateUniqueExamCode = async () => {
  let code = generateExamCode();
  let exists = await Exam.exists({ examCode: code });
  let attempts = 0;

  while (exists && attempts < 10) {
    code = generateExamCode();
    exists = await Exam.exists({ examCode: code });
    attempts += 1;
  }

  if (exists) {
    throw new Error("Unable to generate unique exam code. Please retry.");
  }

  return code;
};

const createExam = asyncHandler(async (req, res) => {
  const payload = {
    ...req.body,
    createdBy: req.user._id,
    instituteId: req.instituteId || req.user.instituteId,
  };

  let createdExam = null;
  let attempts = 0;

  while (!createdExam && attempts < 5) {
    try {
      payload.examCode = await generateUniqueExamCode();
      createdExam = await Exam.create(payload);
    } catch (error) {
      if (error?.code === 11000) {
        attempts += 1;
        continue;
      }
      throw error;
    }
  }

  if (!createdExam) {
    res.status(500);
    throw new Error("Failed to create exam with unique code. Please retry.");
  }

  await cache.delPattern("exams:*");
  res.status(201).json(createdExam);
});

const validateExamCodeEntry = asyncHandler(async (req, res) => {
  const examCode = String(req.body?.examCode || "").trim().toUpperCase();
  if (!examCode) {
    res.status(400);
    throw new Error("examCode is required");
  }

  const filter = { examCode };
  if (req.user?.instituteId) {
    filter.instituteId = req.user.instituteId;
  }

  const exam = await Exam.findOne(filter).lean();
  if (!exam) {
    res.status(404);
    throw new Error("Invalid exam code or exam does not belong to your institute");
  }

  res.status(200).json({
    exam: {
      _id: exam._id,
      title: exam.title,
      totalQuestions: exam.totalQuestions,
      durationMinutes: exam.durationMinutes,
      markingScheme: exam.markingScheme,
      rules: exam.rules,
      schedule: exam.schedule,
      examCode: exam.examCode,
    },
  });
});

const listExams = asyncHandler(async (req, res) => {
  const status = req.query.status;
  const tenantPrefix = req.instituteId ? req.instituteId.toString() : "all";
  const cacheKey = `exams:list:${tenantPrefix}:${status || "all"}`;

  const exams = await cache.wrap(cacheKey, 60, async () => {
    const filter = {};
    if (req.instituteId) {
      filter.instituteId = req.instituteId;
    }
    if (status) {
      filter.status = status;
    }
    return await Exam.find(filter).sort({ createdAt: -1 }).lean();
  });

  res.status(200).json(exams);
});

const getExamById = asyncHandler(async (req, res) => {
  const examId = req.params.examId || req.params.id;
  const cacheKey = `exams:detail:${examId}`;

  const exam = await cache.wrap(cacheKey, 60, async () => {
    return await Exam.findById(examId).lean();
  });

  if (!exam) {
    res.status(404);
    throw new Error("Exam not found");
  }

  // Cross-tenant protection
  if (
    req.user.role !== "superadmin" &&
    exam.instituteId &&
    req.user.instituteId &&
    exam.instituteId.toString() !== req.user.instituteId.toString()
  ) {
    res.status(403);
    throw new Error("Forbidden: This exam belongs to another institute");
  }

  res.status(200).json(exam);
});

  if (!exam) {
    res.status(404);
    throw new Error("Exam not found");
  }

  res.status(200).json(exam);
});

const updateExam = asyncHandler(async (req, res) => {
  const examId = req.params.examId || req.params.id;
  const payload = { ...req.body };
  if (payload.examCode) {
    payload.examCode = String(payload.examCode).trim().toUpperCase();
  }

  const exam = await Exam.findByIdAndUpdate(examId, payload, {
    new: true,
    runValidators: true,
  });

  if (!exam) {
    res.status(404);
    throw new Error("Exam not found");
  }

  await cache.delPattern("exams:*");
  res.status(200).json(exam);
});

const deleteExam = asyncHandler(async (req, res) => {
  const examId = req.params.examId || req.params.id;
  const exam = await Exam.findByIdAndDelete(examId);
  if (!exam) {
    res.status(404);
    throw new Error("Exam not found");
  }

  await cache.delPattern("exams:*");
  res.status(200).json({ message: "Exam deleted" });
});

const createExamQuestion = asyncHandler(async (req, res) => {
  const examId = req.params.examId;
  const exam = await Exam.findById(examId);
  if (!exam) {
    res.status(404);
    throw new Error("Exam not found");
  }

  if (!req.body?.topic || !String(req.body.topic).trim()) {
    res.status(400);
    throw new Error("Question topic is required");
  }

  if (!req.body?.difficulty || !["easy", "medium", "hard"].includes(String(req.body.difficulty).toLowerCase())) {
    res.status(400);
    throw new Error("Question difficulty must be one of: easy, medium, hard");
  }

  const question = await ExamQuestion.create({
    ...req.body,
    difficulty: String(req.body.difficulty).toLowerCase(),
    examId,
  });

  await Exam.findByIdAndUpdate(examId, { $inc: { totalQuestions: 1 } });
  await cache.delPattern(`exams:detail:${examId}`);

  res.status(201).json(question);
});

const listExamQuestions = asyncHandler(async (req, res) => {
  const questions = await ExamQuestion.find({ examId: req.params.examId }).lean();

  let orderedQuestions = questions;

  if (req.user.role === "admin") {
    orderedQuestions = [...questions].sort((a, b) => (a.questionNo || 0) - (b.questionNo || 0));
  } else {
    const sessionId = String(req.query.sessionId || "").trim();

    if (sessionId) {
      const session = await ExamSession.findById(sessionId).select("studentId examId questionOrder");
      if (!session) {
        res.status(404);
        throw new Error("Session not found");
      }

      if (session.studentId.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error("Forbidden");
      }

      if (session.examId.toString() !== req.params.examId.toString()) {
        res.status(400);
        throw new Error("Session does not belong to this exam");
      }

      const questionMap = new Map(questions.map((q) => [q._id.toString(), q]));
      let questionOrder = (session.questionOrder || []).map((id) => id.toString());

      if (!questionOrder.length) {
        questionOrder = shuffleArray(questions.map((q) => q._id.toString()));
        session.questionOrder = questionOrder;
        await session.save();
      }

      const ordered = [];
      questionOrder.forEach((id) => {
        const question = questionMap.get(id);
        if (question) {
          ordered.push(question);
          questionMap.delete(id);
        }
      });

      // If admin added new questions after session start, append them in random order.
      const remaining = shuffleArray(Array.from(questionMap.values()));
      orderedQuestions = [...ordered, ...remaining];
    } else {
      orderedQuestions = shuffleArray(questions);
    }
  }

  const safeQuestions = req.user.role === "admin"
    ? orderedQuestions
    : orderedQuestions.map((q) => ({
        _id: q._id,
        examId: q.examId,
        questionNo: q.questionNo,
        questionType: q.questionType,
        questionText: q.questionText,
        topic: q.topic,
        difficulty: q.difficulty,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        media: q.media,
        options: (q.options || []).map((o) => ({ _id: o._id, label: o.label, text: o.text })),
      }));

  res.status(200).json(safeQuestions);
});

const assignExam = asyncHandler(async (req, res) => {
  const { studentIds = [] } = req.body;
  const examId = req.params.examId;

  if (!studentIds.length) {
    res.status(400);
    throw new Error("studentIds is required");
  }

  const created = [];
  for (const studentId of studentIds) {
    const assignment = await ExamAssignment.findOneAndUpdate(
      { examId, studentId },
      { examId, studentId, assignedBy: req.user._id, status: "assigned" },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    created.push(assignment);
  }

  res.status(201).json(created);
});

const listStudentExams = asyncHandler(async (req, res) => {
  const [assignments, sessions] = await Promise.all([
    ExamAssignment.find({ studentId: req.user._id })
      .populate("examId")
      .sort({ assignedAt: -1 })
      .lean(),
    ExamSession.find({ studentId: req.user._id })
      .populate("examId")
      .sort({ startedAt: -1 })
      .lean(),
  ]);

  const mergedByExamId = new Map();

  assignments.forEach((assignment) => {
    if (!assignment.examId?._id) return;
    mergedByExamId.set(String(assignment.examId._id), assignment);
  });

  sessions.forEach((session) => {
    if (!session.examId?._id) return;
    const key = String(session.examId._id);
    const existing = mergedByExamId.get(key);

    if (!existing) {
      mergedByExamId.set(key, {
        _id: session._id,
        examId: session.examId,
        status: session.status === "active" ? "started" : session.status,
        assignedAt: session.startedAt,
        sessionId: session._id,
        scoreObtained: session.scoreObtained,
        accuracyPct: session.accuracyPct,
        submittedAt: session.submittedAt,
      });
      return;
    }

    if (existing.status === "assigned" && session.status && session.status !== "active") {
      existing.status = session.status;
      existing.sessionId = session._id;
      existing.scoreObtained = session.scoreObtained;
      existing.accuracyPct = session.accuracyPct;
      existing.submittedAt = session.submittedAt;
    }
  });

  const result = Array.from(mergedByExamId.values()).sort(
    (a, b) => new Date(b.assignedAt || 0) - new Date(a.assignedAt || 0)
  );

  res.status(200).json(result);
});

const startExamSession = asyncHandler(async (req, res) => {
  const { examId, examCode, entryMeta } = req.body;

  if (!examId || !examCode) {
    res.status(400);
    throw new Error("examId and examCode are required");
  }

  const exam = await Exam.findById(examId).select("examCode durationMinutes schedule status instituteId");
  if (!exam) {
    res.status(404);
    throw new Error("Exam not found");
  }

  if (!exam.examCode) {
    exam.examCode = generateExamCode();
    await exam.save();
  }

  if ((exam.examCode || "").toUpperCase() !== String(examCode).toUpperCase().trim()) {
    res.status(400);
    throw new Error("Invalid exam code");
  }

  const existingSession = await ExamSession.findOne({ examId, studentId: req.user._id }).select("status startedAt");
  if (existingSession && existingSession.status !== "active") {
    res.status(403);
    if (existingSession.status === "auto_submitted") {
      throw new Error("Your test was auto-submitted. You can resume only after admin reverts this submission.");
    }
    throw new Error("This test session is already closed and cannot be started again.");
  }

  const session = await ExamSession.findOneAndUpdate(
    { examId, studentId: req.user._id },
    {
      examId,
      studentId: req.user._id,
      instituteId: exam.instituteId,
      status: "active",
      examCodeUsed: String(examCode).toUpperCase().trim(),
      entryMeta: {
        userAgent: entryMeta?.userAgent,
        platform: entryMeta?.platform,
        language: entryMeta?.language,
        timezone: entryMeta?.timezone,
        screenWidth: entryMeta?.screenWidth,
        screenHeight: entryMeta?.screenHeight,
        enteredAt: new Date(),
        ipAddress: req.ip,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (!session.questionOrder || !session.questionOrder.length) {
    const questionIds = await ExamQuestion.find({ examId }).distinct("_id");
    session.questionOrder = shuffleArray(questionIds.map((id) => id.toString()));
    await session.save();
  }

  res.status(200).json(session);
});

const saveQuestionAttempt = asyncHandler(async (req, res) => {
  const { sessionId, questionId, selectedOptionId, visitStatus, isMarkedForReview } = req.body;

  const session = await ExamSession.findById(sessionId);
  if (!session) {
    res.status(404);
    throw new Error("Session not found");
  }

  if (req.user.role === "student" && session.studentId.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Forbidden");
  }

  // Prevent autosave race conditions during or after submission
  if (session.status !== "active") {
    res.status(400);
    throw new Error("This session is no longer active and cannot accept answer modifications.");
  }

  // Server-side exam timer enforcement
  const exam = await Exam.findById(session.examId).select("durationMinutes");
  if (exam && exam.durationMinutes && session.startedAt) {
    const maxDurationMs = exam.durationMinutes * 60 * 1000 + EXAM_GRACE_PERIOD_MS;
    const elapsedMs = Date.now() - new Date(session.startedAt).getTime();
    if (elapsedMs > maxDurationMs) {
      res.status(403);
      throw new Error("Exam time limit has expired. Answer submission rejected.");
    }
  }

  const question = await ExamQuestion.findById(questionId);
  if (!question) {
    res.status(404);
    throw new Error("Question not found");
  }

  let isCorrect;
  let marksAwarded;
  if (selectedOptionId) {
    const selected = (question.options || []).find((o) => o._id.toString() === selectedOptionId.toString());
    if (!selected) {
      res.status(400);
      throw new Error("Invalid option selected for this question");
    }
    isCorrect = Boolean(selected.isCorrect);
    marksAwarded = isCorrect ? question.marks : -Math.abs(question.negativeMarks || 0);
  }

  const attempt = await QuestionAttempt.findOneAndUpdate(
    { sessionId, questionId },
    {
      sessionId,
      examId: session.examId,
      studentId: session.studentId,
      questionId,
      selectedOptionId: selectedOptionId || undefined,
      visitStatus: visitStatus || (selectedOptionId ? "answered" : "not_answered"),
      isMarkedForReview: Boolean(isMarkedForReview),
      isCorrect,
      marksAwarded,
      answeredAt: selectedOptionId ? new Date() : undefined,
      viewedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(200).json(attempt);
});

const submitExamSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;

  // 1. Atomic Compare-and-Swap status transition: active -> submitting
  // Prevents duplicate submits, race conditions with autosaves, and multiple evaluations.
  const activeSession = await ExamSession.findOneAndUpdate(
    {
      _id: sessionId,
      studentId: req.user._id,
      status: "active",
    },
    {
      $set: { status: "submitting" },
    },
    { new: false }
  );

  // If no active session was found, check if it's already submitted (idempotency check)
  if (!activeSession) {
    const existing = await ExamSession.findById(sessionId);
    if (!existing) {
      res.status(404);
      throw new Error("Session not found");
    }

    if (existing.studentId.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error("Forbidden");
    }

    // Idempotent return: If already submitted or auto-submitted, return the finalized session
    if (["submitted", "auto_submitted"].includes(existing.status)) {
      return res.status(200).json(existing);
    }

    if (existing.status === "submitting") {
      return res.status(409).json({
        message: "Submission is already being processed. Please wait a moment.",
      });
    }

    res.status(400);
    throw new Error("This session is already closed or not in active status.");
  }

  try {
    // 2. Compute final marks accurately from question attempts
    const attempts = await QuestionAttempt.find({ sessionId });
    const score = attempts.reduce((sum, a) => sum + (a.marksAwarded || 0), 0);
    const answered = attempts.filter((a) => a.selectedOptionId).length;
    const correct = attempts.filter((a) => a.isCorrect).length;
    const accuracyPct = answered > 0 ? Math.round((correct / answered) * 100) : 0;

    const submittedAt = new Date();
    const timeTakenSeconds = activeSession.startedAt
      ? Math.max(0, Math.round((submittedAt - new Date(activeSession.startedAt)) / 1000))
      : 0;

    // 3. Finalize session atomically
    const finalizedSession = await ExamSession.findByIdAndUpdate(
      sessionId,
      {
        $set: {
          status: "submitted",
          submittedAt,
          scoreObtained: score,
          accuracyPct,
          timeTakenSeconds,
        },
      },
      { new: true }
    );

    // 4. Update assignment status
    await ExamAssignment.findOneAndUpdate(
      { examId: activeSession.examId, studentId: activeSession.studentId },
      { status: "submitted" }
    );

    // 5. Enqueue background processing for ranks, percentiles, and badges without blocking HTTP response
    await enqueueExamResultProcessing(
      finalizedSession._id,
      finalizedSession.examId,
      finalizedSession.studentId
    );

    // 6. Invalidate relevant caches
    await cache.delPattern(`dashboard:student:${req.user._id}`);
    await cache.delPattern("dashboard:admin");

    res.status(200).json(finalizedSession);
  } catch (submissionErr) {
    // If scoring/finalizing failed unexpectedly, revert status back to active so student can retry
    await ExamSession.findByIdAndUpdate(sessionId, { $set: { status: "active" } });
    throw submissionErr;
  }
});

const getExamSession = asyncHandler(async (req, res) => {
  const session = await ExamSession.findById(req.params.sessionId);
  if (!session) {
    res.status(404);
    throw new Error("Session not found");
  }

  if (req.user.role === "student" && session.studentId.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Forbidden");
  }

  const attempts = await QuestionAttempt.find({ sessionId: session._id }).lean();

  res.status(200).json({ session, attempts });
});

module.exports = {
  createExam,
  validateExamCodeEntry,
  listExams,
  getExamById,
  updateExam,
  deleteExam,
  createExamQuestion,
  listExamQuestions,
  assignExam,
  listStudentExams,
  startExamSession,
  saveQuestionAttempt,
  submitExamSession,
  getExamSession,
  listSubmittedExamScores,
};
