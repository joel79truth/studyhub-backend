const express = require("express");
const multer = require("multer");
const cors = require("cors");
const dotenv = require("dotenv");
const { v4: uuidv4 } = require("uuid");
const admin = require("firebase-admin");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// ------------------ FIREBASE ADMIN (FCM) ------------------

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});


// Store tokens in memory (OK for now)
const fcmTokens = new Set();

// ------------------ MULTER ------------------

const upload = multer({ storage: multer.memoryStorage() });

// ------------------ STORAGE SETUP ------------------

let db = null;
let supabase = null;
let storageProvider = process.env.STORAGE_PROVIDER || "local";

// ---------- LOCAL (SQLite) ----------
if (storageProvider === "local") {
  const sqlite3 = require("sqlite3").verbose();
  db = new sqlite3.Database("./metadata.db");

  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      program TEXT,
      semester INTEGER,
      subject TEXT,
      filename TEXT,
      path TEXT,
      url TEXT,
      uploaded_at TEXT
    )`);
  });

  console.log("✅ Using LOCAL storage (SQLite)");
}

// ---------- SUPABASE ----------
if (storageProvider === "supabase") {
  const { createClient } = require("@supabase/supabase-js");
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  console.log("✅ Using SUPABASE storage");
}

// ------------------ SAVE FCM TOKEN ------------------

app.post("/save-token", (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: "Missing FCM token" });
  }

  fcmTokens.add(token);
  console.log("📨 FCM token saved:", token);

  res.status(200).json({ message: "Token saved" });
});

// ------------------ UPLOAD ENDPOINT ------------------

app.post("/upload", upload.single("file"), async (req, res) => {
  const { program, semester, subject } = req.body;
  const file = req.file;

  if (!program || !semester || !subject || !file) {
    return res.status(400).json({ message: "Missing required fields or file." });
  }

  // Program validation
  if (!/^Diploma|^Bachelors/i.test(program) && program.toLowerCase() !== "basics") {
    return res.status(400).json({
      message: "Program must start with Diploma or Bachelors, or be Basics.",
    });
  }

  const id = uuidv4();
  const sanitizedName = file.originalname.replace(/\s+/g, "_");
  const filePath = `${program}/${semester}/${subject}/${Date.now()}-${sanitizedName}`;
  let publicUrl = "";

  try {
    // ---------- SUPABASE ----------
    if (storageProvider === "supabase") {
      const { error } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
        });

      if (error) throw error;

      const { data } = supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .getPublicUrl(filePath);

      publicUrl = data.publicUrl;

      const { error: dbError } = await supabase.from("files").insert([
        {
          id,
          program,
          semester,
          subject,
          filename: file.originalname,
          path: filePath,
          url: publicUrl,
          uploaded_at: new Date().toISOString(),
        },
      ]);

      if (dbError) throw dbError;
    }

    // ---------- LOCAL ----------
    else {
      const fs = require("fs");
      const path = require("path");

      const uploadPath = path.join(__dirname, "uploads", filePath);
      fs.mkdirSync(path.dirname(uploadPath), { recursive: true });
      fs.writeFileSync(uploadPath, file.buffer);

      publicUrl = `/uploads/${filePath}`;

      db.run(
        `INSERT INTO files (id, program, semester, subject, filename, path, url, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          program,
          semester,
          subject,
          file.originalname,
          filePath,
          publicUrl,
          new Date().toISOString(),
        ]
      );
    }

    // ------------------ PUSH NOTIFICATION ------------------

    if (fcmTokens.size > 0) {
      await admin.messaging().sendMulticast({
        tokens: Array.from(fcmTokens),
        notification: {
          title: "📚 New Notes Uploaded",
          body: `${subject} notes for Semester ${semester} are now available`,
        },
      });

      console.log("🔔 Push notification sent");
    }

    res.status(200).json({
      message: "✅ Upload successful!",
      id,
      url: publicUrl,
    });
  } catch (err) {
    console.error("❌ Upload error:", err.message);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
});

// ------------------ FETCH METADATA ------------------

app.get("/api/metadata", async (req, res) => {
  try {
    if (storageProvider === "supabase") {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      res.json(data);
    } else {
      db.all("SELECT * FROM files ORDER BY uploaded_at DESC", [], (err, rows) => {
        if (err) {
          return res.status(500).json({ message: "Failed to fetch metadata" });
        }
        res.json(rows);
      });
    }
  } catch (err) {
    console.error("❌ Metadata fetch error:", err.message);
    res.status(500).json({ message: "Failed to fetch metadata" });
  }
});

// ------------------ START SERVER ------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} (mode=${storageProvider})`);
});
