# LISAP: Love Is Sharing A Password

When a streaming service sends a sign-in code to the account owner's Gmail, LISAP pushes that code to the phones of everyone who shares the account, within seconds. Nobody has to text the owner "what's the code?" again.

```
Owner's Gmail ──filter: forward Disney+/Netflix mail──▶ lisap.code+<owner-id>@gmail.com
                                                            │
                                         Gmail watch → Google Cloud Pub/Sub (push)
                                                            │
                                                            ▼
                                        LISAP server  POST /gmail/webhook
                                          1. list new messages since the stored history cursor
                                          2. read the +tag from Delivered-To → find the owner in Firestore
                                          3. pull the code out of the email
                                          4. Firebase Cloud Messaging → owner's and friends' phones
```

## How it works

- **One shared inbox, no access to yours.** Each owner forwards only the streaming emails to their own plus address on the LISAP inbox (`lisap.code+<id>@gmail.com`). LISAP never asks for permission to read the owner's Gmail.
- **Push, not polling.** Gmail's `users.watch` publishes to a Pub/Sub topic whenever the LISAP inbox changes, and Pub/Sub pushes that to the server. The server asks Gmail's History API for exactly what was added since its stored cursor.
- **Codes, not emails.** The server finds the sign-in code in the message (for example `482913`) and sends a notification like "Disney+ code: 482 913". If it can't find a code, it sends the subject and a short preview instead.
- **Friends join with a link.** The owner shares an invite link. Friends sign in with Google, allow notifications, and get every code from then on.
- **Gmail's forwarding check is handled.** Before Gmail forwards anywhere, it emails a confirmation code to the new address. LISAP catches that email, saves the code to the owner's record and shows it on the onboarding screen, so the owner can finish setup without access to the LISAP inbox.

### Reliability

- **History cursor:** the last processed Gmail `historyId` is stored in Firestore (`system/gmailWatch`), so restarts don't drop mail. If the cursor is too old for Gmail's history (about a week), the server scans the last day of inbox mail instead.
- **No duplicate pushes:** each Gmail message id is claimed in `processedMessages` before it's processed. Pub/Sub retries and overlapping notifications are skipped. To clean old claims automatically, add a Firestore TTL policy on the `expireAt` field.
- **Watch renewal:** the Gmail watch is renewed every 24 hours. It would otherwise expire after 7 days.
- **Dead devices:** device tokens that FCM reports as uninstalled or invalid are removed from users.

### Why this design

The first version polled each user's Gmail through OAuth and sent codes by Twilio SMS. Polling was slow and wasted API quota. SMS cost money per message and needed a verified sender number. Reading every owner's inbox also asked for far more access than the app needed. Forwarding to one inbox, plus Pub/Sub and web push, is faster, free at this scale, and needs no access to users' mail.

## Stack

- **Server:** Node.js, Express, Gmail API (`googleapis`), Google Cloud Pub/Sub, Firebase Admin (Firestore, Auth, Cloud Messaging)
- **Client:** React, Chakra UI, Firebase Auth (Google sign-in), Firebase Cloud Messaging web push with a service worker

## Project layout

```
index.js                         Express app: API, Pub/Sub webhook, serves client/build
routes/users.js                  /api/users: profile, device tokens, invites (Firebase ID token auth)
routes/gmailWebhook.js           POST /gmail/webhook (Pub/Sub push endpoint)
services/gmailWatch.js           Gmail watch, daily renewal, history cursor in Firestore
services/processEmail.js         new-message handling, dedupe, routing to owner and friends
services/parseEmail.js           pure helpers: body text, plus tag, code extraction, forwarding confirmation
services/notificationService.js  FCM multicast and dead-token cleanup
config/google.js                 Gmail client from env vars (or local credentials.json + token.json)
config/firebase.js               Firebase Admin from env vars (or local serviceAccountKey.json)
client/                          React app (onboarding, dashboard, phones, invites)
test/                            node:test unit tests for the parsing helpers
```

## Setup

### 1. Google Cloud

1. Create a project and enable the **Gmail API** and **Cloud Pub/Sub API**.
2. Create a Pub/Sub topic (for example `lisap`). Grant `gmail-api-push@system.gserviceaccount.com` the **Pub/Sub Publisher** role on it.
3. Create a **push subscription** on the topic with the endpoint `https://<your-api-host>/gmail/webhook`.
4. Create an OAuth client with a `http://localhost` redirect URI and download it as `credentials.json`.

### 2. The shared inbox

Create a Gmail account for LISAP, then run:

```bash
npm install
node getToken.js
```

Sign in as the LISAP account. This saves `token.json` locally. For a hosted deploy, copy its `refresh_token` into `GOOGLE_REFRESH_TOKEN`.

### 3. Firebase

1. Create a Firebase project and enable **Google sign-in**, **Firestore** and **Cloud Messaging**.
2. Download a service account key as `serviceAccountKey.json`, or set `FIREBASE_SERVICE_ACCOUNT`.
3. Create a web app. Put its config and VAPID key in `client/.env` as the `REACT_APP_FIREBASE_*` variables.

### 4. Run

```bash
cp .env.example .env              # fill it in
npm run build --prefix client     # build the React app
npm start                         # API + webhook + client on PORT (default 3000)
npm test                          # parsing tests
```

`credentials.json`, `token.json`, `serviceAccountKey.json` and every `.env` file are gitignored. Keep them that way.

## Hosting

The server needs a public HTTPS URL for the Pub/Sub push subscription. It runs behind a Cloudflare Tunnel (`cloudflared tunnel run lisap`) on an always-on machine, with Express serving both the built client and the API on one port.
