
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const dotenv = require("dotenv");
const { v4: uuidv4 } = require("uuid");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));// server.js


// Configure multer (store files in memory for Supabase uploads)
const upload = multer({ storage: multer.memoryStorage() });

let db = null;
let supabase = null;
let storageProvider = process.env.STORAGE_PROVIDER || "local";

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

// ------------------ UPLOAD ENDPOINT ------------------

app.post("/upload", upload.single("file"), async (req, res) => {
  const { program, semester, subject } = req.body;
  const file = req.file;

  if (!program || !semester || !subject || !file) {
    return res.status(400).json({ message: "Missing required fields or file." });
  }

  // ✅ Enforce program must start with Diploma or Bachelors, or be Basics
  if (!/^Diploma|^Bachelors/i.test(program) && program.toLowerCase() !== "basics") {
    return res.status(400).json({
      message: "Program must start with 'Diploma' or 'Bachelors', or be 'Basics'."
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
        .from(process.env.SUPABASE_BUCKET)
        .upload(path, file.buffer, {
          contentType: file.mimetype,
        });

      if (error) throw error;

      // Get public URL
      const { data } = supabase
        .storage
        .from(process.env.SUPABASE_BUCKET)
        .getPublicUrl(path);

      publicUrl = data.publicUrl;

      // Save metadata in Supabase Postgres
      const { error: dbError } = await supabase.from("files").insert([
        {
          id,
          program,
          semester,
          subject,
          filename: file.originalname,
          path,
          url: publicUrl,
        },
      ]);

      if (dbError) throw dbError;
    } else {
      // Save locally
      const fs = require("fs");
      const pathModule = require("path");
      const uploadPath = pathModule.join(__dirname, "uploads", path);
      fs.mkdirSync(pathModule.dirname(uploadPath), { recursive: true });
      fs.writeFileSync(uploadPath, file.buffer);

      publicUrl = `/uploads/${path}`;

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
      const { data, error } = await supabase.from("files").select("*").order("uploaded_at", { ascending: false });
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

// ------------------ START SERVER ------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} (mode=${storageProvider})`);
});
