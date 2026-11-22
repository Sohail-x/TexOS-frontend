self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() || "A customer order is waiting for approval." };
  }
  event.waitUntil(self.registration.showNotification(payload.title || "New order needs approval", {
    body: payload.body || "A customer order is waiting for staff approval.",
    tag: payload.tag || "texos-order-approval",
    data: { url: payload.url || "/order-approval" },
    icon: "/favicon.ico",
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/order-approval", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
    return existing ? existing.navigate(target).then(() => existing.focus()) : self.clients.openWindow(target);
  }));
});
