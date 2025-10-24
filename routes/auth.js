import express from "express";
import { createOAuthClient, gmailClient } from "../config/google.js";
import { saveUser } from "../db/users.js";
import { setupWatch } from "../services/gmailService.js";

const router = express.Router();

router.get("/google", (req, res) => {
  const oauth = createOAuthClient();
  const url = oauth.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
  });
  res.redirect(url);
});

router.get("/oauth2callback", async (req, res) => {
  const oauth = createOAuthClient();
  const { code } = req.query;
  const { tokens } = await oauth.getToken(code);
  oauth.setCredentials(tokens);

  const gmail = gmailClient(oauth);
  const profile = await gmail.users.getProfile({ userId: "me" });
  const email = profile.data.emailAddress;

  await saveUser(email, tokens);
  await setupWatch(oauth, email);

  res.send(" Connected successfully! You’ll now get text alerts.");
});

export default router;
