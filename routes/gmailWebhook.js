import express from "express";
import { handleGmailNotification } from "../services/processEmail.js";

const router = express.Router();

// Google Cloud Pub/Sub push endpoint. Gmail publishes {emailAddress, historyId}
// whenever the watched inbox changes. Returning non-2xx makes Pub/Sub retry,
// which is safe because each message is only processed once.
router.post("/webhook", async (req, res) => {
  let data = null;
  try {
    const raw = req.body?.message?.data;
    data = raw ? JSON.parse(Buffer.from(raw, "base64").toString("utf8")) : null;
  } catch {
    return res.sendStatus(400);
  }
  if (!data?.historyId) return res.sendStatus(204);

  try {
    const { processed } = await handleGmailNotification(String(data.historyId));
    if (processed) console.log(`📩 Processed ${processed} new message(s)`);
    res.sendStatus(204);
  } catch (err) {
    console.error("Gmail webhook error:", err);
    res.sendStatus(500);
  }
});

export default router;
