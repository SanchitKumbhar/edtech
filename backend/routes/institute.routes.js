const express = require("express");
const {
  registerInstitute,
  validateInstituteCode,
  getMyInstitute,
  updateMyInstitute,
  listPublicInstitutes,
  listAllInstitutes,
} = require("../controllers/institute.controller");
const { protect, requireRole } = require("../middleware/auth");
const { authRateLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// Public routes
router.post("/register", authRateLimiter, registerInstitute);
router.get("/validate-code/:code", validateInstituteCode);
router.get("/public", listPublicInstitutes);

// Institute Admin routes
router.get("/me", protect, requireRole("admin", "superadmin"), getMyInstitute);
router.put("/me", protect, requireRole("admin", "superadmin"), updateMyInstitute);

// Superadmin routes
router.get("/", protect, requireRole("superadmin"), listAllInstitutes);

module.exports = router;
