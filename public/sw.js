// Minimal push-only service worker — no offline caching, just receives and
// displays Web Push messages sent by the send-push / send-daily-reminders
// Edge Functions, and focuses/opens the right page on click.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'Prodip (PVMS)', body: 'You have a new notification.', link: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { link: data.link || '/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(link) && 'focus' in client) return client.focus();
      }
      if (clients.length > 0 && 'focus' in clients[0]) {
        clients[0].navigate(link);
        return clients[0].focus();
      }
      return self.clients.openWindow(link);
    })
  );
});
