import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth, signOutUser } from "../lib/auth";
import CopyButton from "../components/CopyButton";

const STEPS = ["Your account", "Allow forwarding", "Create the filter", "Invite people", "Done"];
const SENDERS = ["disneyplus@mail.disneyplus.com", "info@account.netflix.com"];

export default function Onboarding() {
  const { user, loading } = useAuth();
  const [me, setMe] = useState(null);
  const [step, setStep] = useState(0);
  const [checking, setChecking] = useState(false);
  const [codeNote, setCodeNote] = useState("");
  const heading = useRef(null);

  useEffect(() => {
    if (user) api("/api/users/me").then((r) => setMe(r.data));
  }, [user]);

  // Move focus to the new step's heading so screen readers hear the change.
  useEffect(() => {
    if (me) heading.current?.focus();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || (user && !me)) return <p className="center-note" aria-live="polite">Loading…</p>;
  if (!user || !me.exists) return <Navigate to="/login" replace />;
  if (me.connectedTo) return <Navigate to="/dashboard" replace />;

  const address = `lisap.code+${me.plusTag}@gmail.com`;
  const joinUrl = `${window.location.origin}/join/${me.plusTag}`;
  const invite = `I set up LISAP so you get the sign-in codes for our shared streaming account on your phone, without waiting on me.\n\nOpen this link, sign in with Google and turn on notifications:\n${joinUrl}`;
  const confirmation = me.forwardingConfirmation;

  async function checkCode() {
    setChecking(true);
    setCodeNote("");
    const r = await api("/api/users/me").catch(() => null);
    setChecking(false);
    if (!r?.ok) return setCodeNote("LISAP couldn’t check for the code. Check your connection, then try again.");
    setMe(r.data);
    if (!r.data.forwardingConfirmation) {
      setCodeNote("No code yet. It usually arrives within a minute of adding the address in Gmail.");
    }
  }

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);

  return (
    <div className="wrap page">
      <ol className="progress" aria-hidden="true">
        {STEPS.map((s, i) => (
          <li key={s} data-state={i < step ? "done" : i === step ? "current" : "todo"} />
        ))}
      </ol>
      <p className="progress-label">
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </p>

      {step === 0 && (
        <>
          <h1 className="page-title" tabIndex={-1} ref={heading}>
            Set up your shared account
          </h1>
          <p className="page-intro">
            You’re the account owner: the person whose Gmail gets the Disney+ or Netflix emails. Setup takes about five
            minutes, then the people you invite get every code automatically.
          </p>
          <div className="panel">
            <p>
              Signed in as <strong>{user.email}</strong>. This should be the Gmail address your streaming service sends
              codes to.
            </p>
            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={next}>
                Continue as {user.email}
              </button>
              <button type="button" className="btn btn-quiet" onClick={signOutUser}>
                Use a different Google account
              </button>
            </div>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <h1 className="page-title" tabIndex={-1} ref={heading}>
            Let Gmail forward to LISAP
          </h1>
          <p className="page-intro">
            Gmail only forwards to addresses you’ve confirmed. This is your personal LISAP address:
          </p>
          <div className="panel">
            <div className="copy-field">
              <span className="copy-value" translate="no">
                {address}
              </span>
              <CopyButton text={address} label="Copy address" />
            </div>
            <ol className="checklist">
              <li>
                In Gmail on a computer, open <span className="ui">Settings</span>, then{" "}
                <span className="ui">See all settings</span>, then the{" "}
                <span className="ui">Forwarding and POP/IMAP</span> tab.
              </li>
              <li>
                Select <span className="ui">Add a forwarding address</span>, paste your LISAP address, then select{" "}
                <span className="ui">Next</span> and <span className="ui">Proceed</span>. Gmail sends LISAP a
                confirmation code.
              </li>
              <li>Get the code here and type it into Gmail’s box, then select <span className="ui">Verify</span>.</li>
              <li>
                Leave <span className="ui">Disable forwarding</span> selected. The filter in the next step forwards only
                the streaming emails, not everything.
              </li>
            </ol>
            <div className="actions">
              <button type="button" className="btn btn-quiet btn-small" onClick={checkCode} disabled={checking}>
                {checking ? "Checking…" : confirmation ? "Check for a newer code" : "Show my confirmation code"}
              </button>
              <a
                className="btn btn-quiet btn-small"
                href="https://mail.google.com/mail/u/0/#settings/fwdandpop"
                target="_blank"
                rel="noreferrer"
              >
                Open Gmail forwarding settings
              </a>
            </div>
            {confirmation?.code && (
              <div className="copy-field">
                <span className="copy-value big-code" translate="no">
                  {confirmation.code}
                </span>
                <CopyButton text={confirmation.code} label="Copy code" />
              </div>
            )}
            {confirmation?.link && (
              <p className="small muted">
                Or <a href={confirmation.link} target="_blank" rel="noreferrer">open Gmail’s confirmation page</a> and
                select Confirm.
              </p>
            )}
            <p className="small muted" aria-live="polite">
              {codeNote}
            </p>
          </div>
          <div className="actions" style={{ marginTop: "1.5rem" }}>
            <button type="button" className="btn btn-primary" onClick={next}>
              Gmail confirmed the address
            </button>
            <button type="button" className="btn btn-quiet" onClick={back}>
              Back
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="page-title" tabIndex={-1} ref={heading}>
            Create the filter
          </h1>
          <p className="page-intro">The filter sends only your streaming service’s emails to LISAP.</p>
          <div className="panel">
            <ol className="checklist">
              <li>
                In Gmail settings, open the <span className="ui">Filters and Blocked Addresses</span> tab and select{" "}
                <span className="ui">Create a new filter</span>.
              </li>
              <li>
                In <span className="ui">From</span>, paste the senders for the services you use. This covers both:
                <div className="copy-field" style={{ marginTop: "0.5rem" }}>
                  <span className="copy-value small" translate="no">
                    {SENDERS.join(" OR ")}
                  </span>
                  <CopyButton text={SENDERS.join(" OR ")} />
                </div>
              </li>
              <li>
                Select <span className="ui">Create filter</span>, check <span className="ui">Forward it to</span>, and
                choose your LISAP address.
              </li>
              <li>
                Select <span className="ui">Create filter</span> again to save it.
              </li>
            </ol>
            <div className="actions">
              <a
                className="btn btn-quiet btn-small"
                href="https://mail.google.com/mail/u/0/#settings/filters"
                target="_blank"
                rel="noreferrer"
              >
                Open Gmail filters
              </a>
            </div>
          </div>
          <div className="actions" style={{ marginTop: "1.5rem" }}>
            <button type="button" className="btn btn-primary" onClick={next}>
              The filter is saved
            </button>
            <button type="button" className="btn btn-quiet" onClick={back}>
              Back
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h1 className="page-title" tabIndex={-1} ref={heading}>
            Invite the people who share it
          </h1>
          <p className="page-intro">
            Send them this message. They sign in and turn on notifications; there’s nothing else for them to set up.
          </p>
          <div className="panel">
            <p className="invite-text">{invite}</p>
            <div className="actions">
              <CopyButton text={invite} label="Copy message" className="btn btn-primary btn-small" />
              {navigator.share && (
                <button
                  type="button"
                  className="btn btn-quiet btn-small"
                  onClick={() => navigator.share({ text: invite }).catch(() => {})}
                >
                  Share
                </button>
              )}
            </div>
            <p className="small muted">Your invite link is also on your dashboard.</p>
          </div>
          <div className="actions" style={{ marginTop: "1.5rem" }}>
            <button type="button" className="btn btn-primary" onClick={next}>
              Continue
            </button>
            <button type="button" className="btn btn-quiet" onClick={back}>
              Back
            </button>
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <h1 className="page-title" tabIndex={-1} ref={heading}>
            You’re set up
          </h1>
          <p className="page-intro">
            The next time Disney+ or Netflix emails you a code, LISAP sends it to everyone on the account. Turn on
            notifications on your dashboard to get codes on this device too.
          </p>
          <div className="panel">
            <h2 className="panel-title">Try it</h2>
            <p className="muted">
              Sign in to Disney+ or Netflix on a new device or browser and ask for a code. It should reach your phone a
              few seconds after the email lands in Gmail.
            </p>
          </div>
          <div className="actions" style={{ marginTop: "1.5rem" }}>
            <Link className="btn btn-primary" to="/dashboard">
              Go to the dashboard
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
