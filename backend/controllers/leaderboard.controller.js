const asyncHandler = require("express-async-handler");
const LeaderboardSnapshot = require("../models/LeaderboardSnapshot");
const StudentProfile = require("../models/StudentProfile");
const User = require("../models/User");
const cache = require("../utils/cache");
const { enqueueLeaderboardSnapshot } = require("../config/queue");

const getLeaderboard = asyncHandler(async (req, res) => {
  const boardType = req.query.boardType || "weekly";
  const cacheKey = `leaderboard:${boardType}`;

  const data = await cache.wrap(cacheKey, 120, async () => {
    const latestSnapshot = await LeaderboardSnapshot.findOne({ boardType })
      .sort({ snapshotDate: -1 })
      .lean();

    if (latestSnapshot) {
      const rows = await LeaderboardSnapshot.find({
        boardType,
        snapshotDate: latestSnapshot.snapshotDate,
      })
        .sort({ rankNo: 1 })
        .lean();

      return { source: "snapshot", boardType, rows };
    }

    const dynamic = await StudentProfile.find()
      .sort({ pointsTotal: -1 })
      .limit(100)
      .populate({ path: "userId", select: "fullName" })
      .lean();

    const rows = dynamic.map((row, index) => ({
      rankNo: index + 1,
      studentId: row.userId?._id,
      name: row.userId?.fullName || "Student",
      points: row.pointsTotal || 0,
    }));

    return { source: "dynamic", boardType: "all_time", rows };
  });

  return res.status(200).json(data);
});

const createLeaderboardSnapshot = asyncHandler(async (req, res) => {
  const { boardType = "weekly", snapshotDate = new Date() } = req.body;

  // Process synchronously or enqueue to background worker
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

  // Invalidate cache immediately
  await cache.delPattern("leaderboard:*");

  res.status(201).json({ count: inserted.length, boardType, snapshotDate });
});

const getStudentBadges = asyncHandler(async (req, res) => {
  const student = await User.findById(req.params.studentId).select("fullName role").lean();
  if (!student || student.role !== "student") {
    res.status(404);
    throw new Error("Student not found");
  }

  const profile = await StudentProfile.findOne({ userId: req.params.studentId }).lean();

  res.status(200).json({ student, profile });
});

module.exports = {
  getLeaderboard,
  createLeaderboardSnapshot,
  getStudentBadges,
};
