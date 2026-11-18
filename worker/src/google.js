// Google access tokens and API calls over plain fetch.
import { signJwt, verifyJwt } from "./jwt.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

// Access tokens are cached per Worker isolate until shortly before they expire.
const tokenCache = new Map();

async function cached(key, fetcher) {
  const hit = tokenCache.get(key);
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.token;
  const { token, expiresIn } = await fetcher();
  tokenCache.set(key, { token, expiresAt: Date.now() + expiresIn * 1000 });
  return token;
}

async function postToken(params) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google token error: ${data.error || res.status}`);
  return { token: data.access_token, expiresIn: data.expires_in || 3600 };
}

// Gmail: the shared LISAP inbox, via its OAuth refresh token.
export function gmailAccessToken(env) {
  return cached("gmail", () =>
    postToken({
      grant_type: "refresh_token",
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
    })
  );
}

export function serviceAccount(env) {
  const raw = env.FIREBASE_SERVICE_ACCOUNT.trim();
  return JSON.parse(raw.startsWith("{") ? raw : atob(raw));
}

// Firebase Cloud Messaging: a service-account token with the messaging scope.
export function fcmAccessToken(env) {
  return cached("fcm", async () => {
    const sa = serviceAccount(env);
    const now = Math.floor(Date.now() / 1000);
    const assertion = await signJwt(
      {
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: TOKEN_URL,
        iat: now,
        exp: now + 3600,
      },
      sa.private_key
    );
    return postToken({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion });
  });
}

export async function gmail(env, path, { method = "GET", query, body } = {}) {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`);
  for (const [k, v] of Object.entries(query || {})) {
    if (v === undefined || v === null) continue;
    (Array.isArray(v) ? v : [v]).forEach((x) => url.searchParams.append(k, x));
  }
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${await gmailAccessToken(env)}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = new Error(`Gmail ${path}: ${res.status} ${await res.text()}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Firebase Auth ID tokens, checked against Google's published keys.
let jwksCache = { keys: null, expiresAt: 0 };

async function firebaseKeys() {
  if (jwksCache.keys && jwksCache.expiresAt > Date.now()) return jwksCache.keys;
  const res = await fetch(FIREBASE_JWKS_URL);
  if (!res.ok) throw new Error(`Could not load Firebase keys: ${res.status}`);
  const { keys } = await res.json();
  const maxAge = Number(res.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1] || 3600);
  jwksCache = { keys, expiresAt: Date.now() + maxAge * 1000 };
  return keys;
}

export async function verifyFirebaseIdToken(env, idToken) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const payload = await verifyJwt(idToken, await firebaseKeys(), {
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
  });
  return { uid: payload.sub, email: (payload.email || "").toLowerCase() };
}
