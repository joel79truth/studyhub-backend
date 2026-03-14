const express = require("express");
const multer = require("multer");
const cors = require("cors");
const dotenv = require("dotenv");
const { v4: uuidv4 } = require("uuid");
const admin = require("firebase-admin");
const { createClient } = require("@supabase/supabase-js");
const { google } = require("googleapis");
const { Readable } = require("stream");
const path = require("path");
const fs = require("fs");

dotenv.config();

/* ===== INITIALISATION ===== */
// Firebase Admin SDK
if (!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
  throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_BASE64");
}
const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString()
);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Supabase
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase credentials");
}
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Google Drive OAuth
if (!process.env.OAUTH_CLIENT_JSON || !process.env.GOOGLE_REFRESH_TOKEN) {
  throw new Error("Missing Google OAuth credentials");
}
const oauthCreds = JSON.parse(process.env.OAUTH_CLIENT_JSON);
const { client_id, client_secret, redirect_uris } =
  oauthCreds.installed || oauthCreds.web;
const auth = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const drive = google.drive({ version: "v3", auth });

// Multer (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// Express app
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

/* ===== HELPER FUNCTIONS ===== */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(401).json({ message: "Unauthorized" });
  }
}

// SSE clients for real-time messages
let sseClients = [];

/* ===== ROUTES ===== */

// Health check
app.get("/", (req, res) => {
  res.send("Server is running");
});

// Save FCM token (protected)
app.post("/save-token", requireAuth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: "Missing token" });
    }

    const { error } = await supabase.from("fcm_tokens").upsert(
      { uid: req.user.uid, token },
      { onConflict: "token" }
    );

    if (error) throw error;
    res.json({ message: "Token stored", uid: req.user.uid });
  } catch (err) {
    console.error("Save token error:", err);
    res.status(500).json({ message: "Failed to store token" });
  }
});

// Upload file (protected)
app.post("/upload", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const { program, semester, subject } = req.body;
    const file = req.file;

    if (!program || !semester || !subject || !file) {
      return res.status(400).json({ message: "Missing fields or file" });
    }

    const USE_GDRIVE = file.size > 50 * 1024; // >50KB -> Google Drive
    const id = uuidv4();
    const safeName = file.originalname.replace(/\s+/g, "_");
    const filePath = `${program}/${semester}/${subject}/${Date.now()}-${safeName}`;
    let storage_type, storage_ref, publicUrl;

    if (USE_GDRIVE) {
      // Upload to Google Drive
      const bufferStream = new Readable();
      bufferStream.push(file.buffer);
      bufferStream.push(null);

      const driveRes = await drive.files.create({
        requestBody: {
          name: file.originalname,
          parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
        },
        media: { mimeType: file.mimetype, body: bufferStream },
      });

      storage_type = "gdrive";
      storage_ref = driveRes.data.id;
      publicUrl = `/api/drive/${storage_ref}`; // local proxy endpoint
    } else {
      // Upload to Supabase Storage
      const { error } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET || "files")
        .upload(filePath, file.buffer, { contentType: file.mimetype });

      if (error) throw error;

      storage_type = "supabase";
      storage_ref = filePath;
      publicUrl = supabase.storage
        .from(process.env.SUPABASE_BUCKET || "files")
        .getPublicUrl(filePath).data.publicUrl;
    }

    // Save metadata in Supabase 'files' table
    const { error: dbError } = await supabase.from("files").insert([
      {
        id,
        program,
        semester: String(semester),
        subject,
        email: req.user.email || req.user.uid,
        filename: file.originalname,
        filepath: storage_ref,
        url: publicUrl,
        storage_type,
        uploaded_at: new Date().toISOString(),
      },
    ]);

    if (dbError) throw dbError;

    // Send push notification to all FCM tokens
    const { data: tokens, error: tokenError } = await supabase
      .from("fcm_tokens")
      .select("token");

    if (!tokenError && tokens && tokens.length > 0) {
      const tokenList = tokens.map((t) => t.token);
      const message = {
        tokens: tokenList,
        notification: {
          title: `📚 New Notes: ${subject}`,
          body: `${file.originalname} for ${program} Sem ${semester}`,
        },
        data: {
          program,
          semester: String(semester),
          subject,
          filename: file.originalname,
          fileId: id,
          url: `/program.html?program=${encodeURIComponent(
            program
          )}&semester=${encodeURIComponent(semester)}&subject=${encodeURIComponent(
            subject
          )}`,
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      // Remove invalid tokens
      const invalidTokens = [];
      response.responses.forEach((r, i) => {
        if (!r.success) {
          const code = r.error?.code || "";
          if (
            code.includes("registration-token-not-registered") ||
            code.includes("invalid-registration-token")
          ) {
            invalidTokens.push(tokenList[i]);
          }
        }
      });
      if (invalidTokens.length) {
        await supabase.from("fcm_tokens").delete().in("token", invalidTokens);
      }
    }

    res.json({ message: "Upload successful", url: publicUrl });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
});

