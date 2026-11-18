// Gmail watch, history cursor and new-message handling.
import { gmail } from "./google.js";
import { sendPush } from "./fcm.js";
import {
  getHeader,
  getBodyText,
  getPlusTag,
  getServiceName,
  extractCode,
  parseForwardingConfirmation,
} from "./parseEmail.js";

const DEDUPE_DAYS = 7;

// ---- history cursor (stored in D1 so nothing is lost between requests) ----

export async function getCursor(env) {
  const row = await env.DB.prepare("SELECT value FROM state WHERE key = 'gmail_history_id'").first();
  return row?.value || null;
}

// Only ever moves forward; notifications can arrive out of order.
export async function advanceCursor(env, historyId) {
  if (!historyId) return;
  await env.DB.prepare(
    `INSERT INTO state (key, value) VALUES ('gmail_history_id', ?1)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value
     WHERE CAST(excluded.value AS INTEGER) > CAST(state.value AS INTEGER)`
  )
    .bind(String(historyId))
    .run();
}

// ---- watch (renewed daily by the cron trigger) ----

export async function startWatch(env) {
  const res = await gmail(env, "watch", {
    method: "POST",
    body: { topicName: env.GMAIL_WATCH_TOPIC, labelIds: ["INBOX"] },
  });
  if (!(await getCursor(env))) await advanceCursor(env, res.historyId);
  await env.DB.prepare(
    "INSERT INTO state (key, value) VALUES ('gmail_watch_expiration', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  )
    .bind(String(res.expiration))
    .run();
  return res;
}

export async function cleanup(env) {
  const cutoff = Date.now() - DEDUPE_DAYS * 86400_000;
  await env.DB.prepare("DELETE FROM processed WHERE at < ?").bind(cutoff).run();
}

// ---- Pub/Sub notification → new messages ----

export async function handleNotification(env, incomingHistoryId) {
  const cursor = await getCursor(env);
  if (!cursor) {
    await advanceCursor(env, incomingHistoryId);
    return { processed: 0 };
  }
  let processed = 0;
  for (const id of await listNewMessageIds(env, cursor)) {
    if (await processMessage(env, id)) processed++;
  }
  await advanceCursor(env, incomingHistoryId);
  return { processed };
}

async function listNewMessageIds(env, startHistoryId) {
  const ids = [];
  try {
    let pageToken;
    do {
      const res = await gmail(env, "history", {
        query: { startHistoryId, historyTypes: "messageAdded", labelId: "INBOX", pageToken },
      });
      for (const h of res.history || []) {
        for (const { message } of h.messagesAdded || []) ids.push(message.id);
      }
      pageToken = res.nextPageToken;
    } while (pageToken);
  } catch (err) {
    // 404: the cursor is older than Gmail keeps history (about a week).
    // Scan the last day of inbox mail instead; dedupe skips repeats.
    if (err.status !== 404) throw err;
    console.warn("History cursor expired; scanning recent inbox mail");
    const res = await gmail(env, "messages", { query: { labelIds: "INBOX", q: "newer_than:1d", maxResults: 25 } });
    ids.push(...(res.messages || []).map((m) => m.id));
  }
  return [...new Set(ids)];
}

// Returns true if handled now, false if it had already been handled.
export async function processMessage(env, messageId) {
  const claim = await env.DB.prepare("INSERT INTO processed (message_id, at) VALUES (?, ?) ON CONFLICT DO NOTHING")
    .bind(messageId, Date.now())
    .run();
  if (!claim.meta.changes) return false;

  try {
    const msg = await gmail(env, `messages/${messageId}`, { query: { format: "full" } });
    const headers = msg.payload?.headers || [];
    const bodyText = getBodyText(msg.payload);
    const tag = getPlusTag(headers);
    if (!tag) {
      console.log(`${messageId}: no plus tag, skipping`);
      return true;
    }

    const owner = await env.DB.prepare("SELECT email FROM users WHERE plus_tag = ?").bind(tag).first();
    if (!owner) {
      console.log(`${messageId}: no user for tag ${tag}`);
      return true;
    }

    const confirmation = parseForwardingConfirmation(headers, bodyText);
    if (confirmation) {
      await saveForwardingConfirmation(env, owner.email, confirmation);
      return true;
    }

    const subject = getHeader(headers, "Subject");
    const service = getServiceName(headers);
    const code = extractCode(subject, bodyText);
    const tokens = await recipientTokens(env, owner.email);
    if (!tokens.length) {
      console.log(`${messageId}: no registered devices for ${owner.email}`);
      return true;
    }

    const result = await sendPush(env, tokens, {
      title: code ? `${service} code` : subject || `${service} email`,
      body: code ? code.replace(/^(\d{3})(\d{3})$/, "$1 $2") : (msg.snippet || "Open LISAP for details").slice(0, 180),
      data: { service, code: code || "" },
    });
    console.log(`${messageId}: sent ${code ? "code" : "snippet"} to ${result.sent} device(s)`);
    return true;
  } catch (err) {
    // Release the claim so Pub/Sub's retry can try again
    await env.DB.prepare("DELETE FROM processed WHERE message_id = ?").bind(messageId).run();
    throw err;
  }
}

// The owner's devices plus every friend who joined the owner's account.
async function recipientTokens(env, ownerEmail) {
  const { results } = await env.DB.prepare(
    `SELECT token FROM devices
     WHERE email = ?1 OR email IN (SELECT member_email FROM members WHERE owner_email = ?1)`
  )
    .bind(ownerEmail)
    .all();
  return results.map((r) => r.token);
}

// Gmail emails a confirmation code to a new forwarding address. Save it so the
// onboarding screen can show it, and push it to the owner's devices if any.
async function saveForwardingConfirmation(env, email, { code, link, requestedBy }) {
  await env.DB.prepare(
    "UPDATE users SET fwd_code = ?, fwd_link = ?, fwd_requested_by = ?, fwd_received_at = ? WHERE email = ?"
  )
    .bind(code, link, requestedBy, Date.now(), email)
    .run();
  console.log(`Saved forwarding confirmation for ${email}`);
  if (code) {
    const { results } = await env.DB.prepare("SELECT token FROM devices WHERE email = ?").bind(email).all();
    await sendPush(env, results.map((r) => r.token), {
      title: "Gmail forwarding code",
      body: code,
      data: { code, type: "forwarding" },
    });
  }
}
