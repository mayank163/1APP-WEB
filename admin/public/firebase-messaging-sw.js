// Register before Firebase, whose click listener otherwise consumes FCM notifications.
self.addEventListener('notificationclick', event => {
  event.stopImmediatePropagation();
  event.notification.close();
  const notificationData = event.notification.data || {};
  const { jobId } = notificationData.FCM_MSG?.data || notificationData;
  const path = jobId ? `/technician-jobs?jobId=${encodeURIComponent(jobId)}` : '/';
  const url = new URL(path, self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const appWindows = windows.filter(client => new URL(client.url).origin === self.location.origin);
    const existing = appWindows.find(client => client.url === url) || appWindows[0];

    if (existing) {
      try {
        const destination = existing.url === url ? existing : await existing.navigate(url);
        if (destination) return await destination.focus();
      } catch {
        // A tab may close while the click is being handled; open the destination below.
      }
    }
    return self.clients.openWindow(url);
  })());
});

importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCLIIbPgz9L_4FW7IAArxgANgznTbgeFQQ',
  authDomain: 'app-tech-3a417.firebaseapp.com',
  projectId: 'app-tech-3a417',
  storageBucket: 'app-tech-3a417.firebasestorage.app',
  messagingSenderId: '957547435039',
  appId: '1:957547435039:web:52646558885d06c212712a',
});

firebase.messaging().onBackgroundMessage(({ notification, data }) => {
  // Firebase already displays messages with a notification payload in the background.
  if (notification || !data?.title) return;
  return self.registration.showNotification(data.title, { body: data.body || '', data });
});

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});
