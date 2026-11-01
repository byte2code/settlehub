/* Imported by the generated service worker. Pushes carry no payload by design (see PushNotificationService),
   so the alert is generic and no personal data passes through the push service. */
self.addEventListener('push', (event) => {
  event.waitUntil(
    self.registration.showNotification('SettleHub', {
      body: 'You have new activity in your groups.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'settlehub-activity',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => 'focus' in c);
      return open ? open.focus() : self.clients.openWindow('/');
    }),
  );
});
