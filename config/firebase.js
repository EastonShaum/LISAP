import admin from "firebase-admin";
import { readFileSync } from "fs";
import path from "path";

const keyPath = path.join(process.cwd(), "serviceAccountKey.json");
const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const db = admin.firestore();
export const authAdmin = admin.auth();