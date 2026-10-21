/*
  Script: create-exam-and-practice-from-csv.js
  Usage: node create-exam-and-practice-from-csv.js <csvFilePath>
  Description: Reads questions from a CSV and creates an Exam and Practice Questions under a specific user.
*/

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { connectDB } = require("../config/db");

const Exam = require("../models/Exam");
const ExamQuestion = require("../models/ExamQuestion");
const PracticeTopic = require("../models/PracticeTopic");
const PracticeQuestion = require("../models/PracticeQuestion");

const USER_ID = "69ca7b2550ca8eca07d00242"; // Owner of the questions
const DEFAULT_TOPIC = "Linear Equations";
const DEFAULT_SUBJECT = "Mathematics";
const DEFAULT_CLASS = "Class 11";
const DEFAULT_DIFFICULTY = "medium";
const DEFAULT_DURATION = 60;

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const cols = line.split(",");
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cols[i] ? cols[i].trim() : "";
    });
    return obj;
  });
}

async function ensurePracticeTopic() {
  let topic = await PracticeTopic.findOne({
    classLevel: DEFAULT_CLASS,
    subject: DEFAULT_SUBJECT,
    topicName: DEFAULT_TOPIC,
  });
  if (!topic) {
    topic = await PracticeTopic.create({
      classLevel: DEFAULT_CLASS,
      subject: DEFAULT_SUBJECT,
      topicName: DEFAULT_TOPIC,
      isActive: true,
      practiceCountEasy: 10,
      practiceCountMedium: 10,
      practiceCountHard: 10,
      easyToMediumUnlockCount: 5, // e.g. must solve 5 easy to unlock medium
      mediumToHardUnlockCount: 5, // e.g. must solve 5 medium to unlock hard
    });
  } else {
    // Update streak thresholds if needed
    topic.easyToMediumUnlockCount = 5;
    topic.mediumToHardUnlockCount = 5;
    topic.practiceCountEasy = 10;
    topic.practiceCountMedium = 10;
    topic.practiceCountHard = 10;
    await topic.save();
  }
  return topic;
  // Cleanup previous script data (exams, questions, practice questions by this user/topic)
  console.log("Cleaning up previous script data...");
  await Exam.deleteMany({ title: "Linear Equations Auto Exam", createdBy: USER_ID });
  const oldExams = await Exam.find({ title: "Linear Equations Auto Exam", createdBy: USER_ID });
  const oldExamIds = oldExams.map(e => e._id);
  if (oldExamIds.length) {
    await ExamQuestion.deleteMany({ examId: { $in: oldExamIds } });
  }
  await PracticeQuestion.deleteMany({ topicId: topic._id, createdBy: USER_ID });
}

async function main() {
  const csvFile = process.argv[2];
  if (!csvFile) {
    console.error("Usage: node create-exam-and-practice-from-csv.js <csvFilePath>");
    process.exit(1);
  }
  await connectDB();
  const questions = parseCSV(csvFile);
  const topic = await ensurePracticeTopic();

  // Create Exam
  const exam = await Exam.create({
    title: "Linear Equations Auto Exam",
    description: "Auto-created from CSV",
    examType: "practice",
    classLevel: DEFAULT_CLASS,
    examCode: `EX${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    durationMinutes: DEFAULT_DURATION,
    totalQuestions: questions.length,
    maxMarks: questions.length * 4,
    markingScheme: { positiveMark: 4, negativeMark: 1 },
    status: "live",
    createdBy: USER_ID,
    publishedAt: new Date(),
  });

  // Insert Questions (skip if any option is missing or empty)
  let insertedCount = 0;
  const total = questions.length;
  for (let i = 0; i < total; i++) {
    const q = questions[i];
    if (!q.option_a || !q.option_b || !q.option_c || !q.option_d) {
      console.warn(`Skipping question at row ${i + 2} due to missing options.`);
      continue;
    }
    // Assign difficulty by index: first 1/3 easy, next 1/3 medium, last 1/3 hard
    let difficulty = "medium";
    if (i < total / 3) difficulty = "easy";
    else if (i >= (2 * total) / 3) difficulty = "hard";
    // ExamQuestion
    await ExamQuestion.create({
      examId: exam._id,
      questionNo: insertedCount + 1,
      questionType: "mcq_single",
      questionText: q["Question "] || q["Question"],
      topic: DEFAULT_TOPIC,
      subject: DEFAULT_SUBJECT,
      difficulty,
      marks: 4,
      negativeMarks: 1,
      options: [
        { label: "A", text: q.option_a, isCorrect: q.Answer === q.option_a },
        { label: "B", text: q.option_b, isCorrect: q.Answer === q.option_b },
        { label: "C", text: q.option_c, isCorrect: q.Answer === q.option_c },
        { label: "D", text: q.option_d, isCorrect: q.Answer === q.option_d },
      ],
      explanation: "",
    });
    // PracticeQuestion
    await PracticeQuestion.create({
      topicId: topic._id,
      difficulty,
      questionText: q["Question "] || q["Question"],
      options: [
        { label: "A", text: q.option_a, isCorrect: q.Answer === q.option_a },
        { label: "B", text: q.option_b, isCorrect: q.Answer === q.option_b },
        { label: "C", text: q.option_c, isCorrect: q.Answer === q.option_c },
        { label: "D", text: q.option_d, isCorrect: q.Answer === q.option_d },
      ],
      createdBy: USER_ID,
    });
    insertedCount++;
  }
  console.log(`Created exam and ${insertedCount} questions for user ${USER_ID}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
