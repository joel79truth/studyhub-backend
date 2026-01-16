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
const fetch = require("node-fetch"); // Add this if not already

dotenv.config();

async function requireAuth(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const token = authHeader.split(" ")[1];
  return await admin.auth().verifyIdToken(token);
}


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



/* ===== MULTER ===== */
const upload = multer({ storage: multer.memoryStorage() });

/* ===== SUPABASE ===== */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ===== GOOGLE DRIVE (OAuth 2.0 via ENV) ===== */

if (!process.env.GOOGLE_REFRESH_TOKEN) {
  throw new Error("❌ GOOGLE_REFRESH_TOKEN missing");
}

if (!process.env.OAUTH_CLIENT_JSON) {
  throw new Error("❌ OAUTH_CLIENT_JSON missing");
}

const oauthCreds = JSON.parse(process.env.OAUTH_CLIENT_JSON);

const { client_id, client_secret, redirect_uris } =
  oauthCreds.installed || oauthCreds.web;

// ✅ CREATE auth FIRST
const auth = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);

// ✅ SET credentials ONCE
auth.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

// optional debug
auth.on("tokens", (tokens) => {
  if (tokens.access_token) {
    console.log("✅ Google Drive access token refreshed");
  }
});

const drive = google.drive({ version: "v3", auth });


/* ===== SAVE FCM TOKEN ===== */
const { getAuth } = require("firebase-admin/auth");
app.post("/save-token", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const idToken = authHeader.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(idToken);

    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: "Missing token" });
    }

    const { error } = await supabase
      .from("fcm_tokens")
      .upsert(
        {
          uid: decoded.uid,
          token,
        },
        { onConflict: "token" }
      );

    if (error) throw error;

    res.json({ message: "Token stored", uid: decoded.uid });
  } catch (err) {
    console.error("Save token error:", err);
    res.status(401).json({ message: "Invalid token" });
  }
});



/* ===== UPLOAD ===== */
app.post("/upload", upload.single("file"), async (req, res) => {

  
/* ===== AUTH MIDDLEWARE ===== */
const authHeader = req.headers.authorization;
if (!authHeader?.startsWith("Bearer ")) {
  return res.status(401).json({ message: "Unauthorized" });
}

const idToken = authHeader.split(" ")[1];
const decoded = await admin.auth().verifyIdToken(idToken);

console.log("DECODED TOKEN:", decoded);

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
  email: decoded.email || "anonymous",
  filename: file.originalname,
  filepath: pathValue,
  url: publicUrl,
  storage_type,
  uploaded_at: new Date().toISOString(),
}]);

    if (dbError) throw dbError;

   /* ===== PUSH NOTIFICATIONS ===== */
const { data: rows, error: tokenError } = await supabase
  .from("fcm_tokens")
  .select("token");

if (tokenError) {
  console.error("Token fetch error:", tokenError);
} else if (rows.length > 0) {
  const tokens = rows.map(r => r.token);

  const response = await admin.messaging().sendEachForMulticast({
  tokens,
  data: {
    title: "📚 New Notes Uploaded",
    body: `${program} ${subject} notes for Semester ${semester} available`,
    program,
    semester: String(semester),
    subject,
    fileId: id,
    url: `/program.html?program=${encodeURIComponent(program)}`
  }
});


  /* 🔥 CLEAN UP DEAD TOKENS */
  const invalidTokens = [];
  response.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error?.code || "";
      if (
        code.includes("registration-token-not-registered") ||
        code.includes("invalid-registration-token")
      ) {
        invalidTokens.push(tokens[i]);
      }
    }
  });

  if (invalidTokens.length) {
    await supabase
      .from("fcm_tokens")
      .delete()
      .in("token", invalidTokens);
  }
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
// GET /api/files?uid=...&program=...
app.get("/api/metadata", async (req, res) => {
  const { uid, program } = req.query;

  let query = supabase
    .from("files")
    .select("*")
    .order("uploaded_at", { ascending: false });

  if (uid) query = query.eq("email", uid);
  if (program) query = query.eq("program", program);

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ message: "Fetch failed", error: error.message });
  }

  res.json(data);
});



/* ===== GPT CHAT ENDPOINT ===== */
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ reply: "No message provided." });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful AI tutor specialized in academic subjects: math, science, writing, agriculture, research.",
          },
          { role: "user", content: message },
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error response:", data);
      return res.status(500).json({
        reply: "AI service error",
        error: data.error?.message || "Unknown OpenAI error",
      });
    }

    if (!data.choices || !data.choices.length) {
      console.error("Unexpected OpenAI payload:", data);
      return res.status(500).json({
        reply: "AI returned no response",
      });
    }

    res.json({ reply: data.choices[0].message.content });
  } catch (err) {
    console.error("GPT API fetch failed:", err);
    res.status(500).json({ reply: "Error connecting to GPT API" });
  }
});


/* ===== START SERVER ===== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
