self.addEventListener("push", (event) => {
  const message = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification("AutoService", {
      body: message.body || "Пора проверить план ТО",
      icon: "./icon-192.png",
      tag: message.id || "service",
      data: { task: message.id },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL("./", self.registration.scope);
  if (event.notification.data?.task)
    url.searchParams.set("task", event.notification.data.task);
  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find((w) =>
        w.url.startsWith(self.registration.scope),
      );
      if (existing) {
        await existing.navigate(url.href);
        return existing.focus();
      }
      return clients.openWindow(url.href);
    })(),
  );
});
