importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// The main app sends Firebase config via postMessage after SW registration.
self.addEventListener("message", (event) => {
  if (event.data?.type === "FIREBASE_CONFIG" && !firebase.apps.length) {
    firebase.initializeApp(event.data.config);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const { title, body } = payload.notification;
      self.registration.showNotification(title, {
        body,
        icon: "/logo192.png",
      });
    });
  }
});
