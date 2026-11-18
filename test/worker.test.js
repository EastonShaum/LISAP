// End-to-end test of the Worker: real SQLite standing in for D1, generated RSA
// keys for Firebase ID tokens and the service account, and fake Google APIs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker from "../worker/src/index.js";
import { b64urlEncode } from "../worker/src/jwt.js";

const PROJECT = "lisap-test";

// ---- D1 shim over node:sqlite ----
const sqlite = new DatabaseSync(":memory:");
sqlite.exec(readFileSync(new URL("../worker/schema.sql", import.meta.url), "utf8"));
const stmt = (sql, args = []) => ({
  bind: (...a) => stmt(sql, a),
  run: async () => ({ meta: { changes: sqlite.prepare(sql).run(...args).changes } }),
  first: async () => sqlite.prepare(sql).get(...args) ?? null,
  all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
});
const DB = { prepare: (sql) => stmt(sql), batch: async (list) => Promise.all(list.map((s) => s.run())) };

// ---- keys ----
const RS = { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" };
async function keyPair(kid) {
  const kp = await crypto.subtle.generateKey(RS, true, ["sign", "verify"]);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...pkcs8))}\n-----END PRIVATE KEY-----\n`;
  const jwk = { ...(await crypto.subtle.exportKey("jwk", kp.publicKey)), kid, alg: "RS256", use: "sig" };
  return { pem, jwk };
}
const firebaseKey = await keyPair("fb-1");
const saKey = await keyPair("sa-1");

// signJwt doesn't set kid; Firebase tokens carry one, so build those by hand.
async function firebaseToken(uid, email, extra = {}) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64urlEncode(JSON.stringify({ alg: "RS256", kid: "fb-1", typ: "JWT" }));
  const body = b64urlEncode(JSON.stringify({ aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, sub: uid, email, iat: now, exp: now + 3600, ...extra }));
  const der = Uint8Array.from(atob(firebaseKey.pem.replace(/-----[^-]+-----|\s/g, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, RS, false, ["sign"]);
  const sig = await crypto.subtle.sign(RS, key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64urlEncode(sig)}`;
}

// ---- fake Google ----
const b64url = (s) => Buffer.from(s).toString("base64url");
const messages = {
  m1: {
    id: "m1",
    snippet: "Your one-time passcode",
    payload: {
      mimeType: "text/plain",
      headers: [
        { name: "From", value: "Disney+ <disneyplus@mail.disneyplus.com>" },
        { name: "Subject", value: "Your one-time passcode for Disney+" },
        { name: "Delivered-To", value: "lisap.code+uid-owner@gmail.com" },
      ],
      body: { data: b64url("Your one-time passcode\n\n482913\n\nIt expires in 15 minutes.") },
    },
  },
  m2: {
    id: "m2",
    snippet: "Gmail forwarding",
    payload: {
      mimeType: "text/plain",
      headers: [
        { name: "From", value: "Gmail Team <forwarding-noreply@google.com>" },
        { name: "Subject", value: "(#987654321) Gmail Forwarding Confirmation - Receive Mail from owner@gmail.com" },
        { name: "Delivered-To", value: "lisap.code+uid-owner@gmail.com" },
      ],
      body: { data: b64url("Confirmation code: 987654321\nhttps://mail-settings.google.com/mail/vf-%5Babc%5D-xyz\n") },
    },
  },
  m3: {
    id: "m3",
    snippet: "Netflix code",
    payload: {
      mimeType: "text/plain",
      headers: [
        { name: "From", value: "Netflix <info@account.netflix.com>" },
        { name: "Subject", value: "Your sign-in code" },
        { name: "Delivered-To", value: "lisap.code+uid-owner@gmail.com" },
      ],
      body: { data: b64url("Enter this code to sign in\n7351\n") },
    },
  },
};

const calls = { watch: 0, pushes: [], historyStatus: 200, historyIds: ["m1", "m2"] };
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const ok = (data, headers = {}) => new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json", ...headers } });

  if (url.href.startsWith("https://oauth2.googleapis.com/token")) return ok({ access_token: "at-" + Math.random(), expires_in: 3600 });
  if (url.href.includes("securetoken@system.gserviceaccount.com")) return ok({ keys: [firebaseKey.jwk] }, { "Cache-Control": "max-age=600" });

  if (url.host === "gmail.googleapis.com") {
    const p = url.pathname.replace("/gmail/v1/users/me/", "");
    if (p === "watch") { calls.watch++; return ok({ historyId: "100", expiration: String(Date.now() + 7 * 864e5) }); }
    if (p === "history") {
      if (calls.historyStatus === 404) return new Response("gone", { status: 404 });
      return ok({ history: [{ messagesAdded: calls.historyIds.map((id) => ({ message: { id } })) }] });
    }
    if (p === "messages") return ok({ messages: [{ id: "m1" }, { id: "m3" }] });
    const id = p.split("/")[1];
    return ok(messages[id]);
  }

  if (url.host === "fcm.googleapis.com") {
    const { message } = JSON.parse(init.body);
    calls.pushes.push(message);
    if (message.token === "tok-dead") {
      return new Response(JSON.stringify({ error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } }), { status: 404 });
    }
    return ok({ name: "projects/x/messages/1" });
  }
  throw new Error("Unexpected fetch " + url.href);
};

const env = {
  DB,
  ASSETS: { fetch: async () => new Response("<html>app</html>", { status: 200 }) },
  FIREBASE_PROJECT_ID: PROJECT,
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ project_id: PROJECT, client_email: "sa@x.iam.gserviceaccount.com", private_key: saKey.pem }),
  GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "secret", GOOGLE_REFRESH_TOKEN: "rt",
  GMAIL_WATCH_TOPIC: "projects/p/topics/lisap",
  PUBSUB_TOKEN: "s3cret-token",
  ALLOWED_ORIGINS: "https://lisap.app",
};

