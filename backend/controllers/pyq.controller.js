const asyncHandler = require("express-async-handler");
const PyqSet = require("../models/PyqSet");

const SAMPLE_PYQS = [
  {
    examName: "JEE Main",
    examYear: 2024,
    title: "JEE Main 2024 - Physics & Mathematics Session 1",
    subject: "Physics & Math",
    description: "Official questions from JEE Main 2024 January Session with step-by-step solutions.",
    paperUrl: "https://jeemain.nta.ac.in",
    durationMinutes: 180,
    totalMarks: 100,
    isPublished: true,
    questions: [
      {
        questionNo: 1,
        questionText: "A body of mass 2 kg moving with velocity 4 m/s collides elastically with another body of mass 2 kg at rest. What is the velocity of the second body after collision?",
        options: [
          { label: "A", text: "0 m/s" },
          { label: "B", text: "2 m/s" },
          { label: "C", text: "4 m/s" },
          { label: "D", text: "8 m/s" },
        ],
        correctOption: "C",
        explanation: "In a 1D elastic collision between two equal masses, their velocities are completely exchanged. Thus, the initially stationary body moves at 4 m/s.",
        marks: 4,
      },
      {
        questionNo: 2,
        questionText: "The derivative of f(x) = ln(sin(x)) with respect to x is:",
        options: [
          { label: "A", text: "cot(x)" },
          { label: "B", text: "tan(x)" },
          { label: "C", text: "sec(x)" },
          { label: "D", text: "cosec(x)" },
        ],
        correctOption: "A",
        explanation: "f'(x) = (1 / sin(x)) * d/dx(sin(x)) = cos(x) / sin(x) = cot(x).",
        marks: 4,
      },
      {
        questionNo: 3,
        questionText: "If the electric flux through a closed surface is zero, which of the following is necessarily true?",
        options: [
          { label: "A", text: "The electric field is zero everywhere on the surface" },
          { label: "B", text: "The net charge enclosed inside the surface is zero" },
          { label: "C", text: "There are no charges in the vicinity" },
          { label: "D", text: "The potential is constant on the surface" },
        ],
        correctOption: "B",
        explanation: "By Gauss's Law, Total Flux = Q_enclosed / epsilon_0. If flux is zero, the net enclosed charge must be zero.",
        marks: 4,
      },
    ],
  },
  {
    examName: "NEET",
    examYear: 2024,
    title: "NEET 2024 - Chemistry & Biology Highlights",
    subject: "Chemistry & Biology",
    description: "Core questions from NEET 2024 covering Chemical Bonding and Cell Biology.",
    paperUrl: "https://neet.nta.nic.in",
    durationMinutes: 180,
    totalMarks: 100,
    isPublished: true,
    questions: [
      {
        questionNo: 1,
        questionText: "Which of the following molecules has a square planar shape?",
        options: [
          { label: "A", text: "XeF4" },
          { label: "B", text: "CH4" },
          { label: "C", text: "SF4" },
          { label: "D", text: "NH4+" },
        ],
        correctOption: "A",
        explanation: "XeF4 has sp3d2 hybridization with 4 bond pairs and 2 lone pairs situated opposite to each other, resulting in a square planar geometry.",
        marks: 4,
      },
      {
        questionNo: 2,
        questionText: "The powerhouse of the cell responsible for ATP generation is:",
        options: [
          { label: "A", text: "Golgi apparatus" },
          { label: "B", text: "Endoplasmic reticulum" },
          { label: "C", text: "Mitochondria" },
          { label: "D", text: "Ribosome" },
        ],
        correctOption: "C",
        explanation: "Mitochondria perform cellular respiration through oxidative phosphorylation to synthesize ATP.",
        marks: 4,
      },
    ],
  },
  {
    examName: "GATE",
    examYear: 2023,
    title: "GATE CS 2023 - Algorithms & Data Structures",
    subject: "Computer Science",
    description: "Algorithmic analysis and complexity problems from GATE CS 2023.",
    paperUrl: "https://gate2023.iitk.ac.in",
    durationMinutes: 180,
    totalMarks: 100,
    isPublished: true,
    questions: [
      {
        questionNo: 1,
        questionText: "What is the worst-case time complexity of finding the median in an unsorted array of n elements using the Quickselect algorithm?",
        options: [
          { label: "A", text: "O(n)" },
          { label: "B", text: "O(n log n)" },
          { label: "C", text: "O(n^2)" },
          { label: "D", text: "O(1)" },
        ],
        correctOption: "C",
        explanation: "Although average case is O(n), Quickselect can degenerate to O(n^2) in the worst case if unbalanced pivots are repeatedly chosen.",
        marks: 4,
      },
    ],
  },
];

const listPyqSets = asyncHandler(async (req, res) => {
  const filter = req.user?.role === "admin" ? {} : { isPublished: true };
  let sets = await PyqSet.find(filter).sort({ examYear: -1, createdAt: -1 });

  // Auto-seed if empty so the platform is immediately active
  if (sets.length === 0) {
    await PyqSet.insertMany(SAMPLE_PYQS);
    sets = await PyqSet.find(filter).sort({ examYear: -1, createdAt: -1 });
  }

  res.status(200).json(sets);
});

const getPyqSetById = asyncHandler(async (req, res) => {
  const set = await PyqSet.findById(req.params.pyqId);
  if (!set) {
    res.status(404);
    throw new Error("PYQ set not found");
  }

  if (req.user?.role !== "admin" && !set.isPublished) {
    res.status(403);
    throw new Error("This PYQ set is not published yet");
  }

  res.status(200).json(set);
});

const validatePdfPayload = (body) => {
  if (body.pdfFileName && !body.pdfFileName.toLowerCase().endsWith(".pdf")) {
    const err = new Error("Invalid file type: Only PDF files (.pdf) are allowed for PYQ papers.");
    err.statusCode = 400;
    throw err;
  }
  if (body.pdfData && typeof body.pdfData === "string" && body.pdfData.startsWith("data:")) {
    if (!body.pdfData.startsWith("data:application/pdf")) {
      const err = new Error("Invalid file MIME type: Only PDF documents are allowed.");
      err.statusCode = 400;
      throw err;
    }
  }
};

const createPyqSet = asyncHandler(async (req, res) => {
  validatePdfPayload(req.body);
  const set = await PyqSet.create(req.body);
  res.status(201).json(set);
});

const updatePyqSet = asyncHandler(async (req, res) => {
  validatePdfPayload(req.body);
  const set = await PyqSet.findByIdAndUpdate(req.params.pyqId, req.body, {
    new: true,
    runValidators: true,
  });

  if (!set) {
    res.status(404);
    throw new Error("PYQ set not found");
  }

  res.status(200).json(set);
});

const deletePyqSet = asyncHandler(async (req, res) => {
  const set = await PyqSet.findByIdAndDelete(req.params.pyqId);

  if (!set) {
    res.status(404);
    throw new Error("PYQ set not found");
  }

  res.status(200).json({ message: "PYQ set deleted" });
});

module.exports = {
  listPyqSets,
  getPyqSetById,
  createPyqSet,
  updatePyqSet,
  deletePyqSet,
};
