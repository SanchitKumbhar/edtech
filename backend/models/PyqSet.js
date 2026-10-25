const mongoose = require("mongoose");

const pyqQuestionSchema = new mongoose.Schema(
  {
    questionNo: {
      type: Number,
      required: true,
    },
    questionText: {
      type: String,
      required: true,
    },
    options: [
      {
        label: {
          type: String,
          enum: ["A", "B", "C", "D"],
          required: true,
        },
        text: {
          type: String,
          required: true,
        },
      },
    ],
    correctOption: {
      type: String,
      enum: ["A", "B", "C", "D"],
      required: true,
    },
    explanation: {
      type: String,
      default: "",
    },
    marks: {
      type: Number,
      default: 4,
    },
  },
  { _id: true }
);

const pyqSetSchema = new mongoose.Schema(
  {
    examName: {
      type: String,
      trim: true,
      required: true,
    },
    examYear: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      trim: true,
      required: true,
    },
    subject: {
      type: String,
      trim: true,
      default: "General",
    },
    description: {
      type: String,
      default: "",
    },
    paperUrl: {
      type: String,
      default: "",
    },
    pdfFileName: {
      type: String,
      default: "",
    },
    pdfData: {
      type: String,
      default: "",
    },
    durationMinutes: {
      type: Number,
      default: 180,
    },
    totalMarks: {
      type: Number,
      default: 100,
    },
    questions: [pyqQuestionSchema],
    isPublished: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "pyq_sets",
    versionKey: false,
  }
);

pyqSetSchema.index({ examName: 1, examYear: -1 });

module.exports = mongoose.models.PyqSet || mongoose.model("PyqSet", pyqSetSchema);
