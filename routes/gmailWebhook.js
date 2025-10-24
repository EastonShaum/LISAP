import express from "express";
import { createOAuthClient } from "../config/google.js";
import { getUser, updateUser } from "../db/users.js";
import { fetchLatestMessages } from "../services/gmailService.js";
import { sendSMS } from "../services/smsService.js";

const router = express.Router();

router.post("/gmail/webhook", async (req, res) => {
  res.sendStatus(200); // Acknowledge fast
  const message = req.body.message;
  if (!message?.data) return;

  const data = JSON.parse(Buffer.from(message.data, "base64url").toString());
  const { emailAddress, historyId } = data;

  const user = await getUser(emailAddress);
  if (!user) return;

  const oauth = createOAuthClient();
  oauth.setCredentials(user.tokens);

  const newMessages = await fetchLatestMessages(oauth, user.lastHistoryId);
  for (const msg of newMessages) {
    const from = msg.payload.headers.find((h) => h.name === "From")?.value;
    const subject = msg.payload.headers.find((h) => h.name === "Subject")?.value;
    const snippet = msg.snippet;
    const body = `New email from ${from}\nSubject: ${subject}\n${snippet}`;
    await sendSMS(user.phone, body);
  }

  await updateUser(emailAddress, { lastHistoryId: historyId });
});

export default router;
