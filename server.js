require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------
// Middleware
// ------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// ------------------
// Folders
// ------------------
const dataDir = path.join(__dirname, "data");
const filesDir = path.join(__dirname, "public/files");
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(filesDir, { recursive: true });

const metadataPath = path.join(dataDir, "metadata.json");

// Initialize metadata.json if missing or empty
if (!fs.existsSync(metadataPath) || fs.readFileSync(metadataPath, "utf8").trim() === "") {
  fs.writeFileSync(metadataPath, JSON.stringify({ files: [], basics: {}, programs: {} }, null, 2));
}

// ------------------
// Multer Storage
// ------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const program = req.body.program.trim();
    let destDir = filesDir;

    if (program.toLowerCase() !== "basics") {
      const folderName = program.toLowerCase().replace(/\s+/g, "_");
      destDir = path.join(filesDir, folderName);
      fs.mkdirSync(destDir, { recursive: true });
    }

    cb(null, destDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const cleanName = file.originalname.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
    cb(null, `${timestamp}-${cleanName}`);
  }
});

const upload = multer({ storage });

// ------------------
// Upload Route
// ------------------
app.post("/upload", upload.single("file"), (req, res) => {
  const { program, semester, subject } = req.body;
  const file = req.file;

  if (!program || !semester || !subject || !file) {
    return res.status(400).json({ message: "Missing fields or file." });
  }

  // Build file URL
  let fileUrl = `/files/${file.filename}`;
  if (program.toLowerCase() !== "basics") {
    const folderName = program.toLowerCase().replace(/\s+/g, "_");
    fileUrl = `/files/${folderName}/${file.filename}`;
  }

  const fileData = {
    name: file.originalname,
    program,
    semester,
    subject,
    url: fileUrl,
    uploadedAt: new Date().toISOString()
  };

  // Load metadata
  let metadata = { files: [], basics: {}, programs: {} };
  try {
    metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  } catch (err) {
    console.error("Error reading metadata.json, initializing new metadata.", err);
  }

  // Add to flat files array
  metadata.files = metadata.files || [];
  metadata.files.push(fileData);

  // Structured storage
  if (program.toLowerCase() === "basics") {
    metadata.basics[semester] = metadata.basics[semester] || {};
    metadata.basics[semester][subject] = metadata.basics[semester][subject] || [];
    metadata.basics[semester][subject].push(fileData);
  } else {
    metadata.programs[program] = metadata.programs[program] || [];
    metadata.programs[program].push(fileData);
  }

  // Save metadata
  try {
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    res.status(200).json({ message: "Upload successful!", file: fileData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update metadata." });
  }
});

// ------------------
// Metadata API
// ------------------
app.get("/api/metadata", (req, res) => {
  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    res.json(metadata);
  } catch (err) {
    console.error(err);
    res.status(500).json({});
  }
});

// ------------------
// Requests Feature
// ------------------
const requestsPath = path.join(dataDir, "requests.json");

// Initialize requests.json if missing or empty
if (!fs.existsSync(requestsPath) || fs.readFileSync(requestsPath, "utf8").trim() === "") {
  fs.writeFileSync(requestsPath, JSON.stringify([], null, 2));
}

// 📌 Submit new request
app.post("/submit-request", (req, res) => {
  const { topic, course, program, semester, notes, email } = req.body;

  if (!topic || !course || !program || !semester) {
    return res.status(400).json({ message: "All fields are required" });
  }

  let requests = [];
  try {
    requests = JSON.parse(fs.readFileSync(requestsPath, "utf8"));
  } catch (err) {
    console.error("Error reading requests.json:", err);
  }

  const newRequest = {
    topic,
    course,
    program,
    semester,
    notes: notes || "",
    email: email || "",
    createdAt: new Date().toISOString()
  };

  requests.push(newRequest);

  try {
    fs.writeFileSync(requestsPath, JSON.stringify(requests, null, 2));
    res.json({ message: "Request saved!", request: newRequest });
  } catch (err) {
    console.error("Error saving request:", err);
    res.status(500).json({ message: "Failed to save request" });
  }
});

// 📌 Get all requests
app.get("/api/requests", (req, res) => {
  try {
    const requests = JSON.parse(fs.readFileSync(requestsPath, "utf8"));
    res.json({ requests });
  } catch (err) {
    console.error("Error loading requests:", err);
    res.status(500).json({ requests: [] });
  }
});

// 📌 Delete request by index
app.delete("/api/requests/:index", (req, res) => {
  const index = parseInt(req.params.index, 10);

  try {
    let requests = JSON.parse(fs.readFileSync(requestsPath, "utf8"));
    if (index < 0 || index >= requests.length) {
      return res.status(400).json({ message: "Invalid index" });
    }

    requests.splice(index, 1);
    fs.writeFileSync(requestsPath, JSON.stringify(requests, null, 2));

    res.json({ message: "Request deleted successfully" });
  } catch (err) {
    console.error("Error deleting request:", err);
    res.status(500).json({ message: "Failed to delete request" });
  }
});




// ------------------
// Serve Files
// ------------------
app.get("/files/*", (req, res) => {
  const relativePath = req.params[0];
  const filePath = path.join(filesDir, relativePath);

  if (!fs.existsSync(filePath)) return res.status(404).send("File not found");

  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") res.setHeader("Content-Type", "application/pdf");
  else if (ext === ".pptx") res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  else res.setHeader("Content-Type", "application/octet-stream");

  res.setHeader("Content-Disposition", "inline");
  res.sendFile(filePath);
});

// ------------------
// Start Server
// ------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});