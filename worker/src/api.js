// /api/users/* — the same endpoints the React client already calls.
import { verifyFirebaseIdToken } from "./google.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

async function currentUser(request, env) {
  const m = (request.headers.get("Authorization") || "").match(/^Bearer (.+)$/);
  if (!m) return null;
  try {
    return await verifyFirebaseIdToken(env, m[1]);
  } catch (err) {
    console.warn("Rejected ID token:", err.message);
    return null;
  }
}

async function readUser(env, email) {
  const row = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  if (!row) return { email, exists: false, phones: [], active: false };
  const { results: members } = await env.DB.prepare("SELECT member_email FROM members WHERE owner_email = ?")
    .bind(email)
    .all();
  return {
    email: row.email,
    exists: true,
    plusTag: row.plus_tag,
    phone: row.phone,
    phones: JSON.parse(row.phones || "[]"),
    active: !!row.active,
    connectedTo: row.connected_to,
    members: members.map((m) => m.member_email),
    forwardingConfirmation: row.fwd_code || row.fwd_link
      ? { code: row.fwd_code, link: row.fwd_link, requestedBy: row.fwd_requested_by, receivedAt: row.fwd_received_at }
      : null,
  };
}

export async function handleApi(request, env, path) {
  if (path === "/api/status") return json({ ok: true });

  const user = await currentUser(request, env);
  if (!user || !user.email) return json({ error: "Not signed in" }, 401);
  const { method } = request;

  if (path === "/api/users/me" && method === "GET") {
    return json(await readUser(env, user.email));
  }

  if (path === "/api/users/me" && method === "POST") {
    const body = await request.json().catch(() => ({}));
    // Invite-only: a new owner account needs an entry in `invites`. Existing
    // users and friends who joined by link are already in `users`.
    const known = await env.DB.prepare("SELECT 1 FROM users WHERE email = ?").bind(user.email).first();
    if (!known) {
      const invited = await env.DB.prepare("SELECT 1 FROM invites WHERE email = ?").bind(user.email).first();
      if (!invited) return json({ error: "invite_only" }, 403);
    }
    const phones = Array.isArray(body.phones) ? JSON.stringify(body.phones.map(String).slice(0, 20)) : null;
    // The Firebase UID doubles as the plus-address tag (lisap.code+<uid>@gmail.com)
    await env.DB.prepare(
      `INSERT INTO users (email, uid, plus_tag, phone, phones, active, updated_at)
       VALUES (?1, ?2, ?2, ?3, COALESCE(?4, '[]'), COALESCE(?5, 0), ?6)
       ON CONFLICT(email) DO UPDATE SET
         uid = excluded.uid, plus_tag = excluded.plus_tag,
         phone = COALESCE(?3, users.phone),
         phones = COALESCE(?4, users.phones),
         active = COALESCE(?5, users.active),
         updated_at = excluded.updated_at`
    )
      .bind(
        user.email,
        user.uid,
        body.phone ? String(body.phone) : null,
        phones,
        typeof body.active === "boolean" ? (body.active ? 1 : 0) : null,
        Date.now()
      )
      .run();
    return json(await readUser(env, user.email));
  }

  if (path === "/api/users/me/fcm-token" && (method === "POST" || method === "DELETE")) {
    const { token } = await request.json().catch(() => ({}));
    if (!token || typeof token !== "string") return json({ error: "token required" }, 400);
    if (method === "POST") {
      await env.DB.prepare(
        "INSERT INTO devices (token, email, created_at) VALUES (?, ?, ?) ON CONFLICT(token) DO UPDATE SET email = excluded.email"
      )
        .bind(token, user.email, Date.now())
        .run();
    } else {
      await env.DB.prepare("DELETE FROM devices WHERE token = ? AND email = ?").bind(token, user.email).run();
    }
    return json({ ok: true });
  }

  const join = path.match(/^\/api\/users\/me\/join\/([^/]+)$/);
  if (join && method === "POST") {
    const ownerTag = decodeURIComponent(join[1]);
    const owner = await env.DB.prepare("SELECT email FROM users WHERE plus_tag = ?").bind(ownerTag).first();
    if (!owner) return json({ error: "Invalid invite link — account not found." }, 404);
    if (owner.email === user.email) return json({ error: "You are the account owner." }, 400);
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO users (email, uid, plus_tag, phones, active, connected_to, updated_at)
         VALUES (?1, ?2, ?2, '[]', 1, ?3, ?4)
         ON CONFLICT(email) DO UPDATE SET connected_to = ?3, active = 1, updated_at = ?4`
      ).bind(user.email, user.uid, ownerTag, now),
      env.DB.prepare("INSERT INTO members (owner_email, member_email) VALUES (?, ?) ON CONFLICT DO NOTHING").bind(
        owner.email,
        user.email
      ),
    ]);
    return json({ ok: true });
  }

  return json({ error: "Not found" }, 404);
}
