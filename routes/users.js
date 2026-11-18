import express from "express";
import admin from "firebase-admin";
import { authAdmin, db } from "../config/firebase.js";

const router = express.Router();

// helper: verify bearer token (idToken from frontend)
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) return res.status(401).json({ error: "No token" });

  try {
    const idToken = match[1];
    const decoded = await authAdmin.verifyIdToken(idToken);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
    };
    next();
  } catch (err) {
    console.error("verifyToken error", err);
    return res.status(401).json({ error: "Invalid token" });
  }
}

// GET current user's record
router.get("/me", verifyToken, async (req, res) => {
  const email = req.user.email;
  const doc = await db.collection("users").doc(email).get();
  if (!doc.exists) return res.json({ email, phone: [], active: false });
  return res.json(doc.data());
});

// POST to create/update current user's record (phone numbers, active)
router.post("/me", verifyToken, async (req, res) => {
  const email = req.user.email;
  const { phone = null, phones = [], active = false } = req.body;

  const payload = {
    email,
    // Use the Firebase Auth UID as the plus-address tag — set on every write so
    // it's always present even for users created before this field existed.
    plusTag: req.user.uid,
    updatedAt: Date.now(),
  };

  if (phone) payload.phone = phone;
  if (Array.isArray(phones)) payload.phones = phones;
  payload.active = !!active;

  await db.collection("users").doc(email).set(payload, { merge: true });

  const doc = await db.collection("users").doc(email).get();
  res.json(doc.data());
});

// POST /api/users/me/fcm-token — register a device token
router.post("/me/fcm-token", verifyToken, async (req, res) => {
  const email = req.user.email;
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "token required" });

  await db.collection("users").doc(email).set(
    { fcmTokens: admin.firestore.FieldValue.arrayUnion(token) },
    { merge: true }
  );
  res.json({ ok: true });
});

// DELETE /api/users/me/fcm-token — remove a device token
router.delete("/me/fcm-token", verifyToken, async (req, res) => {
  const email = req.user.email;
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "token required" });

  await db.collection("users").doc(email).update({
    fcmTokens: admin.firestore.FieldValue.arrayRemove(token),
  });
  res.json({ ok: true });
});

// POST /api/users/me/join/:ownerTag — friend connects their account to an owner
router.post("/me/join/:ownerTag", verifyToken, async (req, res) => {
  const { ownerTag } = req.params;
  const friendEmail = req.user.email;
  const friendUid = req.user.uid;

  // Verify the owner exists
  const ownerSnap = await db.collection("users").where("plusTag", "==", ownerTag).limit(1).get();
  if (ownerSnap.empty) {
    return res.status(404).json({ error: "Invalid invite link — account not found." });
  }

  const ownerDoc = ownerSnap.docs[0];
  const ownerEmail = ownerDoc.id;

  // Prevent owner from joining themselves
  if (ownerEmail === friendEmail) {
    return res.status(400).json({ error: "You are the account owner." });
  }

  // Create/update the friend's user record, linking them to the owner
  await db.collection("users").doc(friendEmail).set(
    {
      email: friendEmail,
      plusTag: friendUid,
      connectedTo: ownerTag,
      active: true,
      updatedAt: Date.now(),
    },
    { merge: true }
  );

  // Add the friend's email to the owner's members list
  await db.collection("users").doc(ownerEmail).update({
    members: admin.firestore.FieldValue.arrayUnion(friendEmail),
  });

  res.json({ ok: true });
});

export default router;