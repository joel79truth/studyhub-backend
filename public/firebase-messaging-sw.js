importScripts("https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAtK_FW9fIOihmnECEngkElA2QCsoRYUA0",
  authDomain: "studyhub-backend.firebaseapp.com",
  projectId: "studyhub-backend",
  messagingSenderId: "985257842533",
  appId:"1:985257842533:web:cdba8c4138b3f7a3ad338c", 
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(
    payload.notification.title,
    {
      body: payload.notification.body,
      icon: "/icon.png"
    }
  );
});
