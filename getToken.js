import fs from "fs";
import path from "path";
import { authenticate } from "@google-cloud/local-auth";
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");
const TOKEN_PATH = path.join(process.cwd(), "token.json");

async function main() {
  const auth = await authenticate({
    keyfilePath: CREDENTIALS_PATH,
    scopes: SCOPES,
  });

  const client = auth.credentials;
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(client, null, 2));
  console.log("Token saved to:", TOKEN_PATH);
}

main().catch(console.error);