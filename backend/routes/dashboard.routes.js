const express = require("express");
const { getStudentDashboard, getAdminDashboard } = require("../controllers/dashboard.controller");
const { protect, requireRole } = require("../middleware/auth");
const { resolveTenant } = require("../middleware/tenant");

const router = express.Router();
router.use(resolveTenant);

router.get("/student", protect, requireRole("student"), getStudentDashboard);
router.get("/admin", protect, requireRole("admin"), getAdminDashboard);

module.exports = router;
