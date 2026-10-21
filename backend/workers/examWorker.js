const { Worker } = require("bullmq");
const { getBullMQConnection } = require("../config/redis");
const ExamSession = require("../models/ExamSession");
const QuestionAttempt = require("../models/QuestionAttempt");
const StudentTopicStat = require("../models/StudentTopicStat");
const LeaderboardSnapshot = require("../models/LeaderboardSnapshot");
const StudentProfile = require("../models/StudentProfile");
const cache = require("../utils/cache");

let worker = null;

const processExamResultJob = async (job) => {
  const { sessionId, examId, studentId } = job.data;
  console.log(`[Worker] Processing exam result for session ${sessionId}...`);

  const session = await ExamSession.findById(sessionId);
  if (!session) {
    console.warn(`[Worker] Session ${sessionId} not found`);
    return { status: "not_found" };
  }

  // 1. Calculate ranks and percentiles across all submitted sessions for this exam
  const allExamSessions = await ExamSession.find({
    examId,
    status: { $in: ["submitted", "auto_submitted"] },
  })
    .select("_id scoreObtained studentId")
    .sort({ scoreObtained: -1 });

  const totalExaminees = allExamSessions.length;
  if (totalExaminees > 0) {
    const studentRankIndex = allExamSessions.findIndex(
      (s) => s._id.toString() === sessionId.toString()
    );

    if (studentRankIndex !== -1) {
      const rankInExam = studentRankIndex + 1;
      // Percentile formula: ((total - rank) / total) * 100
      const percentile = totalExaminees > 1
        ? Math.round(((totalExaminees - rankInExam) / (totalExaminees - 1)) * 100)
        : 100;

      session.rankInExam = rankInExam;
      session.percentile = percentile;
      await session.save();
    }
  }

  // 2. Aggregate student topic stats from question attempts
  const attempts = await QuestionAttempt.find({ sessionId }).populate("questionId", "topic");
  const topicStatsMap = new Map();

  attempts.forEach((a) => {
    const topic = a.questionId?.topic;
    if (!topic) return;

    if (!topicStatsMap.has(topic)) {
      topicStatsMap.set(topic, { total: 0, correct: 0 });
    }
    const stat = topicStatsMap.get(topic);
    stat.total += 1;
    if (a.isCorrect) stat.correct += 1;
  });

  // 3. Update student points and profile in background
  if (session.scoreObtained && session.scoreObtained > 0) {
    await StudentProfile.findOneAndUpdate(
      { userId: studentId },
      { $inc: { pointsTotal: session.scoreObtained } }
    );
  }

  // 4. Invalidate related caches
  await cache.delPattern(`dashboard:student:${studentId}`);
  await cache.delPattern("leaderboard:*");

  console.log(`[Worker] Completed exam result processing for session ${sessionId} (Rank: ${session.rankInExam || 1}/${totalExaminees})`);
  return { status: "processed", rank: session.rankInExam, percentile: session.percentile };
};

const processLeaderboardSnapshotJob = async (job) => {
  const { boardType = "weekly", snapshotDate = new Date() } = job.data;
  console.log(`[Worker] Generating ${boardType} leaderboard snapshot...`);

  const profiles = await StudentProfile.find()
    .sort({ pointsTotal: -1 })
    .populate({ path: "userId", select: "fullName" });

  const docs = [];
  profiles.forEach((p, index) => {
    if (!p.userId) return;
    docs.push({
      boardType,
      snapshotDate: new Date(snapshotDate),
      studentId: p.userId._id,
      name: p.userId.fullName || "Student",
      points: p.pointsTotal || 0,
      rankNo: index + 1,
    });
  });

  await LeaderboardSnapshot.deleteMany({ boardType, snapshotDate: new Date(snapshotDate) });
  const inserted = await LeaderboardSnapshot.insertMany(docs);

  // Invalidate leaderboard cache
  await cache.delPattern("leaderboard:*");

  console.log(`[Worker] Generated ${inserted.length} snapshot records for ${boardType} leaderboard`);
  return { count: inserted.length };
};

const startExamWorker = () => {
  if (worker) return worker;

  try {
    const connection = getBullMQConnection();
    worker = new Worker(
      "exam-processing",
      async (job) => {
        if (job.name === "process-exam-result") {
          return await processExamResultJob(job);
        } else if (job.name === "leaderboard-snapshot") {
          return await processLeaderboardSnapshotJob(job);
        }
        throw new Error(`Unknown job name: ${job.name}`);
      },
      {
        connection,
        concurrency: 5,
      }
    );

    worker.on("completed", (job) => {
      console.log(`[Worker:exam-processing] Job ${job.id} (${job.name}) completed`);
    });

    worker.on("failed", (job, err) => {
      console.error(`[Worker:exam-processing] Job ${job?.id} failed:`, err.message);
    });

    console.log("🛠️ BullMQ Exam Worker started with concurrency 5");
    return worker;
  } catch (err) {
    console.warn("Could not start BullMQ worker (Redis may be offline):", err.message);
    return null;
  }
};

const stopExamWorker = async () => {
  if (worker) {
    console.log("Stopping BullMQ Exam Worker...");
    await worker.close();
    worker = null;
  }
};

module.exports = {
  startExamWorker,
  stopExamWorker,
};
