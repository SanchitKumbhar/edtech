const asyncHandler = require("express-async-handler");
const LeaderboardSnapshot = require("../models/LeaderboardSnapshot");
const StudentProfile = require("../models/StudentProfile");
const User = require("../models/User");
const Badge = require("../models/Badge");
const StudentBadge = require("../models/StudentBadge");
const ExamSession = require("../models/ExamSession");
const PracticeAttempt = require("../models/PracticeAttempt");
const cache = require("../utils/cache");
const { ensureDefaultBadges, evaluateBadges } = require("../utils/badgeService");

const getLeaderboard = asyncHandler(async (req, res) => {
  const boardType = req.query.boardType || "weekly";
  const cacheKey = `leaderboard:${boardType}`;

  const data = await cache.wrap(cacheKey, 60, async () => {
    // 1. Check for stored snapshot
    const latestSnapshot = await LeaderboardSnapshot.findOne({ boardType })
      .sort({ snapshotDate: -1 })
      .lean();

    if (latestSnapshot) {
      const rows = await LeaderboardSnapshot.find({
        boardType,
        snapshotDate: latestSnapshot.snapshotDate,
      })
        .sort({ rankNo: 1 })
        .limit(100)
        .lean();

      if (rows && rows.length > 0) {
        return { source: "snapshot", boardType, rows };
      }
    }

    // 2. Dynamic generation if snapshot not found
    const allProfiles = await StudentProfile.find()
      .populate({ path: "userId", select: "fullName email" })
      .lean();

    if (boardType === "weekly" || boardType === "monthly") {
      const days = boardType === "weekly" ? 7 : 30;
      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      // Aggregate exam session scores in this window
      const [recentSessions, recentPracticeAttempts] = await Promise.all([
        ExamSession.find({
          status: { $in: ["submitted", "auto_submitted"] },
          submittedAt: { $gte: sinceDate },
        })
          .select("studentId scoreObtained")
          .lean(),
        PracticeAttempt.find({
          attemptedAt: { $gte: sinceDate },
        })
          .select("studentId pointsEarned")
          .lean(),
      ]);

      const pointsMap = new Map();
      recentSessions.forEach((s) => {
        const id = s.studentId?.toString();
        if (id) {
          pointsMap.set(id, (pointsMap.get(id) || 0) + (s.scoreObtained || 0));
        }
      });
      recentPracticeAttempts.forEach((p) => {
        const id = p.studentId?.toString();
        if (id) {
          pointsMap.set(id, (pointsMap.get(id) || 0) + (p.pointsEarned || 0));
        }
      });

      const calculatedRows = allProfiles
        .filter((p) => p.userId)
        .map((p) => {
          const studentIdStr = p.userId._id.toString();
          // Period points, or fallback to an active portion of pointsTotal if brand new
          const periodPoints = pointsMap.get(studentIdStr) ?? Math.round((p.pointsTotal || 0) * (boardType === "weekly" ? 0.35 : 0.7));
          return {
            studentId: p.userId._id,
            name: p.userId.fullName || "Student",
            points: periodPoints,
          };
        })
        .sort((a, b) => b.points - a.points)
        .slice(0, 100)
        .map((row, index) => ({
          ...row,
          rankNo: index + 1,
        }));

      return { source: "dynamic", boardType, rows: calculatedRows };
    }

    // All-time ranking
    const dynamic = await StudentProfile.find()
      .sort({ pointsTotal: -1 })
      .limit(100)
      .populate({ path: "userId", select: "fullName" })
      .lean();

    const rows = dynamic
      .filter((row) => row.userId)
      .map((row, index) => ({
        rankNo: index + 1,
        studentId: row.userId?._id,
        name: row.userId?.fullName || "Student",
        points: row.pointsTotal || 0,
      }));

    return { source: "dynamic", boardType: "allTime", rows };
  });

  return res.status(200).json(data);
});

const createLeaderboardSnapshot = asyncHandler(async (req, res) => {
  const { boardType = "weekly", snapshotDate = new Date() } = req.body;

  const profiles = await StudentProfile.find()
    .sort({ pointsTotal: -1 })
    .populate({ path: "userId", select: "fullName" })
    .lean();

  const docs = [];
  for (let i = 0; i < profiles.length; i += 1) {
    const p = profiles[i];
    if (!p.userId) continue;

    docs.push({
      boardType,
      snapshotDate: new Date(snapshotDate),
      studentId: p.userId._id,
      name: p.userId.fullName || "Student",
      points: p.pointsTotal || 0,
      rankNo: i + 1,
    });
  }

  await LeaderboardSnapshot.deleteMany({ boardType, snapshotDate: new Date(snapshotDate) });
  const inserted = await LeaderboardSnapshot.insertMany(docs);

  await cache.delPattern("leaderboard:*");

  res.status(201).json({ count: inserted.length, boardType, snapshotDate });
});

const getStudentBadges = asyncHandler(async (req, res) => {
  const student = await User.findById(req.params.studentId).select("fullName role email").lean();
  if (!student || student.role !== "student") {
    res.status(404);
    throw new Error("Student not found");
  }

  // Ensure default system badges exist and evaluate student eligibility
  await ensureDefaultBadges();
  await evaluateBadges(req.params.studentId);

  const [allBadges, studentBadges, profile] = await Promise.all([
    Badge.find().lean(),
    StudentBadge.find({ studentId: req.params.studentId }).lean(),
    StudentProfile.findOne({ userId: req.params.studentId }).lean(),
  ]);

  const unlockedMap = new Map();
  studentBadges.forEach((sb) => {
    unlockedMap.set(sb.badgeId.toString(), sb.unlockedAt);
  });

  const badges = allBadges.map((b) => {
    const isUnlocked = unlockedMap.has(b._id.toString());
    return {
      _id: b._id,
      code: b.code,
      title: b.title,
      description: b.description,
      icon: b.icon,
      pointsReward: b.pointsReward,
      isUnlocked,
      unlockedAt: isUnlocked ? unlockedMap.get(b._id.toString()) : null,
    };
  });

  res.status(200).json({
    student,
    profile,
    badges,
    stats: {
      total: badges.length,
      unlockedCount: studentBadges.length,
    },
  });
});

module.exports = {
  getLeaderboard,
  createLeaderboardSnapshot,
  getStudentBadges,
};
