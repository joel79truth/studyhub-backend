importScripts("https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAtK_FW9fIOihmnECEngkElA2QCsoRYUA0",
  authDomain: "studyhub-backend.firebaseapp.com",
  projectId: "studyhub-backend",
  messagingSenderId: "985257842533",
  appId: "1:985257842533:web:7cc7c9c0f74cc100ad338c"
});

firebase.messaging();

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  // Customize notification here
  const notificationTitle = payload.notification?.title || 'New Update';
  const notificationOptions = {
    body: payload.notification?.body || 'Check it out!',
    icon: 'public/icons/icon-192.png',      // make sure this file exists
    data: payload.data                 // passes data to click handler
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

/* ✅ CLICK HANDLER ONLY */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url =
    event.notification?.data?.url ||
    event.notification?.data?.FCM_MSG?.data?.url ||
    "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});
