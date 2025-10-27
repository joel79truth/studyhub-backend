// server.js
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const dotenv = require("dotenv");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const webpush = require("web-push");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // for sw.js, icons, etc.

const upload = multer({ storage: multer.memoryStorage() });

let db = null;
let supabase = null;
const storageProvider = process.env.STORAGE_PROVIDER || "local";

// ------------------ LOCAL MODE (SQLite) ------------------
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
  console.log("✅ Using LOCAL storage with SQLite");
}

// ------------------ SUPABASE MODE ------------------
if (storageProvider === "supabase") {
  const { createClient } = require("@supabase/supabase-js");
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  console.log("✅ Using SUPABASE storage");
}

// ------------------ WEB PUSH SETUP ------------------
const SUBSCRIPTIONS_FILE = "./subscriptions.json";
if (!fs.existsSync(SUBSCRIPTIONS_FILE)) fs.writeFileSync(SUBSCRIPTIONS_FILE, "[]");

webpush.setVapidDetails(
  "mailto:your@email.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

function sendPushNotification(title, body, url = "/") {
  const subscriptions = JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, "utf-8"));
  const payload = JSON.stringify({ title, body, url, icon: "/icon.png" });

  subscriptions.forEach((sub) => {
    webpush.sendNotification(sub, payload).catch((err) => {
      console.error("❌ Push error:", err.message);
    });
  });
}

// ------------------ SUBSCRIBE ENDPOINT ------------------
app.post("/subscribe", (req, res) => {
  try {
    const subscription = req.body;
    const existing = JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, "utf-8"));
    const already = existing.find((sub) => sub.endpoint === subscription.endpoint);

    if (!already) {
      existing.push(subscription);
      fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(existing, null, 2));
      console.log("✅ New push subscription added");
    }

    res.status(201).json({ message: "Subscribed successfully" });
  } catch (err) {
    console.error("❌ Error saving subscription:", err);
    res.status(500).json({ message: "Failed to save subscription" });
  }
});

// ------------------ UPLOAD ENDPOINT ------------------
app.post("/upload", upload.single("file"), async (req, res) => {
  const { program, semester, subject } = req.body;
  const file = req.file;

  if (!program || !semester || !subject || !file) {
    return res.status(400).json({ message: "Missing required fields or file." });
  }

  if (!/^Diploma|^Bachelors/i.test(program) && program.toLowerCase() !== "basics") {
    return res.status(400).json({
      message: "Program must start with 'Diploma' or 'Bachelors', or be 'Basics'.",
    });
  }

  const id = uuidv4();
  const sanitizedName = file.originalname.replace(/\s+/g, "_");
  const path = `${program}/${semester}/${subject}/${Date.now()}-${sanitizedName}`;
  let publicUrl = "";

  try {
    if (storageProvider === "supabase") {
      // Upload to Supabase Storage
      const { error } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET) // 'files'
        .upload(path, file.buffer, { contentType: file.mimetype });
      if (error) throw error;

      // Get public URL
      const { data } = supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .getPublicUrl(path);

      publicUrl = data.publicUrl;

      // Save metadata to Supabase
      const { error: dbError } = await supabase.from("files").insert([
        {
          id,
          program,
          semester,
          subject,
          filename: file.originalname,
          path,
          url: publicUrl,
          uploaded_at: new Date().toISOString(),
        },
      ]);
      if (dbError) throw dbError;
    } else {
      // Local storage in 'files' folder
      const pathModule = require("path");
      const uploadPath = pathModule.join(__dirname, "files", path); // changed from 'uploads'
      fs.mkdirSync(pathModule.dirname(uploadPath), { recursive: true });
      fs.writeFileSync(uploadPath, file.buffer);
      publicUrl = `/files/${path}`; // public URL for frontend

      db.run(
        `INSERT INTO files (id, program, semester, subject, filename, path, url, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          program,
          semester,
          subject,
          file.originalname,
          path,
          publicUrl,
          new Date().toISOString(),
        ]
      );
    }

    // Send push notification
    sendPushNotification(
      "📘 New File Uploaded!",
      `${program} – Semester ${semester} – ${file.originalname}`,
      `/program-detail.html?program=${encodeURIComponent(program)}`
    );

    res.status(200).json({ message: "✅ Upload successful!", id, url: publicUrl });
  } catch (err) {
    console.error("❌ Upload error:", err.message);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
});

// ------------------ FETCH METADATA ENDPOINT ------------------
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
          console.error(err);
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


console.log("🔍 ENV CHECK:", process.env.SUPABASE_BUCKET, process.env.SUPABASE_URL);

// ------------------ TEST BUCKETS ENDPOINT ------------------
if (storageProvider === "supabase") {
  app.get("/api/buckets", async (req, res) => {
    try {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) throw error;
      res.json({ buckets: data });
    } catch (err) {
      console.error("❌ List buckets error:", err.message);
      res.status(500).json({ message: "Failed to list buckets", error: err.message });
    }
  });
}


app.get("/api/test-supabase", async (req, res) => {
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    res.json({ message: "✅ Supabase connection successful!", buckets: data });
  } catch (err) {
    console.error("❌ Supabase test failed:", err.message);
    res.status(500).json({ message: "Supabase connection failed", error: err.message });
  }
});


// ------------------ START SERVER ------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} (mode=${storageProvider})`);
});
