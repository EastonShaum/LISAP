// One-time move of existing users from Firestore to D1.
//
//   node scripts/export-firestore.mjs            (needs serviceAccountKey.json)
//   npx wrangler d1 execute lisap --remote --file seed.sql
//
// Writes seed.sql (gitignored: it contains users' emails and device tokens).
import admin from "firebase-admin";
import { readFileSync, writeFileSync } from "fs";

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync("serviceAccountKey.json", "utf8"))) });
const db = admin.firestore();

const q = (v) => (v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const lines = [];
const snap = await db.collection("users").get();
for (const doc of snap.docs) {
  const u = doc.data();
  const email = doc.id.toLowerCase();
  const fc = u.forwardingConfirmation || {};
  lines.push(
    `INSERT OR REPLACE INTO users (email, uid, plus_tag, phone, phones, active, connected_to, fwd_code, fwd_link, fwd_requested_by, fwd_received_at, updated_at) VALUES (${[
      email, u.plusTag || null, u.plusTag || null, u.phone || null, JSON.stringify(u.phones || []),
      u.active ? 1 : 0, u.connectedTo || null, fc.code || null, fc.link || null, fc.requestedBy || null,
      fc.receivedAt || null, u.updatedAt || Date.now(),
    ].map(q).join(", ")});`
  );
  for (const m of u.members || []) {
    lines.push(`INSERT OR IGNORE INTO members (owner_email, member_email) VALUES (${q(email)}, ${q(m.toLowerCase())});`);
  }
  for (const t of u.fcmTokens || []) {
    lines.push(`INSERT OR REPLACE INTO devices (token, email, created_at) VALUES (${q(t)}, ${q(email)}, ${Date.now()});`);
  }
}

// Carry the Gmail history cursor over too, if the Node server ever stored one
const cursor = await db.collection("system").doc("gmailWatch").get();
if (cursor.exists && cursor.data().historyId) {
  lines.push(`INSERT OR REPLACE INTO state (key, value) VALUES ('gmail_history_id', ${q(cursor.data().historyId)});`);
}

writeFileSync("seed.sql", lines.join("\n") + "\n");
console.log(`Wrote seed.sql: ${snap.size} users, ${lines.length} statements`);
process.exit(0);
