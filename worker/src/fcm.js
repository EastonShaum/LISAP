// Firebase Cloud Messaging HTTP v1. Sends one request per device token and
// removes tokens FCM says are gone for good (app uninstalled, permission revoked).
import { fcmAccessToken, serviceAccount } from "./google.js";

export async function sendPush(env, tokens, { title, body, data = {} }) {
  const unique = [...new Set(tokens)].filter(Boolean);
  if (!unique.length) return { sent: 0, removed: 0 };

  const projectId = serviceAccount(env).project_id;
  const accessToken = await fcmAccessToken(env);
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const results = await Promise.all(
    unique.map(async (token) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: { token, notification: { title, body }, data } }),
      });
      if (res.ok) return { token, ok: true };
      const err = await res.json().catch(() => ({}));
      const code = err.error?.details?.find((d) => d.errorCode)?.errorCode || err.error?.status;
      console.error(`FCM failed for …${token.slice(-8)}: ${res.status} ${code || ""}`);
      return { token, ok: false, dead: res.status === 404 || code === "UNREGISTERED" };
    })
  );

  const dead = results.filter((r) => r.dead).map((r) => r.token);
  if (dead.length) {
    await env.DB.batch(dead.map((t) => env.DB.prepare("DELETE FROM devices WHERE token = ?").bind(t)));
  }
  return { sent: results.filter((r) => r.ok).length, removed: dead.length };
}
