const bcrypt = require("bcrypt");
const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const Institute = require("../models/Institute");
const StudentProfile = require("../models/StudentProfile");
const AdminProfile = require("../models/AdminProfile");
const { signToken } = require("../utils/auth");

const buildUserPayload = async (user) => {
  const base = {
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    instituteId: user.instituteId,
    isActive: user.isActive,
  };

  // Populate institute details if linked
  let institute = null;
  if (user.instituteId) {
    institute = await Institute.findById(user.instituteId)
      .select("_id name code slug logoUrl")
      .lean();
  }
  base.institute = institute;

  if (user.role === "student") {
    const profile = await StudentProfile.findOne({ userId: user._id }).lean();
    return { ...base, profile };
  }

  const profile = await AdminProfile.findOne({ userId: user._id }).lean();
  return { ...base, profile };
};

const register = asyncHandler(async (req, res) => {
  const {
    fullName,
    email,
    password,
    role = "student",
    instituteCode,
    instituteId,
    profile = {},
  } = req.body;

  if (!fullName || !email || !password) {
    res.status(400);
    throw new Error("fullName, email, and password are required");
  }

  if (!["student", "admin"].includes(role)) {
    res.status(400);
    throw new Error("Invalid role");
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    res.status(409);
    throw new Error("Email already in use");
  }

  // Resolve institute
  let resolvedInstituteId = null;

  if (instituteCode) {
    const institute = await Institute.findOne({
      code: String(instituteCode).trim().toUpperCase(),
      isActive: true,
    });
    if (!institute) {
      res.status(400);
      throw new Error(`Invalid or inactive institute code: '${instituteCode}'`);
    }
    resolvedInstituteId = institute._id;
  } else if (instituteId) {
    const institute = await Institute.findById(instituteId);
    if (!institute || !institute.isActive) {
      res.status(400);
      throw new Error("Invalid or inactive institute specified");
    }
    resolvedInstituteId = institute._id;
  }

  // For institute admins registering without an institute code, direct them to register institute
  if (role === "admin" && !resolvedInstituteId) {
    res.status(400);
    throw new Error(
      "To register a new institute, please use POST /api/institutes/register. To join an existing institute as admin, provide a valid instituteCode."
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    fullName,
    email: email.toLowerCase().trim(),
    passwordHash,
    role,
    instituteId: resolvedInstituteId,
  });

  if (role === "student") {
    await StudentProfile.create({
      userId: user._id,
      academicProgram: profile.academicProgram,
      yearOfStudy: profile.yearOfStudy,
      batchCode: profile.batchCode,
      avatarUrl: profile.avatarUrl,
    });
  } else {
    await AdminProfile.create({
      userId: user._id,
      avatarUrl: profile.avatarUrl,
      settings: profile.settings,
    });
  }

  const token = signToken(user);
  const payload = await buildUserPayload(user);

  res.status(201).json({ token, user: payload });
});

const login = asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("email and password are required");
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || !user.isActive) {
    res.status(401);
    throw new Error("Invalid credentials");
  }

  if (role && user.role !== role && user.role !== "superadmin") {
    res.status(403);
    throw new Error("Role mismatch for this account");
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    res.status(401);
    throw new Error("Invalid credentials");
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken(user);
  const payload = await buildUserPayload(user);

  res.status(200).json({ token, user: payload });
});

const me = asyncHandler(async (req, res) => {
  const payload = await buildUserPayload(req.user);
  res.status(200).json(payload);
});

module.exports = {
  register,
  login,
  me,
};
