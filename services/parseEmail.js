// Pure helpers for reading Gmail API message payloads. No network or database
// access here, so these are easy to test (see test/parseEmail.test.js).

export function getHeader(headers = [], name) {
  const h = headers.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : "";
}

function decodeBase64Url(data = "") {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function htmlToText(html) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|td|h\d|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n");
}

// Plain-text body of a message: the text/plain part if there is one,
// otherwise the text/html part with tags stripped.
export function getBodyText(payload) {
  const parts = [];
  (function walk(p) {
    if (!p) return;
    if (p.body?.data && p.mimeType?.startsWith("text/")) parts.push(p);
    (p.parts || []).forEach(walk);
  })(payload);

  const plain = parts.find((p) => p.mimeType === "text/plain");
  if (plain) return decodeBase64Url(plain.body.data);
  const html = parts.find((p) => p.mimeType === "text/html");
  if (html) return htmlToText(decodeBase64Url(html.body.data));
  return "";
}

// The +tag from the address the message was delivered to.
// Gmail auto-forwarding keeps the plus address in Delivered-To.
export function getPlusTag(headers) {
  const deliveredTo = getHeader(headers, "Delivered-To") || getHeader(headers, "To");
  const m = deliveredTo.match(/\+([^@\s>]+)@/);
  return m ? m[1] : null;
}

export function getSenderEmail(headers) {
  const from = getHeader(headers, "From");
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim().toLowerCase();
}

const SERVICES = [
  [/disney/i, "Disney+"],
  [/netflix/i, "Netflix"],
  [/max\.com|hbomax/i, "Max"],
  [/hulu/i, "Hulu"],
  [/primevideo|amazon/i, "Prime Video"],
  [/peacock/i, "Peacock"],
  [/paramount/i, "Paramount+"],
  [/apple/i, "Apple TV+"],
];

export function getServiceName(headers) {
  const from = getHeader(headers, "From");
  const hit = SERVICES.find(([re]) => re.test(from));
  if (hit) return hit[1];
  const display = from.replace(/<[^>]*>/, "").replace(/"/g, "").trim();
  return display || "Sign-in";
}

// Gmail sends this to a new forwarding address before it can be used.
// Subject looks like: "(#123456789) Gmail Forwarding Confirmation - Receive Mail from owner@gmail.com"
export function parseForwardingConfirmation(headers, bodyText) {
  const sender = getSenderEmail(headers);
  const subject = getHeader(headers, "Subject");
  if (sender !== "forwarding-noreply@google.com" && !/Forwarding Confirmation/i.test(subject)) {
    return null;
  }
  const code =
    subject.match(/\(#(\d{6,12})\)/)?.[1] ||
    bodyText.match(/Confirmation code:\s*(\d{6,12})/i)?.[1] ||
    null;
  const link = bodyText.match(/https:\/\/mail(?:-settings)?\.google\.com\/mail\/[^\s"<>)]*vf-[^\s"<>)]+/)?.[0] || null;
  const requestedBy = subject.match(/Receive Mail from\s+(\S+@\S+)/i)?.[1] || null;
  if (!code && !link) return null;
  return { code, link, requestedBy };
}

// Pull a sign-in code out of a streaming service email.
// Prefers a number that follows a word like "code" or "passcode"; falls back
// to a number that sits alone on its own line. Returns digits only, or null.
export function extractCode(subject = "", bodyText = "") {
  const text = `${subject}\n${bodyText}`;
  const CODE = String.raw`(\d{3}[ -]\d{3}|\d{4,8})`;

  const nearKeyword = new RegExp(
    String.raw`(?:code|passcode|pass code|verification|one-time|otp|pin)\b[^\d\n]{0,60}(?:\n[^\d\n]{0,40})?` + CODE + String.raw`(?!\d)`,
    "i"
  );
  const m1 = text.match(nearKeyword);
  if (m1) return m1[1].replace(/\D/g, "");

  const aloneOnLine = new RegExp(String.raw`^\s*` + CODE + String.raw`\s*$`, "m");
  const m2 = bodyText.match(aloneOnLine);
  if (m2) {
    const digits = m2[1].replace(/\D/g, "");
    // A bare 4-digit number on its own line could be a year
    if (!(digits.length === 4 && /^(19|20)\d\d$/.test(digits))) return digits;
  }
  return null;
}
