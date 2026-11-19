import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getRedirectResult } from "firebase/auth";
import { auth } from "../firebase";
import { api } from "../lib/api";
import { useAuth, signInWithGoogle, signOutUser, authErrorMessage } from "../lib/auth";

const PENDING = "lisap-join";

function joinError(status) {
  if (status === 404) return "This invite link doesn’t match an account. Ask the person who sent it for a new link.";
  if (status === 400) return "This is your own invite link. Send it to the people who share your account.";
  return "LISAP couldn’t add you to the account. Check your connection, then try again.";
}

export default function Join() {
  const { ownerTag } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const started = useRef(false);

  async function join() {
    setBusy(true);
    setError(null);
    sessionStorage.removeItem(PENDING);
    const res = await api(`/api/users/me/join/${encodeURIComponent(ownerTag)}`, { method: "POST" }).catch(() => ({ status: 0 }));
    if (res.ok) return navigate("/dashboard", { replace: true });
    setError(joinError(res.status));
    setBusy(false);
  }

  useEffect(() => {
    getRedirectResult(auth).catch((err) => setError(authErrorMessage(err)));
  }, []);

  // Coming back from Google sign-in: finish joining without another tap.
  useEffect(() => {
    if (user && !started.current && sessionStorage.getItem(PENDING) === ownerTag) {
      started.current = true;
      join();
    }
  }); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignIn() {
    setError(null);
    setBusy(true);
    sessionStorage.setItem(PENDING, ownerTag);
    try {
      await signInWithGoogle();
    } catch (err) {
      sessionStorage.removeItem(PENDING);
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  if (loading) return <p className="center-note" aria-live="polite">Loading…</p>;

  return (
    <div className="wrap page">
      <h1 className="page-title">You’re invited to LISAP</h1>
      <p className="page-intro">
        Someone shared their streaming account with you. Join, turn on notifications, and every sign-in code for that
        account will show up on this phone within seconds.
      </p>

      {user ? (
        <div className="panel">
          <p>
            Signed in as <strong>{user.email}</strong>.
          </p>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={join} disabled={busy}>
              {busy ? "Joining…" : "Join this account"}
            </button>
            <button type="button" className="btn btn-quiet" onClick={signOutUser} disabled={busy}>
              Use a different Google account
            </button>
          </div>
        </div>
      ) : (
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={handleSignIn} disabled={busy}>
            {busy ? "Opening Google…" : "Sign in with Google to join"}
          </button>
        </div>
      )}

      {error && (
        <p className="alert" role="alert" style={{ marginTop: "1.5rem" }}>
          {error}
        </p>
      )}
    </div>
  );
}
