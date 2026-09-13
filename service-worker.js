const CHECK_ALARM = "SR_RENEWAL_CHECK";

function dateOnlyToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;

  return new Date(Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  ));
}

function daysBetween(fromDate, toDate) {
  const a = parseDateOnly(fromDate);
  const b = parseDateOnly(toDate);
  if (!a || !b) return null;
  return Math.round((b - a) / 86400000);
}

async function getSubscriptions() {
  const stored = await chrome.storage.local.get({ subscriptions: [] });
  return Array.isArray(stored.subscriptions) ? stored.subscriptions : [];
}

async function checkRenewals() {
  const subscriptions = await getSubscriptions();
  const today = dateOnlyToday();

  const stored = await chrome.storage.local.get({ sentReminders: {} });
  const sentReminders = { ...(stored.sentReminders || {}) };

  for (const sub of subscriptions) {
    if (sub.active === false || !sub.nextRenewalDate) continue;

    const days = daysBetween(today, sub.nextRenewalDate);
    if (days === null) continue;

    const reminderDays = Math.max(0, Number(sub.reminderDays ?? 3));
    const shouldNotify = days <= reminderDays;

    if (!shouldNotify) continue;

    const reminderKey = `${sub.id}:${sub.nextRenewalDate}`;
    if (sentReminders[reminderKey]) continue;

    let timingText = "";
    if (days < 0) {
      timingText = `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
    } else if (days === 0) {
      timingText = "renews today";
    } else {
      timingText = `renews in ${days} day${days === 1 ? "" : "s"}`;
    }

    const amount = Number(sub.amount);
    const priceText = Number.isFinite(amount) && amount >= 0
      ? ` • ${sub.currency || "EUR"} ${amount.toFixed(2)}`
      : "";

    await chrome.notifications.create(`sr-${sub.id}`, {
      type: "basic",
      iconUrl: "icon128.png",
      title: `Subscription reminder: ${sub.name || "Subscription"}`,
      message: `${timingText}${priceText}`,
      priority: 1
    });

    sentReminders[reminderKey] = Date.now();
  }

  const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
  for (const [key, ts] of Object.entries(sentReminders)) {
    if (Number(ts) < cutoff) delete sentReminders[key];
  }

  await chrome.storage.local.set({ sentReminders });
}

async function ensureAlarm() {
  const existing = await chrome.alarms.get(CHECK_ALARM);

  if (!existing) {
    await chrome.alarms.create(CHECK_ALARM, {
      delayInMinutes: 1,
      periodInMinutes: 360
    });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  ensureAlarm().catch(() => {});
  checkRenewals().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarm().catch(() => {});
  checkRenewals().catch(() => {});
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === CHECK_ALARM) {
    checkRenewals().catch(() => {});
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.subscriptions) {
    checkRenewals().catch(() => {});
  }
});

ensureAlarm().catch(() => {});

