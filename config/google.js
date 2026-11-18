import { existsSync, readFileSync } from "fs";
import path from "path";
import { google } from "googleapis";

// Gmail access for the shared LISAP inbox.
//
// Production: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN.
// The client library trades the refresh token for short-lived access tokens on
// its own, so nothing needs to be written back to disk.
//
// Local development: credentials.json + token.json (from `npm run get-token`)
// still work when the env vars are not set.
function loadOAuthConfig() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REFRESH_TOKEN) {
    return {
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      refreshToken: GOOGLE_REFRESH_TOKEN,
    };
  }

  const credPath = path.join(process.cwd(), "credentials.json");
  const tokenPath = path.join(process.cwd(), "token.json");
  if (existsSync(credPath) && existsSync(tokenPath)) {
    const creds = JSON.parse(readFileSync(credPath, "utf8"));
    const keys = creds.web || creds.installed;
    const token = JSON.parse(readFileSync(tokenPath, "utf8"));
    return {
      clientId: keys.client_id,
      clientSecret: keys.client_secret,
      refreshToken: token.refresh_token,
    };
  }

  throw new Error(
    "Gmail credentials missing: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN"
  );
}

let gmailClient = null;

export function getGmail() {
  if (gmailClient) return gmailClient;
  const { clientId, clientSecret, refreshToken } = loadOAuthConfig();
  if (!refreshToken) throw new Error("No Gmail refresh token found");
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  gmailClient = google.gmail({ version: "v1", auth });
  return gmailClient;
}

// Full Pub/Sub topic Gmail publishes to, e.g. projects/my-project/topics/lisap
export function getTopicName() {
  return process.env.GMAIL_WATCH_TOPIC || "projects/email-sms-service/topics/lisap";
}
