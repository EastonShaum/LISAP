// Minimal RS256 JWT helpers on WebCrypto (no dependencies).

const RS256 = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
const enc = new TextEncoder();

export function b64urlEncode(input) {
  const bytes = typeof input === "string" ? enc.encode(input) : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
}

function pemToDer(pem) {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

// Sign a JWT with a service account's PEM private key.
export async function signJwt(payload, privateKeyPem) {
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(privateKeyPem), RS256, false, ["sign"]);
  const head = b64urlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = await crypto.subtle.sign(RS256, key, enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64urlEncode(sig)}`;
}

// Verify an RS256 JWT against a set of JWKs. Returns the payload or throws.
export async function verifyJwt(token, jwks, { audience, issuer }) {
  const parts = String(token).split(".");
  if (parts.length !== 3) throw new Error("malformed token");
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  if (header.alg !== "RS256") throw new Error("unexpected alg");

  const jwk = jwks.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("unknown key id");
  const key = await crypto.subtle.importKey("jwk", jwk, RS256, false, ["verify"]);
  const ok = await crypto.subtle.verify(RS256, key, b64urlToBytes(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
  if (!ok) throw new Error("bad signature");

  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== audience) throw new Error("wrong audience");
  if (payload.iss !== issuer) throw new Error("wrong issuer");
  if (!(payload.exp > now)) throw new Error("expired");
  if (payload.iat > now + 300) throw new Error("issued in the future");
  if (!payload.sub) throw new Error("no subject");
  return payload;
}
