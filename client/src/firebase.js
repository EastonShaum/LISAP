import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getMessaging, getToken, deleteToken, isSupported } from "firebase/messaging";
import { api } from "./lib/api";

const app = initializeApp({
  apiKey: process.env.REACT_APP_FIREBASE_APIKEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY;

// "ready" | "needs-install" (iPhone Safari outside the Home Screen app) | "unsupported"
export async function pushSupport() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (ios && !standalone) return "needs-install";
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  return (await isSupported()) ? "ready" : "unsupported";
}

async function registration() {
  await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  return navigator.serviceWorker.ready;
}

// Must run from a tap or click: iPhones only show the permission prompt then.
export async function enablePush() {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;
  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: await registration() });
  if (!token) throw new Error("No push token");
  await api("/api/users/me/fcm-token", { method: "POST", body: { token } });
  return "granted";
}

// Re-sends this device's token on each visit, so the server copy stays current.
export async function refreshPush() {
  if (Notification.permission !== "granted") return false;
  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: await registration() });
  if (token) await api("/api/users/me/fcm-token", { method: "POST", body: { token } });
  return !!token;
}

export async function disablePush() {
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: await registration() });
  if (!token) return;
  await api("/api/users/me/fcm-token", { method: "DELETE", body: { token } });
  await deleteToken(messaging);
}
