import { admin, db } from "../config/firebase.js";

// Errors that mean a device token will never work again (app uninstalled,
// notifications revoked, token rotated). Those tokens are removed from users.
const DEAD_TOKEN_ERRORS = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

// Send one notification to many devices.
// `data` values must be strings; the client can use them (e.g. to copy the code).
export const sendPushNotification = async (fcmTokens, title, body, data = {}) => {
  const tokens = [...new Set(fcmTokens || [])];
  if (tokens.length === 0) return null;

  const response = await admin.messaging().sendEachForMulticast({
    notification: { title, body },
    data,
    tokens,
  });

  const dead = [];
  response.responses.forEach((resp, i) => {
    if (resp.success) return;
    console.error(`FCM failed for token …${tokens[i].slice(-8)}:`, resp.error?.message);
    if (DEAD_TOKEN_ERRORS.has(resp.error?.code)) dead.push(tokens[i]);
  });
  if (dead.length) await removeTokens(dead);

  return response;
};

async function removeTokens(tokens) {
  const snap = await db.collection("users").where("fcmTokens", "array-contains-any", tokens.slice(0, 10)).get();
  await Promise.all(
    snap.docs.map((doc) =>
      doc.ref.update({ fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokens) })
    )
  );
}
