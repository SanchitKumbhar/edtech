const bcrypt = require("bcrypt");
const asyncHandler = require("express-async-handler");
const Institute = require("../models/Institute");
const User = require("../models/User");
const AdminProfile = require("../models/AdminProfile");
const Exam = require("../models/Exam");
const { signToken } = require("../utils/auth");

const generateSlug = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

const generateUniqueInstituteCode = async (name) => {
  const prefix = name
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 4)
    .toUpperCase() || "INST";

  let code = `${prefix}${Math.floor(100 + Math.random() * 900)}`;
  let exists = await Institute.exists({ code });
  let attempts = 0;

  while (exists && attempts < 10) {
    code = `${prefix}${Math.floor(100 + Math.random() * 900)}`;
    exists = await Institute.exists({ code });
    attempts += 1;
  }

  return code;
};

/**
 * Self-service registration for a new Institute and its primary Administrator
 */
const registerInstitute = asyncHandler(async (req, res) => {
  const {
    name,
    code,
    contactEmail,
    contactPhone,
    address,
    logoUrl,
    adminName,
    adminEmail,
    adminPassword,
  } = req.body;

  if (!name || !adminName || !adminEmail || !adminPassword) {
    res.status(400);
    throw new Error("Institute name, adminName, adminEmail, and adminPassword are required");
  }

  // Check if admin email is already registered
  const existingUser = await User.findOne({ email: adminEmail.toLowerCase().trim() });
  if (existingUser) {
    res.status(409);
    throw new Error("Admin email already in use");
  }

  // Determine unique code
  let instituteCode = code ? String(code).trim().toUpperCase() : await generateUniqueInstituteCode(name);
  const existingInstitute = await Institute.findOne({ code: instituteCode });
  if (existingInstitute) {
    res.status(409);
    throw new Error("Institute code already in use. Please choose another code.");
  }

  // Determine unique slug
  let slug = generateSlug(name);
  const slugExists = await Institute.exists({ slug });
  if (slugExists) {
    slug = `${slug}-${Math.floor(100 + Math.random() * 900)}`;
  }

  // 1. Create Institute
  const institute = await Institute.create({
    name,
    code: instituteCode,
    slug,
    contactEmail: contactEmail || adminEmail,
    contactPhone,
    address,
    logoUrl,
    plan: "pro",
  });

  // 2. Create Primary Admin User
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const adminUser = await User.create({
    fullName: adminName,
    email: adminEmail.toLowerCase().trim(),
    passwordHash,
    role: "admin",
    instituteId: institute._id,
  });

  // 3. Link createdBy on institute
  institute.createdBy = adminUser._id;
  await institute.save();

  // 4. Create Admin Profile
  const adminProfile = await AdminProfile.create({
    userId: adminUser._id,
    avatarUrl: logoUrl,
  });

  const token = signToken(adminUser);

  res.status(201).json({
    token,
    user: {
      _id: adminUser._id,
      fullName: adminUser.fullName,
      email: adminUser.email,
      role: adminUser.role,
      instituteId: institute._id,
      institute: {
        _id: institute._id,
        name: institute.name,
        code: institute.code,
        slug: institute.slug,
        logoUrl: institute.logoUrl,
      },
      profile: adminProfile,
    },
    institute,
  });
});

/**
 * Validate an institute code for student onboarding
 */
const validateInstituteCode = asyncHandler(async (req, res) => {
  const code = String(req.params.code || "").trim().toUpperCase();
  if (!code) {
    res.status(400);
    throw new Error("Institute code is required");
  }

  const institute = await Institute.findOne({ code, isActive: true })
    .select("_id name code slug logoUrl settings")
    .lean();

  if (!institute) {
    res.status(404);
    throw new Error("Invalid or inactive institute code");
  }

  res.status(200).json({
    valid: true,
    institute,
  });
});

/**
 * Get current institute profile for the logged in institute admin
 */
const getMyInstitute = asyncHandler(async (req, res) => {
  if (!req.user.instituteId) {
    res.status(404);
    throw new Error("No institute associated with this account");
  }

  const institute = await Institute.findById(req.user.instituteId).lean();
  if (!institute) {
    res.status(404);
    throw new Error("Institute not found");
  }

  // Get quick counts
  const [studentCount, examCount] = await Promise.all([
    User.countDocuments({ instituteId: institute._id, role: "student" }),
    Exam.countDocuments({ instituteId: institute._id }),
  ]);

  res.status(200).json({
    ...institute,
    stats: {
      studentCount,
      examCount,
    },
  });
});

/**
 * Update current institute profile and settings
 */
const updateMyInstitute = asyncHandler(async (req, res) => {
  if (!req.user.instituteId) {
    res.status(404);
    throw new Error("No institute associated with this account");
  }

  const allowedUpdates = [
    "name",
    "contactEmail",
    "contactPhone",
    "address",
    "logoUrl",
    "domain",
    "settings",
  ];

  const payload = {};
  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) {
      payload[field] = req.body[field];
    }
  });

  const institute = await Institute.findByIdAndUpdate(req.user.instituteId, payload, {
    new: true,
    runValidators: true,
  });

  res.status(200).json(institute);
});

/**
 * List public active institutes (for student registration selector)
 */
const listPublicInstitutes = asyncHandler(async (req, res) => {
  const institutes = await Institute.find({ isActive: true })
    .select("_id name code slug logoUrl")
    .sort({ name: 1 })
    .limit(100)
    .lean();

  res.status(200).json(institutes);
});

/**
 * Superadmin endpoint: list all institutes with analytics
 */
const listAllInstitutes = asyncHandler(async (req, res) => {
  const institutes = await Institute.find()
    .sort({ createdAt: -1 })
    .lean();

  const enriched = await Promise.all(
    institutes.map(async (inst) => {
      const [students, exams] = await Promise.all([
        User.countDocuments({ instituteId: inst._id, role: "student" }),
        Exam.countDocuments({ instituteId: inst._id }),
      ]);
      return {
        ...inst,
        studentCount: students,
        examCount: exams,
      };
    })
  );

  res.status(200).json(enriched);
});

module.exports = {
  registerInstitute,
  validateInstituteCode,
  getMyInstitute,
  updateMyInstitute,
  listPublicInstitutes,
  listAllInstitutes,
};
