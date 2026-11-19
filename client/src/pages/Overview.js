import { Link } from "react-router-dom";
import PhoneDemo from "../components/PhoneDemo";
import Mark from "../components/Mark";

const pipeline = [
  ["Gmail filter", "The owner’s Gmail forwards only Disney+ and Netflix emails, to a personal plus address."],
  ["LISAP inbox", "One shared Gmail inbox receives them. The plus address says whose account each email belongs to."],
  ["Gmail watch", "Gmail tells Google Cloud Pub/Sub the moment the inbox changes, so nothing is polled."],
  ["Cloudflare Worker", "Pub/Sub pushes to the Worker, which reads only the new messages and finds the code."],
  ["Firebase Cloud Messaging", "The code goes out as a push notification to every phone on that account."],
];

export default function Overview() {
  return (
    <>
      <section className="hero wrap">
        <div className="hero-copy">
          <h1 className="display">The code goes to whoever’s watching.</h1>
          <p className="lede">
            When Disney+ or Netflix emails a sign-in code to the account owner, LISAP sends it to the phone of
            everyone who shares the account, within seconds.
          </p>
          <div className="actions">
            <Link className="btn btn-primary" to="/login">
              Sign in
            </Link>
            <a className="btn btn-quiet" href="#setup">
              See how setup works
            </a>
          </div>
          <p className="fine">Invite-only for now. Friends and family join with a link from the account owner.</p>
        </div>
        <PhoneDemo />
      </section>

      <section className="band" aria-labelledby="before-after">
        <div className="wrap">
          <h2 id="before-after" className="section-title">
            No more “what’s the code?”
          </h2>
          <div className="compare">
            <div className="compare-col">
              <h3 className="compare-label">Without LISAP</h3>
              <ol className="thread" aria-label="Text messages">
                <li className="bubble bubble-out">
                  Can you send me the Disney code? <time>8:12</time>
                </li>
                <li className="bubble bubble-out">
                  Hello?? <time>8:19</time>
                </li>
                <li className="bubble bubble-in">
                  Sorry, was driving. 482913 <time>8:31</time>
                </li>
                <li className="bubble bubble-out">
                  It expired <time>8:32</time>
                </li>
              </ol>
            </div>
            <div className="compare-col">
              <h3 className="compare-label">With LISAP</h3>
              <div className="notif notif-static" role="img" aria-label="LISAP notification at 8:12: Disney+ code 482 913">
                <div className="notif-top" aria-hidden="true">
                  <span className="notif-app">
                    <span className="notif-icon">
                      <Mark size={14} />
                    </span>
                    LISAP
                  </span>
                  <span>8:12</span>
                </div>
                <p className="notif-title" aria-hidden="true">
                  Disney+ code
                </p>
                <p className="notif-code" aria-hidden="true">
                  482&nbsp;913
                </p>
              </div>
              <p className="compare-note">The same minute the email arrives, on every phone that shares the account.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="setup" className="wrap section" aria-labelledby="setup-title">
        <h2 id="setup-title" className="section-title">
          Setup takes about five minutes, once.
        </h2>
        <ol className="steps">
          <li>
            <h3>Sign in with Google</h3>
            <p>The account owner signs in with the Google account that gets the streaming service’s emails.</p>
          </li>
          <li>
            <h3>Add one Gmail filter</h3>
            <p>
              The filter forwards only Disney+ and Netflix emails to the owner’s LISAP address. The setup screen walks
              through each click, including Gmail’s confirmation code.
            </p>
          </li>
          <li>
            <h3>Send the invite link</h3>
            <p>
              Everyone who shares the account opens the link, signs in and turns on notifications. That’s all they do.
            </p>
          </li>
        </ol>
        <p className="privacy">
          LISAP never gets access to your Gmail. It only sees the emails your filter forwards to it.
        </p>
      </section>

      <section className="band" aria-labelledby="hood-title">
        <div className="wrap">
          <h2 id="hood-title" className="section-title">
            Under the hood
          </h2>
          <ol className="pipeline">
            {pipeline.map(([name, text]) => (
              <li key={name}>
                <h3>{name}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
          <p className="hood-note">
            It all runs on Cloudflare: a Worker, a D1 database and a daily job that renews the Gmail watch. Each email is
            handled once, even when Pub/Sub sends it twice.{" "}
            <a href="https://github.com/EastonShaum/LISAP">Read the source on GitHub</a>.
          </p>
        </div>
      </section>

      <footer className="wrap site-footer">
        <p>
          <span translate="no">LISAP</span>: Love Is Sharing A Password. Built for households sharing one account.
        </p>
        <p>
          Made by <a href="https://eastonshaum.com">Easton Shaum</a>.
        </p>
      </footer>
    </>
  );
}
