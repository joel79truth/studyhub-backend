importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAtK_FW9fIOihmnECEngkElA2QCsoRYUA0',
  authDomain: 'studyhub-backend.firebaseapp.com',
  projectId: 'studyhub-backend',
  storageBucket: 'studyhub-backend.firebasestorage.app',
  messagingSenderId: '985257842533',
  appId: '1:985257842533:web:cdba8c4138b3f7a3ad338c'
});

const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Received background message', payload);
  const notificationTitle = payload.notification.title || 'New Message';
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon.png'
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
