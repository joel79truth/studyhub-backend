importScripts("https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging-compat.js");

// Initialize Firebase
firebase.initializeApp({
  apiKey: "AIzaSyAtK_FW9fIOihmnECEngkElA2QCsoRYUA0",
  authDomain: "studyhub-backend.firebaseapp.com",
  databaseURL: "https://studyhub-backend-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "studyhub-backend",
  storageBucket: "studyhub-backend.firebasestorage.app",
  messagingSenderId: "985257842533",
  appId: "1:985257842533:web:7cc7c9c0f74cc100ad338c",
  measurementId: "G-2FHPEF5XBQ"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const notificationTitle = payload.notification?.title || "New Notification";
  const notificationBody = payload.notification?.body || "";
  const clickUrl = payload.notification?.click_action || payload.data?.url || "/";

  self.registration.showNotification(notificationTitle, {
    body: notificationBody,
    data: { url: clickUrl },
    icon: "/icon.png" // optional, add your icon path
  });
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
