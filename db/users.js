import { db } from "../config/firebase.js";

export const saveUser = async (email, tokens) => {
  await db.collection("users").doc(email).set(
    {
      email,
      tokens,
      lastHistoryId: null,
      filters: {},
      phone: null,
      updatedAt: Date.now(),
    },
    { merge: true }
  );
};

export const getUser = async (email) => {
  const doc = await db.collection("users").doc(email).get();
  return doc.exists ? doc.data() : null;
};

export const updateUser = async (email, data) => {
  await db.collection("users").doc(email).update(data);
};
