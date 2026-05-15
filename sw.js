// Service Worker para notificações push
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => { self.clients.claim(); });

// Recebe mensagem do app para mostrar notificação
self.addEventListener('message', e => {
  if(e.data && e.data.type === 'PUSH_NOTIF'){
    self.registration.showNotification(e.data.title, {
      body: e.data.body,
      icon: '/gestor-convocacoes/notif-icon.png',
      badge: '/gestor-convocacoes/notif-icon.png',
      vibrate: [200, 100, 200],
      tag: e.data.tag || 'convocacao',
      renotify: true,
      requireInteraction: true,
      data: { url: e.data.url || '/gestor-convocacoes/index.html' }
    });
  }
});

// Clique na notificação abre o app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window'}).then(cs => {
      const url = e.notification.data?.url || '/gestor-convocacoes/index.html';
      for(const c of cs){ if(c.url.includes('gestor-convocacoes') && 'focus' in c) return c.focus(); }
      return clients.openWindow(url);
    })
  );
});
