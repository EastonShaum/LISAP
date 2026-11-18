import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getMessaging, getToken, deleteToken, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_APIKEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

async function getMessagingInstance() {
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(app);
}

export async function registerFCMToken(idToken) {
  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const fcmToken = await getToken(messaging, {
    vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY,
  });

  if (fcmToken) {
    await fetch(`${process.env.REACT_APP_API_URL}/api/users/me/fcm-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ token: fcmToken }),
    });
  }

  return fcmToken;
}

export async function unregisterFCMToken(idToken) {
  const messaging = await getMessagingInstance();
  if (!messaging) return;

  const fcmToken = await getToken(messaging, {
    vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY,
  });

  if (fcmToken) {
    await deleteToken(messaging);
    await fetch(`${process.env.REACT_APP_API_URL}/api/users/me/fcm-token`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ token: fcmToken }),
    });
  }
}