const call = async (method, path, { token, body, origin } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  if (origin) headers.Origin = origin;
  const res = await worker.fetch(new Request(`https://lisap.app${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
  const text = await res.text();
  return { status: res.status, headers: res.headers, data: text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null };
};
const pubsub = (historyId, token = "s3cret-token") =>
  worker.fetch(
    new Request(`https://lisap.app/gmail/webhook?token=${token}`, {
      method: "POST",
      body: JSON.stringify({ message: { data: btoa(JSON.stringify({ emailAddress: "lisap.code@gmail.com", historyId })) } }),
    }),
    env
  );

test("full flow: sign-in, invite, watch, codes, forwarding confirmation, dedupe", async () => {
  const owner = await firebaseToken("uid-owner", "owner@gmail.com");
  const friend = await firebaseToken("uid-friend", "Friend@Gmail.com");

  assert.equal((await call("GET", "/api/users/me")).status, 401, "no token");
  const forged = owner.slice(0, -4) + (owner.endsWith("AAAA") ? "BBBB" : "AAAA");
  assert.equal((await call("GET", "/api/users/me", { token: forged })).status, 401, "bad signature");
  const wrongAud = await firebaseToken("uid-owner", "owner@gmail.com", { aud: "other-project" });
  assert.equal((await call("GET", "/api/users/me", { token: wrongAud })).status, 401, "wrong project");

  let r = await call("POST", "/api/users/me", { token: owner, body: { phones: [], active: true } });
  assert.equal(r.status, 200);
  assert.equal(r.data.plusTag, "uid-owner");
  assert.equal(r.data.active, true);

  assert.equal((await call("POST", "/api/users/me/fcm-token", { token: owner, body: { token: "tok-owner" } })).status, 200);

  r = await call("POST", "/api/users/me/join/uid-owner", { token: friend });
  assert.equal(r.status, 200);
  assert.equal((await call("POST", "/api/users/me/join/nope", { token: friend })).status, 404);
  assert.equal((await call("POST", "/api/users/me/join/uid-owner", { token: owner })).status, 400, "owner can't join self");
  await call("POST", "/api/users/me/fcm-token", { token: friend, body: { token: "tok-friend" } });
  await call("POST", "/api/users/me/fcm-token", { token: friend, body: { token: "tok-dead" } });

  r = await call("GET", "/api/users/me", { token: owner });
  assert.deepEqual(r.data.members, ["friend@gmail.com"]);

  // Cron starts the watch and sets the cursor
  const waits = [];
  await worker.scheduled({ cron: "0 9 * * *" }, env, { waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
  assert.equal(calls.watch, 1);
  assert.equal(sqlite.prepare("SELECT value FROM state WHERE key='gmail_history_id'").get().value, "100");

  assert.equal((await pubsub("105", "wrong")).status, 403);

  assert.equal((await pubsub("105")).status, 204);
  const codePushes = calls.pushes.filter((m) => m.data.code === "482913");
  assert.deepEqual(codePushes.map((m) => m.token).sort(), ["tok-dead", "tok-friend", "tok-owner"]);
  assert.equal(codePushes[0].notification.title, "Disney+ code");
  assert.equal(codePushes[0].notification.body, "482 913");
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM devices WHERE token='tok-dead'").get().n, 0, "dead token removed");

  const fwdPush = calls.pushes.find((m) => m.data.type === "forwarding");
  assert.equal(fwdPush.token, "tok-owner");
  assert.equal(fwdPush.notification.body, "987654321");
  r = await call("GET", "/api/users/me", { token: owner });
  assert.equal(r.data.forwardingConfirmation.code, "987654321");
  assert.match(r.data.forwardingConfirmation.link, /^https:\/\/mail-settings\.google\.com\/mail\/vf-/);

  // Pub/Sub retry of the same notification: nothing is sent twice
  const before = calls.pushes.length;
  assert.equal((await pubsub("105")).status, 204);
  assert.equal(calls.pushes.length, before);

  // An older notification never moves the cursor back
  await pubsub("103");
  assert.equal(sqlite.prepare("SELECT value FROM state WHERE key='gmail_history_id'").get().value, "105");

  // Expired cursor: falls back to recent mail, skips m1 (already sent), sends m3
  calls.historyStatus = 404;
  assert.equal((await pubsub("200")).status, 204);
  const netflix = calls.pushes.filter((m) => m.data.code === "7351");
  assert.deepEqual(netflix.map((m) => m.token).sort(), ["tok-friend", "tok-owner"]);
  assert.equal(calls.pushes.filter((m) => m.data.code === "482913").length, 3, "m1 not re-sent");
});

test("static app, CORS, unknown API route", async () => {
  const page = await call("GET", "/dashboard");
  assert.equal(page.data, "<html>app</html>");

  const pre = await worker.fetch(new Request("https://api.lisap.app/api/users/me", { method: "OPTIONS", headers: { Origin: "https://lisap.app" } }), env);
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("Access-Control-Allow-Origin"), "https://lisap.app");

  const evil = await worker.fetch(new Request("https://api.lisap.app/api/status", { headers: { Origin: "https://evil.example" } }), env);
  assert.equal(evil.headers.get("Access-Control-Allow-Origin"), null);

  const owner = await firebaseToken("uid-owner", "owner@gmail.com");
  assert.equal((await call("GET", "/api/nope", { token: owner })).status, 404);
});
