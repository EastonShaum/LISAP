import { db } from "../config/firebase.js";
import { getGmail, getTopicName } from "../config/google.js";

// Gmail's watch expires after 7 days; Google recommends renewing daily.
const RENEW_EVERY_MS = 24 * 60 * 60 * 1000;

// The last Gmail historyId we processed lives in Firestore, so a restart picks
// up where it left off instead of dropping the first email after every boot.
const cursorRef = () => db.collection("system").doc("gmailWatch");

export async function getCursor() {
  const snap = await cursorRef().get();
  return snap.exists ? snap.data().historyId || null : null;
}

// Move the cursor forward, never backward (notifications can arrive out of order).
export async function advanceCursor(historyId) {
  if (!historyId) return;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(cursorRef());
    const current = snap.exists ? snap.data().historyId : null;
    if (!current || BigInt(historyId) > BigInt(current)) {
      tx.set(cursorRef(), { historyId: String(historyId), updatedAt: Date.now() }, { merge: true });
    }
  });
}

export async function startWatch() {
  const gmail = getGmail();
  const res = await gmail.users.watch({
    userId: "me",
    requestBody: { topicName: getTopicName(), labelIds: ["INBOX"] },
  });

  // First run ever: start from now
  if (!(await getCursor())) await advanceCursor(res.data.historyId);

  await cursorRef().set(
    { watchExpiration: Number(res.data.expiration), watchRenewedAt: Date.now() },
    { merge: true }
  );
  console.log(`📡 Gmail watch active until ${new Date(Number(res.data.expiration)).toISOString()}`);
  return res.data;
}

export function keepWatchAlive() {
  const run = () =>
    startWatch().catch((err) => console.error("Gmail watch renewal failed:", err.message));
  run();
  return setInterval(run, RENEW_EVERY_MS);
}
