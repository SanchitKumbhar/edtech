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

/**
 * List all admins belonging to the current admin's institute
 */
const getInstituteAdmins = asyncHandler(async (req, res) => {
  let instituteId = req.user.instituteId;
  if (!instituteId) {
    const owned = await Institute.findOne({ adminUserId: req.user._id });
    if (owned) {
      instituteId = owned._id;
      await User.findByIdAndUpdate(req.user._id, { instituteId });
    } else {
      const defaultInst = await Institute.findOne();
      if (defaultInst) {
        instituteId = defaultInst._id;
        await User.findByIdAndUpdate(req.user._id, { instituteId });
      }
    }
  }

  const query = instituteId ? { instituteId, role: "admin" } : { role: "admin" };
  const admins = await User.find(query).select("-passwordHash").sort({ createdAt: 1 }).lean();

  res.status(200).json({
    admins,
    count: admins.length,
    maxAllowed: 5,
    remaining: Math.max(0, 5 - admins.length),
  });
});

/**
 * Create another admin for the current admin's institute (limit 5 per institute)
 */
const createInstituteAdmin = asyncHandler(async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName || !email || !password) {
    res.status(400);
    throw new Error("Full name, email, and password are required");
  }

  if (password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters long");
  }

  let instituteId = req.user.instituteId;
  let institute = null;

  if (instituteId) {
    institute = await Institute.findById(instituteId);
  } else {
    institute = await Institute.findOne({ adminUserId: req.user._id });
    if (!institute) {
      institute = await Institute.findOne();
    }
    if (institute) {
      instituteId = institute._id;
      await User.findByIdAndUpdate(req.user._id, { instituteId });
    }
  }

  if (!instituteId) {
    const newInst = await Institute.create({
      name: "Main Institute",
      code: "MAIN" + Math.floor(100 + Math.random() * 900),
      adminUserId: req.user._id,
    });
    instituteId = newInst._id;
    institute = newInst;
    await User.findByIdAndUpdate(req.user._id, { instituteId });
  }

  // Enforce 5-admin limit per institute
  const currentCount = await User.countDocuments({ instituteId, role: "admin" });
  if (currentCount >= 5) {
    res.status(400);
    throw new Error("Maximum limit of 5 admins reached for this institute. You cannot create more admins.");
  }

  // Check email uniqueness
  const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
  if (existingUser) {
    res.status(409);
    throw new Error("A user with this email address already exists.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const newAdmin = await User.create({
    fullName: fullName.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    role: "admin",
    instituteId,
  });

  await AdminProfile.create({
    userId: newAdmin._id,
    instituteName: institute?.name || "Institute",
  });

  res.status(201).json({
    message: "Admin created successfully",
    admin: {
      _id: newAdmin._id,
      fullName: newAdmin.fullName,
      email: newAdmin.email,
      role: newAdmin.role,
      createdAt: newAdmin.createdAt,
    },
    count: currentCount + 1,
    maxAllowed: 5,
    remaining: Math.max(0, 4 - currentCount),
  });
});

module.exports = {
  registerInstitute,
  validateInstituteCode,
  getMyInstitute,
  updateMyInstitute,
  listPublicInstitutes,
  listAllInstitutes,
  getInstituteAdmins,
  createInstituteAdmin,
};
