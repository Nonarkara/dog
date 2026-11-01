// Tama-Dog-Chi service worker: his calls when the app is closed. Nothing is
// cached for offline use; the push carries no payload, so the words come
// from the note the app saved on this phone when you left.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (e) => e.waitUntil((async () => {
  const saved = await (await caches.open('dog-push')).match('/push-note');
  const note = saved ? await saved.json() : { title: 'Tama-Dog-Chi', body: 'Your dog is calling you.' };
  if (self.navigator.setAppBadge) self.navigator.setAppBadge(1).catch(() => {});
  await self.registration.showNotification(note.title, { body: note.body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'dog-call' });
})()));
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const open = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))[0];
    return open ? open.focus() : self.clients.openWindow('/?source=call');
  })());
});
