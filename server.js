require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------
// OpenAI setup
// ------------------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ------------------
// CORS CONFIG
// ------------------
app.use(cors({
  origin: 'https://studyhub-luana.netlify.app',
  methods: ['GET','POST','PUT','DELETE'],
  credentials: true
}));

// ------------------
// MIDDLEWARE
// ------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ------------------
// DATA FOLDERS
// ------------------
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const filesDir = path.join(__dirname, 'public', 'files');
fs.mkdirSync(filesDir, { recursive: true });

// ------------------
// NOTE REQUESTS
// ------------------
const noteRequestsPath = path.join(dataDir, 'note_requests.json');

app.post('/submit-request', (req, res) => {
  const { topic, course, program } = req.body;
  if (!topic || !course || !program) return res.status(400).json({ error: "Missing fields" });

  const request = { topic, course, program, date: new Date().toISOString() };
  let existing = [];
  if (fs.existsSync(noteRequestsPath)) {
    existing = JSON.parse(fs.readFileSync(noteRequestsPath, 'utf-8'));
  }
  existing.push(request);
  fs.writeFileSync(noteRequestsPath, JSON.stringify(existing, null, 2));
  res.status(200).json({ message: "Request saved!" });
});

app.get('/api/requests', (req, res) => {
  if (!fs.existsSync(noteRequestsPath)) return res.json({ requests: [] });
  try {
    const requests = JSON.parse(fs.readFileSync(noteRequestsPath, 'utf-8'));
    res.json({ requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to read requests' });
  }
});

app.delete('/api/requests/:index', (req, res) => {
  const index = parseInt(req.params.index, 10);
  if (isNaN(index)) return res.status(400).json({ message: 'Invalid index' });
  if (!fs.existsSync(noteRequestsPath)) return res.status(404).json({ message: 'No requests found' });

  try {
    const requests = JSON.parse(fs.readFileSync(noteRequestsPath, 'utf-8'));
    if (index < 0 || index >= requests.length) return res.status(404).json({ message: 'Request not found' });
    requests.splice(index, 1);
    fs.writeFileSync(noteRequestsPath, JSON.stringify(requests, null, 2));
    res.json({ message: 'Request deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete request' });
  }
});

// ------------------
// FILE UPLOAD
// ------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, filesDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const cleanName = file.originalname.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    cb(null, `${timestamp}-${cleanName}`);
  }
});
const upload = multer({ storage });

app.post('/upload', upload.single('file'), (req, res) => {
  const { subject, program, semester } = req.body;
  const file = req.file;
  if (!subject || !program || !semester || !file) return res.status(400).json({ message: "Missing fields or file." });

  const fileData = {
    name: file.originalname,
    subject,
    program,
    semester,
    url: `files/${file.filename}`,
  };

  const metadataPath = path.join(__dirname, 'public', 'metadata.json');
  let metadata = {};

  if (fs.existsSync(metadataPath)) {
    try { metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8') || '{}'); } 
    catch (err) { console.error('Error reading metadata.json:', err); metadata = {}; }
  }

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
// AI QUESTION ENDPOINT
// ------------------
app.post('/ai', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ answer: "No question provided." });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: question }],
      temperature: 0.7,
      max_tokens: 500
    });

    const aiAnswer = completion.choices[0].message.content.trim();
    res.json({ answer: aiAnswer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ answer: "AI failed to respond." });
  }
});

// ------------------
// PWA MANIFEST
// ------------------
app.get('/manifest.json', (req, res) => {
  res.type('application/json');
  res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});

// ------------------
// START SERVER
// ------------------
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
