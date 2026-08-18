// Firebase Cloud Messaging service worker for Platemate workout reminders.
// This file must be deployed at the root of your site (same folder as index.html),
// because its default scope only covers the URL path it's served from.

importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js');

// Must match the firebaseConfig object in index.html.
firebase.initializeApp({
  apiKey: "AIzaSyBBGigDjyeo55wJQWvJkt4W-c_1cbfVsQU",
  authDomain: "platemate-f76cc.firebaseapp.com",
  projectId: "platemate-f76cc",
  storageBucket: "platemate-f76cc.firebasestorage.app",
  messagingSenderId: "883328545046",
  appId: "1:883328545046:web:c6403814ac32fc80e32037",
});

const messaging = firebase.messaging();

// Fires when a push arrives while the app is NOT in the foreground
// (backgrounded tab, app closed, or phone locked).
messaging.onBackgroundMessage(function(payload) {
  const title = (payload.notification && payload.notification.title) || 'Platemate';
  const options = {
    body: (payload.notification && payload.notification.body) || "Don't forget to log today's workout!",
    icon: './icon-192x192.png',
    badge: './icon-192x192.png',
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

// Tapping the notification focuses an open Platemate tab, or opens a new one.
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./index.html');
    })
  );
});
