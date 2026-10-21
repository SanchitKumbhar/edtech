const express = require("express");
const {
  getLeaderboard,
  createLeaderboardSnapshot,
  getStudentBadges,
} = require("../controllers/leaderboard.controller");
const { protect, requireRole } = require("../middleware/auth");
const { resolveTenant } = require("../middleware/tenant");

const router = express.Router();
router.use(resolveTenant);

router.get("/", protect, getLeaderboard);
router.post("/snapshot", protect, requireRole("admin"), createLeaderboardSnapshot);
router.get("/students/:studentId", protect, getStudentBadges);

module.exports = router;
