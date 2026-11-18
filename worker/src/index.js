// LISAP on Cloudflare Workers.
//   /api/*           JSON API for the React app (Firebase ID token auth)
//   /gmail/webhook   Google Cloud Pub/Sub push endpoint (shared-secret ?token=)
//   everything else  the built React app, served from static assets
//   cron             renew the Gmail watch daily and clean up old dedupe rows
import { handleApi } from "./api.js";
import { handleNotification, startWatch, cleanup } from "./mail.js";

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim());
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function withHeaders(res, headers) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(headers)) out.headers.set(k, v);
  return out;
}

function safeEqual(a = "", b = "") {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function handleWebhook(request, env) {
  const url = new URL(request.url);
  if (!safeEqual(url.searchParams.get("token") || "", env.PUBSUB_TOKEN || "")) {
    return new Response("Forbidden", { status: 403 });
  }
  let data;
  try {
    const body = await request.json();
    data = JSON.parse(atob(body?.message?.data || ""));
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!data?.historyId) return new Response(null, { status: 204 });

  try {
    const { processed } = await handleNotification(env, String(data.historyId));
    if (processed) console.log(`Processed ${processed} new message(s)`);
    return new Response(null, { status: 204 });
  } catch (err) {
    // Non-2xx makes Pub/Sub retry; processed messages are skipped on retry
    console.error("Webhook error:", err.message);
    return new Response("Error", { status: 500 });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith("/api/")) {
      const cors = corsHeaders(request, env);
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
      try {
        return withHeaders(await handleApi(request, env, path), cors);
      } catch (err) {
        console.error("API error:", err.message);
        return withHeaders(Response.json({ error: "Server error" }, { status: 500 }), cors);
      }
    }

    if (path === "/gmail/webhook" && request.method === "POST") return handleWebhook(request, env);

    // Manual watch start, e.g. right after the first deploy (same secret as the webhook)
    if (path === "/gmail/watch" && request.method === "POST") {
      if (!safeEqual(url.searchParams.get("token") || "", env.PUBSUB_TOKEN || "")) {
        return new Response("Forbidden", { status: 403 });
      }
      const res = await startWatch(env);
      return Response.json({ ok: true, expiration: new Date(Number(res.expiration)).toISOString() });
    }

    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      Promise.all([
        startWatch(env).catch((err) => console.error("Watch renewal failed:", err.message)),
        cleanup(env),
      ])
    );
  },
};