// Proxy for Google Drive files
app.get("/api/drive/:fileId", async (req, res) => {
  try {
    const driveRes = await drive.files.get(
      { fileId: req.params.fileId, alt: "media" },
      { responseType: "stream" }
    );
    driveRes.data.pipe(res);
  } catch (err) {
    console.error("Drive proxy error:", err);
    res.status(404).send("File not found");
  }
});

// Get file metadata (public, with optional filters)
app.get("/api/metadata", async (req, res) => {
  try {
    const { uid, program } = req.query;
    let query = supabase
      .from("files")
      .select("*")
      .order("uploaded_at", { ascending: false });

    if (uid) query = query.eq("email", uid);
    if (program) query = query.eq("program", program);

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("Metadata fetch error:", err);
    res.status(500).json({ message: "Fetch failed", error: err.message });
  }
});

// Submit a request (public or protected? We'll keep public, but store in Supabase and send notification)
app.post("/submit-request", async (req, res) => {
  try {
    const { topic, course, program, semester, notes, email } = req.body;

    if (!topic || !course || !program || !semester) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Store request in Supabase 'requests' table (create if not exists)
    const { data, error } = await supabase.from("requests").insert([
      {
        topic,
        course,
        program,
        semester: String(semester),
        notes: notes || "",
        email: email || "",
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) throw error;

    // Send push notification to admins? For now, send to all tokens (or a specific topic)
    // Option: send to a "requests" topic if admins subscribe.
    // We'll just send to all tokens as a demo.
    const { data: tokens, error: tokenError } = await supabase
      .from("fcm_tokens")
      .select("token");

    if (!tokenError && tokens && tokens.length > 0) {
      const tokenList = tokens.map((t) => t.token);
      const message = {
        tokens: tokenList,
        notification: {
          title: `📝 New Request: ${topic}`,
          body: `${course} - ${program} Sem ${semester}`,
        },
        data: {
          type: "request",
          topic,
          course,
          program,
          semester: String(semester),
          url: `/requested-notes.html?program=${encodeURIComponent(
            program
          )}&course=${encodeURIComponent(course)}&semester=${semester}&topic=${encodeURIComponent(
            topic
          )}`,
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      // Clean invalid tokens
      const invalidTokens = [];
      response.responses.forEach((r, i) => {
        if (!r.success) {
          const code = r.error?.code || "";
          if (
            code.includes("registration-token-not-registered") ||
            code.includes("invalid-registration-token")
          ) {
            invalidTokens.push(tokenList[i]);
          }
        }
      });
      if (invalidTokens.length) {
        await supabase.from("fcm_tokens").delete().in("token", invalidTokens);
      }
    }

    res.json({ message: "Request submitted and notification sent" });
  } catch (err) {
    console.error("Request submission error:", err);
    res.status(500).json({ message: "Failed to submit request" });
  }
});

// Get all requests (public? maybe later add auth for admin)
app.get("/api/requests", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ requests: data });
  } catch (err) {
    console.error("Fetch requests error:", err);
    res.status(500).json({ requests: [] });
  }
});

// Delete a request (maybe add admin auth later)
app.delete("/api/requests/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { error } = await supabase.from("requests").delete().eq("id", id);
    if (error) throw error;
    res.json({ message: "Request deleted" });
  } catch (err) {
    console.error("Delete request error:", err);
    res.status(500).json({ message: "Failed to delete request" });
  }
});

// SSE endpoint for real-time messages
app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  sseClients.push(res);

  req.on("close", () => {
    sseClients = sseClients.filter((client) => client !== res);
  });
});

// Post a chat message (public, but we store in Supabase maybe)
app.post("/chat-message", async (req, res) => {
  const { sender, program, text } = req.body;
  if (!sender || !program || !text) {
    return res.status(400).json({ message: "Missing fields" });
  }

  // Store message in Supabase 'messages' table (create if needed)
  const newMessage = {
    sender,
    program,
    text,
    timestamp: new Date().toISOString(),
  };

  const { error } = await supabase.from("messages").insert([newMessage]);
  if (error) {
    console.error("Error saving message:", error);
    return res.status(500).json({ message: "Failed to save message" });
  }

  // Broadcast to SSE clients
  sseClients.forEach((client) => {
    client.write(`data: ${JSON.stringify(newMessage)}\n\n`);
  });

  res.json({ message: "Message sent", newMessage });
});

// Optional: Serve static files from public/files (if you still use local storage)
app.use("/files", express.static(path.join(__dirname, "public/files")));

// GPT chat endpoint (public)
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
      console.error("OpenAI error:", data);
      return res.status(500).json({
        reply: "AI service error",
        error: data.error?.message || "Unknown error",
      });
    }

    if (!data.choices || !data.choices.length) {
      return res.status(500).json({ reply: "AI returned no response" });
    }

    res.json({ reply: data.choices[0].message.content });
  } catch (err) {
    console.error("GPT API fetch failed:", err);
    res.status(500).json({ reply: "Error connecting to GPT API" });
  }
});

/* ===== START SERVER ===== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});