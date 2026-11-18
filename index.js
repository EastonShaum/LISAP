import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { readMessage } from "./gmail.js";
import { startWatch } from "./watch.js";

import { sendPushNotification } from "./services/notificationService.js";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import { db } from "./config/firebase.js";

import { google } from "googleapis";
import { getGmail } from "./gmail.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("LISAP API is running");
});

// --- API Routes ---
app.use("/api/auth", authRoutes);       // user Gmail OAuth
app.use("/api/users", userRoutes);

// --- Test route ---
app.get("/api/status", (req, res) => {
  res.json({ message: "Backend connected ✅" });
});

// --- Serve React frontend after build ---
app.use(express.static(path.join(__dirname, "client/build")));
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "client/build", "index.html"));
});

// Track the last processed historyId in memory so we only fetch new changes
let lastHistoryId = null;

function getHeader(headers, name) {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : null;
}

// Gmail watch endpoint
app.post("/gmail/webhook", async (req, res) => {
  try {
    const data = req.body.message?.data
      ? JSON.parse(Buffer.from(req.body.message.data, "base64").toString("utf8"))
      : null;

    if (!data) return res.sendStatus(200);

    const incomingHistoryId = data.historyId;

    // If we have no baseline yet, set it and wait for the next notification
    if (!lastHistoryId) {
      lastHistoryId = incomingHistoryId;
      console.log("📌 Baseline historyId set:", lastHistoryId);
      return res.sendStatus(200);
    }

    const gmail = await getGmail();

    // Use the History API to get only what changed since the last notification
    const historyRes = await gmail.users.history.list({
      userId: "me",
      startHistoryId: lastHistoryId,
      historyTypes: ["messageAdded"],
      labelId: "INBOX",
    });

    // Always advance the cursor, even if no messages to process
    lastHistoryId = incomingHistoryId;

    const history = historyRes.data.history || [];
    const addedMessages = history.flatMap(h => h.messagesAdded || []);

    if (addedMessages.length === 0) {
      console.log("📭 No new messages in INBOX — skipping");
      return res.sendStatus(200);
    }

    console.log(`📩 ${addedMessages.length} new message(s) received`);

    // Process each newly arrived message
    for (const { message } of addedMessages) {
      const fullMsg = await gmail.users.messages.get({
        userId: "me",
        id: message.id,
        format: "full",
      });

      const headers = fullMsg.data.payload.headers;

      const from = getHeader(headers, "From");
      const emailMatch = from?.match(/<(.+)>/);
      const senderEmail = emailMatch ? emailMatch[1] : from;

      const subject = getHeader(headers, "Subject") || "";

      // Gmail auto-forwarding rewrites To: — Delivered-To preserves the plus address
      const deliveredTo = getHeader(headers, "Delivered-To") || getHeader(headers, "To") || "";
      const plusMatch = deliveredTo.match(/\+([^@]+)@/);
      const userTag = plusMatch ? plusMatch[1] : null;

      console.log("Sender:", senderEmail);
      console.log("Subject:", subject);
      console.log("Delivered-To:", deliveredTo);
      console.log("User tag:", userTag);

      // --- SEND PUSH NOTIFICATION ---
      let fcmTokens = [];

      if (userTag) {
        const ownerSnap = await db.collection("users").where("plusTag", "==", userTag).limit(1).get();

        if (ownerSnap.empty) {
          console.log("⚠️ No user found in Firestore with plusTag:", userTag);
        } else {
          const ownerData = ownerSnap.docs[0].data();
          console.log("✅ User found:", ownerSnap.docs[0].id);
          console.log("FCM tokens on user:", ownerData.fcmTokens || []);
          fcmTokens.push(...(ownerData.fcmTokens || []));

          const memberEmails = ownerData.members || [];
          if (memberEmails.length > 0) {
            const memberSnaps = await Promise.all(
              memberEmails.map((email) => db.collection("users").doc(email).get())
            );
            for (const memberDoc of memberSnaps) {
              if (memberDoc.exists) {
                fcmTokens.push(...(memberDoc.data().fcmTokens || []));
              }
            }
          }
        }
      }

      if (fcmTokens.length === 0) {
        console.log("⚠️ No FCM tokens found for user tag:", userTag);
      } else {
        await sendPushNotification(
          fcmTokens,
          subject || "New email",
          fullMsg.data.snippet
        );
        console.log("✅ Push notification sent to", fcmTokens.length, "device(s)");
      }
    } // end for (addedMessages)

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startWatch().catch(console.error);
});