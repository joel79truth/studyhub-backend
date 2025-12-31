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

/* ===== BACKGROUND NOTIFICATIONS ===== */
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] BG message:", payload);

  const title = payload.notification?.title || "StudyHub Update";
  const body = payload.notification?.body || "New content available";
  const url = payload.data?.url || "/program.html";

  self.registration.showNotification(title, {
    body,
    icon: "/icon.png",
    data: {
      url,          // 👈 used on click
      program: payload.data?.program,
      semester: payload.data?.semester,
      subject: payload.data?.subject
    }
  });
});

/* ===== CLICK HANDLER ===== */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/program.html";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
