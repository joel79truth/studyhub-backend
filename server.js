const express = require("express");
const multer = require("multer");
const cors = require("cors");
const dotenv = require("dotenv");
const { v4: uuidv4 } = require("uuid");
const admin = require("firebase-admin");
const { createClient } = require("@supabase/supabase-js");
const { google } = require("googleapis");
const { Readable } = require("stream");
const fs = require("fs");

dotenv.config();

/* ===== LOG ENV VARS ===== */
console.log("FIREBASE:", !!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64);
console.log("SUPABASE:", !!process.env.SUPABASE_URL);
console.log("DRIVE FOLDER:", process.env.GOOGLE_DRIVE_FOLDER_ID);

/* ===== EXPRESS SETUP ===== */
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

/* ===== FIREBASE ===== */
const firebaseAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(firebaseAccount),
});

const fcmTokens = new Set();

/* ===== MULTER ===== */
const upload = multer({ storage: multer.memoryStorage() });

/* ===== SUPABASE ===== */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ===== GOOGLE DRIVE (OAuth 2.0) ===== */
const oauthCreds = JSON.parse(fs.readFileSync("./oauth-client.json"));
const tokens = JSON.parse(fs.readFileSync("./token.json"));

const { client_id, client_secret, redirect_uris } = oauthCreds.installed;
const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
auth.setCredentials(tokens);

const drive = google.drive({ version: "v3", auth });

/* ===== SAVE FCM TOKEN ===== */
app.post("/save-token", (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ message: "Missing token" });

  fcmTokens.add(token);
  res.json({ message: "Token saved" });
});

/* ===== UPLOAD ===== */
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { program, semester, subject } = req.body;
    const file = req.file;

    if (!program || !semester || !subject || !file)
      return res.status(400).json({ message: "Missing fields or file" });

    const USE_GDRIVE = file.size > 50 * 1024; // 50KB threshold
    console.log("FILE SIZE:", file.size, "USE_GDRIVE:", USE_GDRIVE);

    const id = uuidv4();
    const safeName = file.originalname.replace(/\s+/g, "_");
    const filePath = `${program}/${semester}/${subject}/${Date.now()}-${safeName}`;

    let storage_type, storage_ref, publicUrl;

    /* ===== GOOGLE DRIVE ===== */
    if (USE_GDRIVE) {
      const bufferStream = new Readable();
      bufferStream.push(file.buffer);
      bufferStream.push(null);

      const driveRes = await drive.files.create({
        requestBody: {
          name: file.originalname,
          parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
        },
        media: {
          mimeType: file.mimetype,
          body: bufferStream,
        },
      });

      storage_type = "gdrive";
      storage_ref = driveRes.data.id;
      publicUrl = `/api/drive/${storage_ref}`;
    } else {
      /* ===== SUPABASE STORAGE ===== */
      const { error } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .upload(filePath, file.buffer, { contentType: file.mimetype });

      if (error) throw error;

      storage_type = "supabase";
      storage_ref = filePath;
      publicUrl = supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .getPublicUrl(filePath).data.publicUrl;
    }

    /* ===== SAVE METADATA ===== */
    const pathValue = USE_GDRIVE ? storage_ref : filePath;

    const { error: dbError } = await supabase.from("files").insert([{
      id,
      program,
      semester,
      subject,
      filename: file.originalname,
      path: pathValue,
      url: publicUrl,
      storage_type,
      uploaded_at: new Date().toISOString(),
    }]);
    if (dbError) throw dbError;

    /* ===== PUSH NOTIFICATIONS ===== */
    if (fcmTokens.size > 0) {
      await admin.messaging().sendMulticast({
        tokens: [...fcmTokens],
        notification: {
          title: "📚 New Notes Uploaded",
          body: `${subject} notes for Semester ${semester} available`,
        },
      });
    }

    res.json({ message: "Upload successful", url: publicUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
});

/* ===== GOOGLE DRIVE STREAM ===== */
app.get("/api/drive/:fileId", async (req, res) => {
  try {
    const driveRes = await drive.files.get(
      { fileId: req.params.fileId, alt: "media" },
      { responseType: "stream" }
    );
    driveRes.data.pipe(res);
  } catch {
    res.status(404).send("File not found");
  }
});

/* ===== METADATA ===== */
app.get("/api/metadata", async (req, res) => {
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .order("uploaded_at", { ascending: false });

  if (error) return res.status(500).json({ message: "Fetch failed" });
  res.json(data);
});

/* ===== START SERVER ===== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
