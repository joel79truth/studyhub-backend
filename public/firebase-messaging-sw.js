// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

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