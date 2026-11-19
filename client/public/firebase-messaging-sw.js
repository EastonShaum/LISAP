// Shows LISAP's push notifications. Firebase's page SDK subscribes this
// worker to FCM (getToken with serviceWorkerRegistration), so the worker
// itself needs no Firebase code or config: it reads FCM's payload directly.
// That keeps it working after the browser stops and restarts the worker.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { notification: { title: "LISAP", body: event.data && event.data.text() } };
  }
  const n = payload.notification || {};
  const data = payload.data || {};
  event.waitUntil(
    self.registration.showNotification(n.title || data.title || "LISAP", {
      body: n.body || data.body || "",
      icon: "/logo192.png",
      tag: payload.fcmMessageId || undefined,
      data: { url: "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => new URL(w.url).origin === self.location.origin);
      return open ? open.focus() : self.clients.openWindow(url);
    })
  );
});
