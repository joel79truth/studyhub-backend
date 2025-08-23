require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------
// OpenAI setup
// ------------------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ------------------
// CORS CONFIG
// ------------------
app.use(
  cors({
    origin: "*", // allow all origins or replace with your frontend URL
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// ------------------
// MIDDLEWARE
// ------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public")); // serve frontend assets

// ------------------
// DATA FOLDERS
// ------------------
const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

const filesDir = path.join(__dirname, "files");
fs.mkdirSync(filesDir, { recursive: true });

const metadataPath = path.join(__dirname, "data", "metadata.json");
const noteRequestsPath = path.join(dataDir, "note_requests.json");

// ------------------
// NOTE REQUESTS
// ------------------
app.post("/submit-request", (req, res) => {
  const { topic, course, program } = req.body;
  if (!topic || !course || !program) return res.status(400).json({ error: "Missing fields" });

  const request = { topic, course, program, date: new Date().toISOString() };
  let existing = [];
  if (fs.existsSync(noteRequestsPath)) {
    existing = JSON.parse(fs.readFileSync(noteRequestsPath, "utf-8"));
  }
  existing.push(request);
  fs.writeFileSync(noteRequestsPath, JSON.stringify(existing, null, 2));
  res.status(200).json({ message: "Request saved!" });
});

app.get("/api/requests", (req, res) => {
  if (!fs.existsSync(noteRequestsPath)) return res.json({ requests: [] });
  try {
    const requests = JSON.parse(fs.readFileSync(noteRequestsPath, "utf-8"));
    res.json({ requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ requests: [] });
  }
});

// ------------------
// FILE UPLOAD
// ------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, filesDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const cleanName = file.originalname.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
    cb(null, `${timestamp}-${cleanName}`);
  },
});
const upload = multer({ storage });

app.post("/upload", upload.single("file"), (req, res) => {
  const { subject, program, semester } = req.body;
  const file = req.file;
  if (!subject || !program || !semester || !file)
    return res.status(400).json({ message: "Missing fields or file." });

  const fileData = {
    name: file.originalname,
    subject,
    program,
    semester,
    url: `/files/${file.filename}`,
  };

  // Read existing metadata
  let metadata = {};
  if (fs.existsSync(metadataPath)) {
    try {
      metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8") || "{}");
    } catch (err) {
      console.error("Error reading metadata.json:", err);
      metadata = {};
    }
  }

  // Add file to the proper program or basics
  if (program.toLowerCase() === "basics") {
    if (!metadata.basics) metadata.basics = {};
    if (!metadata.basics[semester]) metadata.basics[semester] = {};
    if (!metadata.basics[semester][subject]) metadata.basics[semester][subject] = [];
    metadata.basics[semester][subject].push(fileData);
  } else {
    if (!metadata.programs) metadata.programs = {};
    if (!metadata.programs[program]) metadata.programs[program] = [];
    metadata.programs[program].push(fileData);
  }

  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  res.status(200).json({ message: "Upload successful!", file: fileData });
});

// ------------------
// METADATA ROUTE
// ------------------

app.get("/api/metadata", (req, res) => {
  if (!fs.existsSync(metadataPath)) return res.json({});
  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8") || "{}");
    res.json(metadata);
  } catch (err) {
    console.error("Failed to read metadata.json:", err);
    res.status(500).json({});
  }
});


// ------------------
// FILE VIEW ROUTES
// ------------------
app.get("/view/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(filesDir, filename);

  if (!fs.existsSync(filePath)) return res.status(404).send("File not found");
  res.sendFile(path.join(__dirname, "public", "view.html"));
});

app.get("/files/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(filesDir, filename);

  if (!fs.existsSync(filePath)) return res.status(404).send("File not found");

  const ext = path.extname(filename).toLowerCase();
  if (ext === ".pdf") res.setHeader("Content-Type", "application/pdf");
  else if (ext === ".pptx")
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
  else res.setHeader("Content-Type", "application/octet-stream");

  res.setHeader("Content-Disposition", "inline");
  res.sendFile(filePath);
});

// ------------------
// AI ENDPOINT
// ------------------
app.post("/ai", async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ answer: "No question provided." });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: question }],
      temperature: 0.7,
      max_tokens: 500,
    });
    const aiAnswer = completion.choices[0].message.content.trim();
    res.json({ answer: aiAnswer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ answer: "AI failed to respond." });
  }
});


// ------------------
// START SERVER
// ------------------
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
