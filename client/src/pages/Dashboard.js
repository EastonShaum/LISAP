import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { pushSupport, enablePush, refreshPush, disablePush } from "../firebase";
import CopyButton from "../components/CopyButton";

// What this device can do about notifications:
// on | off | blocked | needs-install | unsupported | error
function useDevicePush(user) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const support = await pushSupport();
      if (support !== "ready") return setState(support);
      if (Notification.permission === "denied") return setState("blocked");
      if (Notification.permission !== "granted") return setState("off");
      try {
        setState((await refreshPush()) ? "on" : "off");
      } catch {
        setState("error");
      }
    })();
  }, [user]);

  async function turnOn() {
    setBusy(true);
    try {
      const result = await enablePush();
      setState(result === "granted" ? "on" : result === "denied" ? "blocked" : "off");
    } catch {
      setState("error");
    }
    setBusy(false);
  }

  async function turnOff() {
    setBusy(true);
    try {
      await disablePush();
      setState("off");
    } catch {
      setState("error");
    }
    setBusy(false);
  }

  return { state, busy, turnOn, turnOff };
}

function DevicePanel({ push }) {
  const { state, busy, turnOn, turnOff } = push;
  return (
    <section className="panel" aria-labelledby="device-title">
      <h2 id="device-title" className="panel-title">
        This device
      </h2>
      <div aria-live="polite">
        {state === null && <p className="status">Checking notifications…</p>}
        {state === "on" && <p className="status status-ok">Codes arrive on this device.</p>}
        {state === "off" && <p className="status status-off">Notifications are off, so codes won’t arrive here.</p>}
        {state === "blocked" && (
          <p className="status status-warn">
            Notifications are blocked for lisap.app. Allow them in your browser’s site settings, then reload this page.
          </p>
        )}
        {state === "needs-install" && (
          <p className="status status-warn">
            On iPhone, codes only arrive in the Home Screen app. In Safari, tap Share, then Add to Home Screen, then
            open LISAP from your Home Screen and sign in.
          </p>
        )}
        {state === "unsupported" && (
          <p className="status status-warn">This browser can’t receive notifications. Open LISAP in Chrome, Edge or Firefox.</p>
        )}
        {state === "error" && (
          <p className="status status-off">Notifications couldn’t be set up. Reload the page and turn them on again.</p>
        )}
      </div>
      {(state === "off" || state === "error") && (
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={turnOn} disabled={busy}>
            {busy ? "Turning on…" : "Turn on notifications"}
          </button>
        </div>
      )}
      {state === "on" && (
        <div className="actions">
          <button type="button" className="btn btn-quiet btn-small" onClick={turnOff} disabled={busy}>
            {busy ? "Turning off…" : "Turn off on this device"}
          </button>
        </div>
      )}
    </section>
  );
}

function InstallButton() {
  const [prompt, setPrompt] = useState(null);
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  if (!prompt) return null;
  return (
    <button
      type="button"
      className="btn btn-quiet btn-small"
      onClick={async () => {
        prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === "accepted") setPrompt(null);
      }}
    >
      Install the LISAP app
    </button>
  );
}

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [me, setMe] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const push = useDevicePush(user);

  useEffect(() => {
    if (!user) return;
    api("/api/users/me")
      .then((r) => (r.ok ? setMe(r.data) : setLoadError(true)))
      .catch(() => setLoadError(true));
  }, [user]);

  if (!loading && !user) return <Navigate to="/login" replace />;
  if (loadError) {
    return (
      <p className="center-note" role="alert">
        LISAP couldn’t load your account. Check your connection, then reload the page.
      </p>
    );
  }
  if (loading || !me) return <p className="center-note" aria-live="polite">Loading…</p>;
  if (!me.exists) return <Navigate to="/login" replace />;

  const isOwner = !me.connectedTo;
  const joinUrl = `${window.location.origin}/join/${me.plusTag}`;
  const address = `lisap.code+${me.plusTag}@gmail.com`;

  return (
    <div className="wrap page">
      <h1 className="page-title">Your codes</h1>
      <p className="page-intro">
        {isOwner
          ? "When your streaming service emails a sign-in code, LISAP sends it to you and everyone you invited."
          : "You’re on a shared account. When its owner gets a sign-in code, LISAP sends it here too."}
      </p>

      <DevicePanel push={push} />

      {isOwner && (
        <>
          <section className="panel" aria-labelledby="people-title">
            <h2 id="people-title" className="panel-title">
              People on your account
            </h2>
            {me.members?.length ? (
              <ul className="people">
                {me.members.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">No one has joined yet. Send your invite link to the people who share the account.</p>
            )}
            <div className="copy-field">
              <span className="copy-value small" translate="no">
                {joinUrl}
              </span>
              <CopyButton text={joinUrl} label="Copy invite link" />
            </div>
          </section>

          <section className="panel" aria-labelledby="fwd-title">
            <h2 id="fwd-title" className="panel-title">
              Gmail forwarding
            </h2>
            <p className="muted">Your Gmail filter forwards streaming emails to this address:</p>
            <div className="copy-field">
              <span className="copy-value small" translate="no">
                {address}
              </span>
              <CopyButton text={address} label="Copy address" />
            </div>
            <p className="small">
              <Link to="/onboarding">Go through the Gmail setup again</Link>
            </p>
          </section>
        </>
      )}

      <div className="actions" style={{ marginTop: "1.5rem" }}>
        <InstallButton />
      </div>
    </div>
  );
}
