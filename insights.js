(() => {
  const $ = id => document.getElementById(id);

  function parseDateOnly(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return null;
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }

  function todayUtc() {
    const d = new Date();
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }

  function csvEscape(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  async function getSubscriptions() {
    const stored = await chrome.storage.local.get({ subscriptions: [] });
    return Array.isArray(stored.subscriptions) ? stored.subscriptions : [];
  }

  async function renderNext30() {
    const subscriptions = await getSubscriptions();
    const start = todayUtc();
    const end = new Date(start.getTime() + 30 * 86400000);
    const totals = new Map();
    let count = 0;

    for (const sub of subscriptions) {
      if (sub.active === false) continue;
      const renewal = parseDateOnly(sub.nextRenewalDate);
      if (!renewal || renewal < start || renewal > end) continue;
      const amount = Number(sub.amount);
      if (!Number.isFinite(amount) || amount < 0) continue;
      const currency = sub.currency || "EUR";
      totals.set(currency, (totals.get(currency) || 0) + amount);
      count += 1;
    }

    const container = $("next30Totals");
    if (!container) return;
    container.replaceChildren();

    if (!totals.size) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No active renewals scheduled in the next 30 days.";
      container.appendChild(empty);
      return;
    }

    const intro = document.createElement("div");
    intro.className = "total-row";
    intro.innerHTML = `<strong>${count} renewal${count === 1 ? "" : "s"}</strong><span>next 30 days</span>`;
    container.appendChild(intro);

    for (const [currency, amount] of [...totals.entries()].sort()) {
      const row = document.createElement("div");
      row.className = "total-row";
      const strong = document.createElement("strong");
      strong.textContent = currency;
      const value = document.createElement("span");
      value.textContent = amount.toFixed(2);
      row.append(strong, value);
      container.appendChild(row);
    }
  }

  $("exportCsv")?.addEventListener("click", async () => {
    const subscriptions = await getSubscriptions();
    if (!subscriptions.length) {
      const message = $("message");
      if (message) message.textContent = "Nothing to export yet.";
      return;
    }

    const headers = ["Name","Amount","Currency","Cadence","Next Renewal","Reminder Days","Category","Website","Notes","Active"];
    const rows = [headers.map(csvEscape).join(",")];
    for (const sub of subscriptions) {
      rows.push([
        sub.name, sub.amount, sub.currency, sub.cadence, sub.nextRenewalDate,
        sub.reminderDays, sub.category, sub.website, sub.notes, sub.active !== false
      ].map(csvEscape).join(","));
    }

    const blob = new Blob(["\uFEFF" + rows.join("\r\n")], { type:"text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `subscriptions-${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const message = $("message");
    if (message) message.textContent = "CSV exported.";
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.subscriptions) renderNext30().catch(() => {});
  });

  renderNext30().catch(() => {});
})();
