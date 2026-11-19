import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from "firebase/auth";
import { auth, googleProvider } from "../firebase";

// { user, loading }: loading stays true until Firebase has restored any saved session.
export function useAuth() {
  const [state, setState] = useState({ user: auth.currentUser, loading: !auth.currentUser });
  useEffect(() => onAuthStateChanged(auth, (user) => setState({ user, loading: false })), []);
  return state;
}

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// Popups are unreliable on phones, so phones leave the page and come back.
export function signInWithGoogle() {
  return isMobile ? signInWithRedirect(auth, googleProvider) : signInWithPopup(auth, googleProvider);
}

export const signOutUser = () => signOut(auth);

export function authErrorMessage(err) {
  if (err?.code === "auth/popup-closed-by-user" || err?.code === "auth/cancelled-popup-request") return null;
  if (err?.code === "auth/popup-blocked") return "Your browser blocked the Google sign-in window. Allow pop-ups for lisap.app, then try again.";
  if (err?.code === "auth/network-request-failed") return "Google sign-in couldn’t connect. Check your connection, then try again.";
  return "Google sign-in didn’t finish. Try again.";
}
