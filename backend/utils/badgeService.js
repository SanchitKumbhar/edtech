const Badge = require("../models/Badge");
const StudentBadge = require("../models/StudentBadge");
const StudentProfile = require("../models/StudentProfile");
const ExamSession = require("../models/ExamSession");
const StudentTopicStat = require("../models/StudentTopicStat");

// Default system badges
const DEFAULT_BADGES = [
  {
    code: "FIRST_EXAM",
    title: "Exam Novice",
    description: "Successfully submitted your first live exam.",
    icon: "🎯",
    pointsReward: 50,
  },
  {
    code: "CENTURY_CLUB",
    title: "Century Club",
    description: "Accumulated 100 or more total points across exams and drills.",
    icon: "💯",
    pointsReward: 30,
  },
  {
    code: "HIGH_ACCURACY",
    title: "Sharp Shooter",
    description: "Achieved 80% or higher accuracy in an exam or practice session.",
    icon: "🏹",
    pointsReward: 40,
  },
  {
    code: "STREAK_WARRIOR",
    title: "Streak Warrior",
    description: "Maintained a practice streak of 3 or more consecutive days.",
    icon: "🔥",
    pointsReward: 35,
  },
  {
    code: "PRACTICE_CHAMP",
    title: "Practice Champion",
    description: "Solved at least 10 practice questions.",
    icon: "⚡",
    pointsReward: 45,
  },
  {
    code: "TOPIC_MASTER",
    title: "Topic Conqueror",
    description: "Attained 90% or higher mastery in any syllabus topic.",
    icon: "👑",
    pointsReward: 60,
  },
];

/**
 * Ensures system default badges exist in the database.
 */
async function ensureDefaultBadges() {
  for (const b of DEFAULT_BADGES) {
    await Badge.findOneAndUpdate(
      { code: b.code },
      { $setOnInsert: b },
      { upsert: true, new: true }
    );
  }
}

/**
 * Evaluates and awards any badges a student qualifies for.
 * @param {string|mongoose.Types.ObjectId} studentId
 * @returns {Promise<Array>} Newly unlocked badges
 */
async function evaluateBadges(studentId) {
  try {
    await ensureDefaultBadges();

    const [profile, allBadges, existingUnlocked, submittedSessions, topicStats] =
      await Promise.all([
        StudentProfile.findOne({ userId: studentId }).lean(),
        Badge.find().lean(),
        StudentBadge.find({ studentId }).select("badgeId").lean(),
        ExamSession.find({
          studentId,
          status: { $in: ["submitted", "auto_submitted"] },
        }).lean(),
        StudentTopicStat.find({ studentId }).lean(),
      ]);

    const unlockedBadgeIdSet = new Set(
      existingUnlocked.map((ub) => ub.badgeId.toString())
    );

    const newlyUnlocked = [];

    for (const badge of allBadges) {
      if (unlockedBadgeIdSet.has(badge._id.toString())) {
        continue;
      }

      let qualified = false;

      switch (badge.code) {
        case "FIRST_EXAM":
          qualified = submittedSessions.length >= 1;
          break;

        case "CENTURY_CLUB":
          qualified = (profile?.pointsTotal || 0) >= 100;
          break;

        case "HIGH_ACCURACY":
          qualified =
            (profile?.avgAccuracyPct || 0) >= 80 ||
            submittedSessions.some((s) => (s.accuracyPct || 0) >= 80);
          break;

        case "STREAK_WARRIOR":
          qualified =
            (profile?.currentStreakDays || 0) >= 3 ||
            (profile?.longestStreakDays || 0) >= 3;
          break;

        case "PRACTICE_CHAMP":
          qualified = (profile?.practiceAttemptCount || 0) >= 10;
          break;

        case "TOPIC_MASTER":
          qualified = topicStats.some((t) => (t.masteryPct || 0) >= 90);
          break;

        default:
          qualified = false;
      }

      if (qualified) {
        await StudentBadge.create({
          studentId,
          badgeId: badge._id,
          unlockedAt: new Date(),
        });

        // Award bonus points and increment badgesCount
        const bonus = badge.pointsReward || 0;
        await StudentProfile.findOneAndUpdate(
          { userId: studentId },
          {
            $inc: {
              badgesCount: 1,
              pointsTotal: bonus,
            },
          }
        );

        newlyUnlocked.push(badge);
      }
    }

    return newlyUnlocked;
  } catch (err) {
    console.error(`[BadgeService] Error evaluating badges for ${studentId}:`, err);
    return [];
  }
}

module.exports = {
  ensureDefaultBadges,
  evaluateBadges,
};
