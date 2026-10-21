const mongoose = require("mongoose");
const { applyCascadeDelete } = require("./plugins/cascadeDelete");

const instituteSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    domain: {
      type: String,
      trim: true,
      lowercase: true,
    },
    logoUrl: {
      type: String,
      trim: true,
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    contactPhone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    plan: {
      type: String,
      enum: ["free", "starter", "pro", "enterprise"],
      default: "pro",
    },
    maxStudents: {
      type: Number,
      default: 1000,
    },
    maxConcurrentExams: {
      type: Number,
      default: 25,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    settings: {
      allowStudentSelfRegistration: {
        type: Boolean,
        default: true,
      },
      defaultExamDurationMinutes: {
        type: Number,
        default: 60,
      },
      enableAntiCheatDefault: {
        type: Boolean,
        default: true,
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    collection: "institutes",
    timestamps: true,
  }
);

instituteSchema.index({ isActive: 1 });
instituteSchema.index({ createdAt: -1 });

applyCascadeDelete(instituteSchema, (institute) => [
  {
    model: () => require("./User"),
    action: "deleteMany",
    filter: { instituteId: institute._id },
  },
  {
    model: () => require("./Exam"),
    action: "deleteMany",
    filter: { instituteId: institute._id },
  },
  {
    model: () => require("./Notice"),
    action: "deleteMany",
    filter: { instituteId: institute._id },
  },
  {
    model: () => require("./LeaderboardSnapshot"),
    action: "deleteMany",
    filter: { instituteId: institute._id },
  },
]);

module.exports = mongoose.models.Institute || mongoose.model("Institute", instituteSchema);
