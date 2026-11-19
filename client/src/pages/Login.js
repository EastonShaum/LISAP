import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRedirectResult } from "firebase/auth";
import { auth } from "../firebase";
import { api } from "../lib/api";
import { useAuth, signInWithGoogle, signOutUser, authErrorMessage } from "../lib/auth";

export default function Login() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState("idle"); // idle | signing-in | checking | invite-only
  const [error, setError] = useState(null);
  const checked = useRef(null);

  useEffect(() => {
    getRedirectResult(auth).catch((err) => setError(authErrorMessage(err)));
  }, []);

  // Once signed in: existing users go to their dashboard, invited owners start
  // setup, and anyone else sees that LISAP is invite-only.
  useEffect(() => {
    if (!user || checked.current === user.uid) return;
    checked.current = user.uid;
    (async () => {
      setPhase("checking");
      setError(null);
      try {
        const me = await api("/api/users/me");
        if (me.data.exists) return navigate("/dashboard", { replace: true });
        const created = await api("/api/users/me", { method: "POST", body: { active: true } });
        if (created.ok) return navigate("/onboarding", { replace: true });
        if (created.data.error === "invite_only") return setPhase("invite-only");
        throw new Error(created.data.error);
      } catch {
        checked.current = null;
        setPhase("idle");
        setError("LISAP couldn’t load your account. Check your connection, then sign in again.");
      }
    })();
  }, [user, navigate]);

  async function handleSignIn() {
    setError(null);
    setPhase("signing-in");
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(authErrorMessage(err));
      setPhase("idle");
    }
  }

  async function useDifferentAccount() {
    checked.current = null;
    await signOutUser();
    setPhase("idle");
  }

  if (loading || phase === "checking") {
    return <p className="center-note" aria-live="polite">Checking your account…</p>;
  }

  if (phase === "invite-only" && user) {
    return (
      <div className="wrap page">
        <h1 className="page-title">LISAP is invite-only right now</h1>
        <p className="page-intro">
          {user.email} isn’t on the invite list. If someone shares a streaming account with you, ask them for their
          invite link and open it to join.
        </p>
        <div className="actions">
          <button type="button" className="btn btn-quiet" onClick={useDifferentAccount}>
            Use a different Google account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap page">
      <h1 className="page-title">Sign in to LISAP</h1>
      <p className="page-intro">
        Use the Google account that gets your streaming service’s emails. If someone sent you an invite link, open
        that link instead.
      </p>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={handleSignIn} disabled={phase === "signing-in"}>
          {phase === "signing-in" ? "Opening Google…" : "Sign in with Google"}
        </button>
      </div>
      {error && (
        <p className="alert" role="alert" style={{ marginTop: "1.5rem" }}>
          {error}
        </p>
      )}
    </div>
  );
}
