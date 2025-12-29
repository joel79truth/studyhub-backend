importScripts("https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging-compat.js");

firebase.initializeApp({
apiKey: "AIzaSyAtK_FW9fIOihmnECEngkElA2QCsoRYUA0",
  authDomain: "studyhub-backend.firebaseapp.com",
  projectId: "studyhub-backend",
  storageBucket: "studyhub-backend.firebasestorage.app",
  messagingSenderId: "985257842533",
  appId: "1:985257842533:web:7cc7c9c0f74cc100ad338c",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, click_action } = payload.notification;

  self.registration.showNotification(title, {
    body,
    data: { url: click_action },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
