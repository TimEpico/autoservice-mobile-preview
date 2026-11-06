const service = "https://autoservice-to-push.youtydetg.workers.dev";
const publicKey =
  "BCEUS6zdXudCtkj65PGKfPmMKalVmd0lQKrDvnHlSI7HijF2Nzfpf5K3cBuKVMneA6zrA6dWEYoBtSa-pdlkYDs";
const credentialKey = "autoservice.push.device";
let subscription,
  pending = Promise.resolve();
const pushStatus = (text) => {
  $("pushStatus").textContent = text;
};
const supported =
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;
const registration = supported
  ? navigator.serviceWorker
      .register("./sw.js")
      .then(() => navigator.serviceWorker.ready)
  : null;
function buttons(active) {
  $("testPush").hidden = $("offPush").hidden = !active;
  $("enablePush").hidden = active;
}
function schedule() {
  const tasks = [];
  for (const car of data)
    for (const task of car.tasks) {
      if (task.done) continue;
      task.pushId ??= crypto.randomUUID();
      let at = Infinity;
      if (task.date) {
        const day = new Date(task.date + "T09:00:00");
        day.setDate(day.getDate() - task.days);
        at = day.getTime();
      }
      if (task.km !== null && car.km >= task.km - task.delta)
        at = Math.min(at, Date.now());
      if (Number.isFinite(at))
        tasks.push({
          id: task.pushId,
          at,
          label: car.name + " · " + task.name,
        });
    }
  localStorage.setItem(key, JSON.stringify(data));
  return tasks;
}
async function send(path, body) {
  const res = await fetch(service + path, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + localStorage.getItem(credentialKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw Error("Сервер уведомлений вернул ошибку " + res.status);
}
function queuePushSync(test = false) {
  if (!subscription) return Promise.resolve();
  const sync = pending.then(async () => {
    if (subscription)
      await send("/sync", {
        sub: subscription.toJSON(),
        tasks: schedule(),
        test,
      });
  });
  pending = sync.catch((err) =>
    pushStatus("Не удалось обновить напоминания. " + err.message),
  );
  return pending;
}
async function activate(test = false) {
  try {
    if (!supported)
      throw Error(
        "Откройте журнал с экрана «Домой» на iOS/iPadOS 16.4+ или в браузере с поддержкой push.",
      );
    if (
      Notification.permission !== "granted" &&
      (await Notification.requestPermission()) !== "granted"
    )
      throw Error(
        "Разрешите уведомления для AutoService в настройках устройства.",
      );
    const reg = await registration;
    subscription =
      (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: Uint8Array.from(
          atob(publicKey.replaceAll("-", "+").replaceAll("_", "/")),
          (c) => c.charCodeAt(0),
        ),
      }));
    if (!localStorage.getItem(credentialKey))
      localStorage.setItem(
        credentialKey,
        Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
          n.toString(16).padStart(2, "0"),
        ).join(""),
      );
    await pending;
    await send("/sync", {
      sub: subscription.toJSON(),
      tasks: schedule(),
      test,
    });
    buttons(true);
    pushStatus(
      test
        ? "Тест запланирован. Сверните приложение и подождите около 10 секунд."
        : "Уведомления включены.",
    );
  } catch (err) {
    pushStatus(err.message);
  }
}
$("enablePush").onclick = () => activate();
$("testPush").onclick = () => activate(true);
$("offPush").onclick = async () => {
  try {
    await pending;
    await send("/off", {});
    await subscription.unsubscribe();
    subscription = null;
    localStorage.removeItem(credentialKey);
    buttons(false);
    pushStatus("Уведомления отключены.");
  } catch (err) {
    pushStatus(err.message);
  }
};
registration
  ?.then(async (reg) => {
    subscription = await reg.pushManager.getSubscription();
    if (subscription && localStorage.getItem(credentialKey)) {
      buttons(true);
      await queuePushSync();
    }
  })
  .catch((err) => pushStatus(err.message));
window.addEventListener("online", () => queuePushSync());
const target = new URL(location.href).searchParams.get("task");
if (target && target !== "test") {
  const i = data.findIndex((car) =>
    car.tasks.some((t) => t.pushId === target && !t.done),
  );
  if (i >= 0) {
    index = i;
    past = false;
    render();
    complete(data[i].tasks.find((t) => t.pushId === target));
  }
}
