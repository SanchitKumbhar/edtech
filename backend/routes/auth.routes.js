const express = require("express");
const { register, login, me } = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth");
const { authRateLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

router.post("/register", authRateLimiter, register);
router.post("/login", authRateLimiter, login);
router.get("/me", protect, me);

module.exports = router;
