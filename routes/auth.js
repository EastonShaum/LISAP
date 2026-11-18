import express from "express";
import { db } from "../config/firebase.js";

const router = express.Router();

// Step 1: generate auth URL
router.get("/authorize/:email", async (req, res) => {
  const { email } = req.params;

  const userSnap = await db.collection("users").doc(email).get();
  if (!userSnap.exists) {
    return res.status(404).json({ error: "User not found" });
  }

  const oauth2Client = createOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
  });

  res.json({ url });
});

// Step 2: handle OAuth callback
router.get("/oauth2callback/:email", async (req, res) => {
  const { code } = req.query;
  const { email } = req.params;

  const oauth2Client = createOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);

  await db.collection("users").doc(email).update({
    gmailTokens: tokens,
    enabled: true,
  });

  res.send("✅ Gmail connected! You can close this window.");
});

export default router;
