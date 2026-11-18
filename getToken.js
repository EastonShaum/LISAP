// One-time helper: sign in as the shared LISAP Gmail account and save a
// refresh token to token.json (gitignored).
//
//   node getToken.js
//
// For a hosted deploy, copy the refresh_token value from token.json into the
// GOOGLE_REFRESH_TOKEN environment variable.
import fs from "fs";
import path from "path";
import { authenticate } from "@google-cloud/local-auth";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");
const TOKEN_PATH = path.join(process.cwd(), "token.json");

async function main() {
  const auth = await authenticate({ keyfilePath: CREDENTIALS_PATH, scopes: SCOPES });
  if (!auth.credentials.refresh_token) {
    console.warn(
      "No refresh token returned. Remove LISAP's access at https://myaccount.google.com/permissions and run this again."
    );
  }
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(auth.credentials, null, 2));
  console.log("Saved to", TOKEN_PATH);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
