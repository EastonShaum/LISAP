import admin from "firebase-admin";
import { existsSync, readFileSync } from "fs";
import path from "path";

// Firebase Admin credentials, in this order:
//   1. serviceAccountKey.json in the project root (local development)
//   2. FIREBASE_SERVICE_ACCOUNT: the whole key file as JSON or base64 (easiest on hosts)
//   3. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
function loadServiceAccount() {
  const keyPath = path.join(process.cwd(), "serviceAccountKey.json");
  if (existsSync(keyPath)) return JSON.parse(readFileSync(keyPath, "utf8"));

  const { FIREBASE_SERVICE_ACCOUNT, FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } =
    process.env;

  if (FIREBASE_SERVICE_ACCOUNT) {
    const raw = FIREBASE_SERVICE_ACCOUNT.trim();
    return JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
  }

  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return {
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      // .env files usually store the key on one line with literal \n sequences
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }

  throw new Error(
    "Firebase credentials missing: add serviceAccountKey.json or set FIREBASE_SERVICE_ACCOUNT"
  );
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(loadServiceAccount()) });
}

export const db = admin.firestore();
export const authAdmin = admin.auth();
export { admin };
