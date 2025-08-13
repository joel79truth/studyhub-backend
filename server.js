// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Serve 'data' folder for admin requests.json
app.use('/data', express.static(path.join(__dirname, 'data')));

// ------------------
// NOTE REQUESTS ROUTE
// ------------------
app.post('/submit-request', (req, res) => {
  const { topic, course, program } = req.body;

  if (!topic || !course || !program) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const request = {
    topic,
    course,
    program,
    date: new Date().toISOString()
  };

  const requestsDir = path.join(__dirname, 'data');
  const requestsPath = path.join(requestsDir, 'note_requests.json');

  fs.mkdirSync(requestsDir, { recursive: true });

  let existing = [];
  if (fs.existsSync(requestsPath)) {
    existing = JSON.parse(fs.readFileSync(requestsPath, 'utf-8'));
  }

  existing.push(request);

  fs.writeFileSync(requestsPath, JSON.stringify(existing, null, 2));
  res.status(200).json({ message: "Request saved!" });
});

const noteRequestsPath = path.join(__dirname, 'data', 'note_requests.json');

// GET all note requests
app.get('/api/requests', (req, res) => {
  if (!fs.existsSync(noteRequestsPath)) {
    return res.json({ requests: [] });
  }
  try {
    const requests = JSON.parse(fs.readFileSync(noteRequestsPath, 'utf-8'));
    res.json({ requests });
  } catch (err) {
    console.error('Error reading requests:', err);
    res.status(500).json({ message: 'Failed to read requests' });
  }
});

// DELETE a request by index
app.delete('/api/requests/:index', (req, res) => {
  const index = parseInt(req.params.index, 10);
  if (isNaN(index)) {
    return res.status(400).json({ message: 'Invalid index' });
  }

  if (!fs.existsSync(noteRequestsPath)) {
    return res.status(404).json({ message: 'No requests found' });
  }

  try {
    let requests = JSON.parse(fs.readFileSync(noteRequestsPath, 'utf-8'));
    if (index < 0 || index >= requests.length) {
      return res.status(404).json({ message: 'Request not found' });
    }
    requests.splice(index, 1);
    fs.writeFileSync(noteRequestsPath, JSON.stringify(requests, null, 2));
    res.json({ message: 'Request deleted successfully' });
  } catch (err) {
    console.error('Error deleting request:', err);
    res.status(500).json({ message: 'Failed to delete request' });
  }
});



// ------------------
// FILE UPLOAD ROUTE
// ------------------

// Prepare uploads folder
const filesDir = path.join(__dirname, 'public', 'files');
fs.mkdirSync(filesDir, { recursive: true });

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, filesDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    // Clean filename to avoid spaces or special chars
    const cleanName = file.originalname.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    cb(null, `${timestamp}-${cleanName}`);
  }
});
const upload = multer({ storage });

app.post('/upload', upload.single('file'), (req, res) => {
  const { name, subject, program, semester } = req.body;
  const file = req.file;

  if (!name || !subject || !program || !semester || !file) {
    return res.status(400).json({ message: 'Missing fields or file.' });
  }

  const metadataPath = path.join(__dirname, 'public', 'metadata.json');

  let metadata = { files: [] };
  if (fs.existsSync(metadataPath)) {
    try {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    } catch (err) {
      console.error('Error parsing metadata.json:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  const fileData = {
    name,
    subject,
    program,
    semester,
    url: `files/${file.filename}`
  };

  metadata.files.push(fileData);

  try {
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  } catch (err) {
    console.error('Error writing metadata.json:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }

  res.status(200).json({ message: 'File uploaded successfully.' });
});

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
