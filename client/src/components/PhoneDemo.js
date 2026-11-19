import Mark from "./Mark";

// The hero: a phone lock screen on a Friday night, and the one notification
// LISAP exists to send. It slides in once on load (or just appears with
// reduced motion).
export default function PhoneDemo() {
  return (
    <figure className="phone" aria-label="A phone lock screen showing a LISAP notification: Disney+ code 482 913">
      <div className="phone-screen" aria-hidden="true">
        <p className="lock-day">Friday</p>
        <p className="lock-time">8:12</p>
        <div className="notif">
          <div className="notif-top">
            <span className="notif-app">
              <span className="notif-icon">
                <Mark size={14} />
              </span>
              LISAP
            </span>
            <span>now</span>
          </div>
          <p className="notif-title">Disney+ code</p>
          <p className="notif-code">482&nbsp;913</p>
        </div>
      </div>
    </figure>
  );
}
