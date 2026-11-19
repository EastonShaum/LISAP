# LISAP: Love Is Sharing A Password

When a streaming service sends a sign-in code to the account owner's Gmail, LISAP pushes that code to the phones of everyone who shares the account, within seconds. Nobody has to text the owner "what's the code?" again.

Live at [lisap.app](https://lisap.app). It runs entirely on Cloudflare (a Worker, D1 and static assets), with Firebase used only for Google sign-in and push notifications.

```
Owner's Gmail ──filter: forward Disney+/Netflix mail──▶ lisap.code+<owner-id>@gmail.com
                                                            │
                                         Gmail watch → Google Cloud Pub/Sub (push)
                                                            │
                                                            ▼
                               Cloudflare Worker  POST /gmail/webhook?token=…
                                 1. list new messages since the history cursor (D1)
                                 2. read the +tag from Delivered-To → owner and friends (D1)
                                 3. pull the code out of the email
                                 4. Firebase Cloud Messaging → every phone on the account
```

## How it works

- **One shared inbox, no access to yours.** Each owner forwards only the streaming emails to their own plus address on the LISAP inbox (`lisap.code+<id>@gmail.com`). LISAP never asks for permission to read the owner's Gmail.
- **Push, not polling.** Gmail's `users.watch` publishes to a Pub/Sub topic whenever the LISAP inbox changes, and Pub/Sub pushes that to the Worker. The Worker asks Gmail's History API for exactly what was added since its stored cursor.
- **Codes, not emails.** The Worker finds the sign-in code in the message (for example `482913`) and sends a notification like "Disney+ code: 482 913". If it can't find a code, it sends the subject and a short preview instead.
- **Friends join with a link.** The owner shares an invite link. Friends sign in with Google, allow notifications, and get every code from then on.
- **Gmail's forwarding check is handled.** Before Gmail forwards anywhere, it emails a confirmation code to the new address. LISAP catches that email, saves the code and shows it on the onboarding screen, so the owner can finish setup without access to the LISAP inbox.

### Reliability

- **History cursor:** the last processed Gmail `historyId` is stored in D1 and only ever moves forward. If it's too old for Gmail's history (about a week), the Worker scans the last day of inbox mail instead.
- **No duplicate pushes:** each Gmail message id is claimed in the `processed` table before it's handled, so Pub/Sub retries and overlapping notifications are skipped. Claims older than 7 days are deleted daily.
- **Watch renewal:** a daily cron trigger renews the Gmail watch, which would otherwise expire after 7 days.
- **Dead devices:** device tokens that FCM reports as unregistered are deleted.
- **Locked-down webhook:** the Pub/Sub endpoint requires a secret `?token=`. API calls require a Firebase ID token, which the Worker verifies against Google's published keys.

### Why this design

The first version polled each user's Gmail through OAuth and sent codes by Twilio SMS. Polling was slow and wasted API quota. SMS cost money per message and needed a verified sender number. Reading every owner's inbox also asked for far more access than the app needed.

The second version, Express on a laptop behind a Cloudflare Tunnel, was only up while that computer was running. Moving to a Worker made it always-on and free at this scale. It also meant dropping the Node-only Google and Firebase SDKs for plain `fetch` calls and WebCrypto-signed JWTs.

## Stack

- **Backend:** Cloudflare Workers, D1 (SQLite), cron triggers, Gmail API, Google Cloud Pub/Sub, Firebase Cloud Messaging HTTP v1. No runtime dependencies.
- **Client:** React with plain CSS (Bricolage Grotesque and Atkinson Hyperlegible), Firebase Auth (Google sign-in), FCM web push with a service worker, served as Worker static assets.

## Project layout

```
wrangler.toml            Worker config: custom domains, D1, assets, cron, vars
worker/schema.sql        D1 tables: users, members, devices, processed, state
worker/src/index.js      routing: /api/*, /gmail/webhook, static app, cron
worker/src/api.js        /api/users/*: profile, device tokens, invites
worker/src/mail.js       Gmail watch, history cursor, new-message handling, dedupe
worker/src/parseEmail.js pure helpers: body text, plus tag, code extraction, forwarding confirmation
worker/src/fcm.js        push notifications and dead-token cleanup
worker/src/google.js     OAuth access tokens, Gmail calls, Firebase ID token checks
worker/src/jwt.js        RS256 sign/verify on WebCrypto
client/                  React app (onboarding, dashboard, phones, invites)
test/                    node:test: parsing helpers and an end-to-end Worker test (SQLite as D1, fake Google)
scripts/export-firestore.mjs  one-time move of users from Firestore to D1
getToken.js              gets the shared inbox's Gmail refresh token
```

## Setup

### 1. Google Cloud

1. Create a project and enable the **Gmail API** and **Cloud Pub/Sub API**.
2. Create a Pub/Sub topic (for example `lisap`). Grant `gmail-api-push@system.gserviceaccount.com` the **Pub/Sub Publisher** role on it.
3. Create an OAuth client with a `http://localhost` redirect URI and download it as `credentials.json`.

### 2. The shared inbox

Create a Gmail account for LISAP, then run:

```bash
npm install
npm run gettoken
```

Sign in as the LISAP account. This saves `token.json`; its `refresh_token` becomes the `GOOGLE_REFRESH_TOKEN` secret.

### 3. Firebase

1. Create a Firebase project and enable **Google sign-in** and **Cloud Messaging**.
2. Create a service account key. Its JSON becomes the `FIREBASE_SERVICE_ACCOUNT` secret.
3. Create a web app. Put its config and VAPID key in `client/.env` as the `REACT_APP_FIREBASE_*` variables.

### 4. Cloudflare

```bash
npx wrangler login
npx wrangler d1 create lisap          # put the database_id in wrangler.toml
npm run db:init                       # create the tables
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_REFRESH_TOKEN
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
npx wrangler secret put PUBSUB_TOKEN  # any long random string
npm run deploy                        # builds the client and deploys the Worker
```

Then:

1. **Pub/Sub subscription:** create a push subscription on the topic with the endpoint `https://lisap.app/gmail/webhook?token=<PUBSUB_TOKEN>`.
2. **Start the Gmail watch:** run `curl -X POST "https://lisap.app/gmail/watch?token=<PUBSUB_TOKEN>"` once. After that, the daily cron renews it.

### Invites

Anyone can read the overview at lisap.app, but creating a new owner account is invite-only. Friends who open an owner's `/join/…` link can always sign up. To let someone set up their own shared account:

```bash
npx wrangler d1 execute lisap --remote --command "INSERT INTO invites (email, created_at) VALUES ('name@gmail.com', unixepoch() * 1000)"
```

### Local development

Copy `.dev.vars.example` to `.dev.vars` and fill it in, then run `npm run dev`. To run the tests:

```bash
npm test
```

`credentials.json`, `token.json`, `serviceAccountKey.json`, `.dev.vars`, `seed.sql` and every `.env` file are gitignored. Keep them that way.
