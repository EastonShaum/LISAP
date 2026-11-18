import fs from "fs";
import path from "path";
import { google } from "googleapis";

const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

export async function getAuthClient() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH));

  const { client_secret, client_id, redirect_uris } = credentials.web;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  oAuth2Client.setCredentials(token);
  return oAuth2Client;
}

export async function getGmail() {
  const auth = await getAuthClient();
  return google.gmail({ version: "v1", auth });
}

export async function readMessage(messageId) {
  const gmail = await getGmail();
  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });
  return res.data;
}