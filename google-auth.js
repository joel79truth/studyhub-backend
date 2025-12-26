const fs = require("fs");
const path = require("path");
const open = require("open").default;
const { google } = require("googleapis");

const CREDENTIALS_PATH = "./oauth-client.json"; // downloaded from Google
const TOKEN_PATH = "./token.json";

const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));

const { client_id, client_secret, redirect_uris } = creds.installed;

const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

async function authorize() {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });

  console.log("🔐 Authorizing…");
  await open(authUrl);

  console.log("📌 Paste the code from the browser:");
  process.stdin.once("data", async (code) => {
    const { tokens } = await oAuth2Client.getToken(code.toString().trim());
    oAuth2Client.setCredentials(tokens);

    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log("✅ Token saved to token.json");
    process.exit(0);
  });
}

authorize();
