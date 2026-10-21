const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const Exam = require("../models/Exam");
const ExamAssignment = require("../models/ExamAssignment");
const ExamSession = require("../models/ExamSession");
const StudentProfile = require("../models/StudentProfile");
const StudentTopicStat = require("../models/StudentTopicStat");
const Notice = require("../models/Notice");
const LeaderboardSnapshot = require("../models/LeaderboardSnapshot");
const cache = require("../utils/cache");

const getStudentDashboard = asyncHandler(async (req, res) => {
  const studentId = req.user._id.toString();
  const cacheKey = `dashboard:student:${studentId}`;

  const dashboardData = await cache.wrap(cacheKey, 30, async () => {
    const profile = await StudentProfile.findOne({ userId: req.user._id }).lean();

    const [assignments, recentSessions] = await Promise.all([
      ExamAssignment.find({ studentId: req.user._id })
        .populate("examId")
        .sort({ assignedAt: -1 })
        .limit(20)
        .lean(),
      ExamSession.find({ studentId: req.user._id })
        .populate("examId")
        .sort({ startedAt: -1 })
        .limit(20)
        .lean(),
    ]);

    const notices = await Notice.find({
      targetRole: { $in: ["student", "all"] },
      publishAt: { $lte: new Date() },
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    })
      .sort({ isPinned: -1, publishAt: -1 })
      .limit(5)
      .lean();

    const topicStats = await StudentTopicStat.find({ studentId: req.user._id })
      .populate("topicId")
      .sort({ masteryPct: -1 })
      .limit(6)
      .lean();

    const topLeaderboard = await LeaderboardSnapshot.find({ boardType: "weekly" })
      .sort({ snapshotDate: -1, rankNo: 1 })
      .limit(10)
      .lean();

    const recentSession = recentSessions;
    const attempted = recentSession.filter((s) => s.status !== "active");
    const avgAccuracyPct = attempted.length
      ? Math.round(
          attempted.reduce((sum, s) => sum + (s.accuracyPct || 0), 0) / attempted.length
        )
      : 0;

    const upcomingByExamId = new Map();
    assignments.forEach((assignment) => {
      const exam = assignment.examId;
      if (!exam?._id) return;
      if (String(assignment.status || "").toLowerCase() === "submitted") return;
      upcomingByExamId.set(String(exam._id), exam);
    });

    recentSessions.forEach((session) => {
      const exam = session.examId;
      if (!exam?._id) return;
      if (session.status && session.status !== "active") return;
      if (!upcomingByExamId.has(String(exam._id))) {
        upcomingByExamId.set(String(exam._id), exam);
      }
    });

    const upcomingExams = Array.from(upcomingByExamId.values())
      .sort((a, b) => {
        const aDate = new Date(a?.schedule?.startAt || 0).getTime();
        const bDate = new Date(b?.schedule?.startAt || 0).getTime();
        return aDate - bDate;
      })
      .slice(0, 5);

    return {
      profile,
      stats: {
        pointsTotal: profile?.pointsTotal || 0,
        avgAccuracyPct,
        examsAttempted: attempted.length,
        streakDays: profile?.currentStreakDays || 0,
      },
      upcomingExams,
      notices,
      topicStats,
      leaderboardPreview: topLeaderboard,
    };
  });

  res.status(200).json({
    user: req.user,
    ...dashboardData,
  });
});

const getAdminDashboard = asyncHandler(async (req, res) => {
  const cacheKey = "dashboard:admin";

  const adminData = await cache.wrap(cacheKey, 30, async () => {
    const [totalStudents, activeExams, ongoingSessions, recentExams] = await Promise.all([
      User.countDocuments({ role: "student", isActive: true }),
      Exam.countDocuments({ status: { $in: ["scheduled", "live"] } }),
      ExamSession.countDocuments({ status: "active" }),
      Exam.find().sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    return {
      stats: {
        totalStudents,
        activeExams,
        ongoingSessions,
      },
      recentExams,
    };
  });

  res.status(200).json(adminData);
});

module.exports = {
  getStudentDashboard,
  getAdminDashboard,
};
