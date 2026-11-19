import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "../firebase";

// { user, loading }: loading stays true until Firebase has restored any saved session.
export function useAuth() {
  const [state, setState] = useState({ user: auth.currentUser, loading: !auth.currentUser });
  useEffect(() => onAuthStateChanged(auth, (user) => setState({ user, loading: false })), []);
  return state;
}

// Popup everywhere, phones included. Redirect sign-in loops on iPhone: the
// result is stored on the Firebase auth domain (firebaseapp.com), and Safari
// blocks that site's storage once you're back on lisap.app. Must be called
// straight from a tap, with no await before it, or the popup gets blocked.
export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export const signOutUser = () => signOut(auth);

export function authErrorMessage(err) {
  if (err?.code === "auth/popup-closed-by-user" || err?.code === "auth/cancelled-popup-request") return null;
  if (err?.code === "auth/popup-blocked") return "Your browser blocked the Google sign-in window. Allow pop-ups for lisap.app, then try again.";
  if (err?.code === "auth/network-request-failed") return "Google sign-in couldn’t connect. Check your connection, then try again.";
  return "Google sign-in didn’t finish. Try again.";
}
