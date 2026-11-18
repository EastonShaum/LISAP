import { db } from "../config/firebase.js";
import { getGmail } from "../config/google.js";
import { sendPushNotification } from "./notificationService.js";
import {
  getHeader,
  getBodyText,
  getPlusTag,
  getServiceName,
  extractCode,
  parseForwardingConfirmation,
} from "./parseEmail.js";
import { advanceCursor, getCursor } from "./gmailWatch.js";

const DEDUPE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Handle one Pub/Sub notification from Gmail: find every message added since
// the stored cursor, process each one once, then move the cursor forward.
export async function handleGmailNotification(incomingHistoryId) {
  const cursor = await getCursor();
  if (!cursor) {
    // No baseline yet (watch never started); start from this notification.
    await advanceCursor(incomingHistoryId);
    return { processed: 0 };
  }

  const messageIds = await listNewMessageIds(cursor);
  let processed = 0;
  for (const id of messageIds) {
    if (await processMessage(id)) processed++;
  }
  await advanceCursor(incomingHistoryId);
  return { processed };
}

async function listNewMessageIds(startHistoryId) {
  const gmail = getGmail();
  const ids = [];
  try {
    let pageToken;
    do {
      const res = await gmail.users.history.list({
        userId: "me",
        startHistoryId,
        historyTypes: ["messageAdded"],
        labelId: "INBOX",
        pageToken,
      });
      for (const h of res.data.history || []) {
        for (const { message } of h.messagesAdded || []) ids.push(message.id);
      }
      pageToken = res.data.nextPageToken;
    } while (pageToken);
  } catch (err) {
    // 404 means the cursor is too old (Gmail keeps about a week of history).
    // Fall back to the last day of inbox mail; the dedupe check skips repeats.
    if (err.code !== 404) throw err;
    console.warn("History cursor expired; scanning recent inbox mail instead");
    const res = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["INBOX"],
      q: "newer_than:1d",
      maxResults: 25,
    });
    ids.push(...(res.data.messages || []).map((m) => m.id));
  }
  return [...new Set(ids)];
}

// Returns true if the message was handled now, false if it was already handled.
export async function processMessage(messageId) {
  // Claim the message first so retries and overlapping notifications
  // never send the same code twice.
  const claim = db.collection("processedMessages").doc(messageId);
  try {
    await claim.create({ at: Date.now(), expireAt: new Date(Date.now() + DEDUPE_TTL_MS) });
  } catch (err) {
    if (err.code === 6) return false; // ALREADY_EXISTS
    throw err;
  }

  try {
    const gmail = getGmail();
    const { data: msg } = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
    const headers = msg.payload?.headers || [];
    const bodyText = getBodyText(msg.payload);
    const tag = getPlusTag(headers);

    if (!tag) {
      console.log(`Message ${messageId}: no plus tag in Delivered-To, skipping`);
      return true;
    }

    const ownerSnap = await db.collection("users").where("plusTag", "==", tag).limit(1).get();
    if (ownerSnap.empty) {
      console.log(`Message ${messageId}: no user with plus tag ${tag}`);
      return true;
    }
    const ownerDoc = ownerSnap.docs[0];
    const owner = ownerDoc.data();

    const confirmation = parseForwardingConfirmation(headers, bodyText);
    if (confirmation) {
      await handleForwardingConfirmation(ownerDoc, confirmation);
      return true;
    }

    const subject = getHeader(headers, "Subject");
    const service = getServiceName(headers);
    const code = extractCode(subject, bodyText);

    const tokens = [...(owner.fcmTokens || []), ...(await memberTokens(owner.members))];
    if (tokens.length === 0) {
      console.log(`Message ${messageId}: ${ownerDoc.id} and their members have no devices registered`);
      return true;
    }

    const title = code ? `${service} code` : subject || `${service} email`;
    const body = code ? code.replace(/^(\d{3})(\d{3})$/, "$1 $2") : (msg.snippet || "Open the app for details").slice(0, 180);
    await sendPushNotification(tokens, title, body, { service, code: code || "" });
    console.log(`Message ${messageId}: sent ${code ? "code" : "snippet"} to ${tokens.length} device(s)`);
    return true;
  } catch (err) {
    // Release the claim so a Pub/Sub retry can try again
    await claim.delete().catch(() => {});
    throw err;
  }
}

async function memberTokens(memberEmails = []) {
  if (!memberEmails.length) return [];
  const docs = await Promise.all(memberEmails.map((email) => db.collection("users").doc(email).get()));
  return docs.flatMap((d) => (d.exists ? d.data().fcmTokens || [] : []));
}

// Gmail emails the new forwarding address a confirmation code before it will
// forward anything. Save it on the owner's record (the onboarding screen shows
// it) and push it to any devices they already registered.
async function handleForwardingConfirmation(ownerDoc, { code, link, requestedBy }) {
  await ownerDoc.ref.set(
    { forwardingConfirmation: { code, link, requestedBy, receivedAt: Date.now() } },
    { merge: true }
  );
  console.log(`Saved Gmail forwarding confirmation for ${ownerDoc.id}`);

  const tokens = ownerDoc.data().fcmTokens || [];
  if (tokens.length && code) {
    await sendPushNotification(tokens, "Gmail forwarding code", code, { code, type: "forwarding" });
  }
}
