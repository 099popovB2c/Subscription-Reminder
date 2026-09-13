const $ = id => document.getElementById(id);

let editingId = null;

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function todayKey() {
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

function clean(value) {
  return String(value || "").trim();
}

function normalizeWebsite(value) {
  const text = clean(value);
  if (!text) return "";

  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return url.href;
  } catch {
    return text;
  }
}

function cadenceLabel(sub) {
  if (sub.cadence === "custom") {
    return `Every ${Math.max(1, Number(sub.customDays || 30))} days`;
  }

  const labels = {
    weekly: "Weekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
    annual: "Annual"
  };

  return labels[sub.cadence] || "Monthly";
}

function monthlyEquivalent(sub) {
  const amount = Number(sub.amount);
  if (!Number.isFinite(amount) || amount < 0 || sub.active === false) return 0;

  switch (sub.cadence) {
    case "weekly":
      return amount * 52 / 12;
    case "quarterly":
      return amount / 3;
    case "annual":
      return amount / 12;
    case "custom": {
      const days = Math.max(1, Number(sub.customDays || 30));
      return amount * 365 / days / 12;
    }
    default:
      return amount;
  }
}

async function getSubscriptions() {
  const stored = await chrome.storage.local.get({ subscriptions: [] });
  return Array.isArray(stored.subscriptions) ? stored.subscriptions : [];
}

async function saveSubscriptions(subscriptions) {
  await chrome.storage.local.set({ subscriptions });
}

function flash(text) {
  $("message").textContent = text;
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => {
    $("message").textContent = "All data stays in your browser.";
  }, 1600);
}

function clearForm() {
  editingId = null;
  $("formTitle").textContent = "Add subscription";
  $("saveSubscription").textContent = "Add Subscription";
  $("cancelEdit").classList.add("hidden");

  $("name").value = "";
  $("amount").value = "";
  $("currency").value = "EUR";
  $("cadence").value = "monthly";
  $("customDays").value = "30";
  $("customDaysWrap").classList.add("hidden");
  $("nextRenewalDate").value = "";
  $("reminderDays").value = "3";
  $("category").value = "";
  $("website").value = "";
  $("notes").value = "";
}

function fillForm(sub) {
  editingId = sub.id;
  $("formTitle").textContent = "Edit subscription";
  $("saveSubscription").textContent = "Update Subscription";
  $("cancelEdit").classList.remove("hidden");

  $("name").value = sub.name || "";
  $("amount").value = Number.isFinite(Number(sub.amount)) ? String(sub.amount) : "";
  $("currency").value = sub.currency || "EUR";
  $("cadence").value = sub.cadence || "monthly";
  $("customDays").value = String(sub.customDays || 30);
  $("customDaysWrap").classList.toggle("hidden", sub.cadence !== "custom");
  $("nextRenewalDate").value = sub.nextRenewalDate || "";
  $("reminderDays").value = String(sub.reminderDays ?? 3);
  $("category").value = sub.category || "";
  $("website").value = sub.website || "";
  $("notes").value = sub.notes || "";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderTotals(subscriptions) {
  const byCurrency = new Map();

  for (const sub of subscriptions) {
    if (sub.active === false) continue;

    const currency = sub.currency || "EUR";
    const monthly = monthlyEquivalent(sub);
    const current = byCurrency.get(currency) || 0;
    byCurrency.set(currency, current + monthly);
  }

  $("totals").replaceChildren();

  if (!byCurrency.size) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No active recurring costs yet.";
    $("totals").appendChild(empty);
    return;
  }

  for (const [currency, monthly] of [...byCurrency.entries()].sort()) {
    const card = document.createElement("div");
    card.className = "total-row";

    const name = document.createElement("strong");
    name.textContent = currency;

    const values = document.createElement("span");
    values.textContent = `${monthly.toFixed(2)}/month • ${(monthly * 12).toFixed(2)}/year`;

    card.appendChild(name);
    card.appendChild(values);
    $("totals").appendChild(card);
  }
}

function statusInfo(sub) {
  const days = daysBetween(todayKey(), sub.nextRenewalDate);

  if (days === null) {
    return { text: "No renewal date", kind: "neutral", days: null };
  }

  if (days < 0) {
    return {
      text: `${Math.abs(days)}d overdue`,
      kind: "overdue",
      days
    };
  }

  if (days === 0) {
    return { text: "Renews today", kind: "soon", days };
  }

  if (days <= 7) {
    return { text: `Renews in ${days}d`, kind: "soon", days };
  }

  return { text: `Renews ${sub.nextRenewalDate}`, kind: "normal", days };
}

function subscriptionCard(sub) {
  const card = document.createElement("article");
  card.className = `subscription ${sub.active === false ? "inactive" : ""}`;

  const top = document.createElement("div");
  top.className = "subscription-top";

  const main = document.createElement("div");
  main.className = "subscription-main";

  const name = document.createElement("strong");
  name.textContent = sub.name || "Unnamed subscription";

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = [
    sub.category,
    cadenceLabel(sub)
  ].filter(Boolean).join(" • ");

  main.appendChild(name);
  main.appendChild(meta);

  const price = document.createElement("div");
  price.className = "price";

  const amount = Number(sub.amount);
  price.textContent = Number.isFinite(amount)
    ? `${sub.currency || "EUR"} ${amount.toFixed(2)}`
    : sub.currency || "EUR";

  top.appendChild(main);
  top.appendChild(price);

  const renewal = statusInfo(sub);
  const status = document.createElement("div");
  status.className = `renewal ${renewal.kind}`;
  status.textContent = renewal.text;

  const reminder = document.createElement("div");
  reminder.className = "reminder";
  reminder.textContent = `Reminder: ${Number(sub.reminderDays ?? 3)} day(s) before`;

  card.appendChild(top);
  card.appendChild(status);
  card.appendChild(reminder);

  if (sub.notes) {
    const notes = document.createElement("div");
    notes.className = "notes";
    notes.textContent = sub.notes;
    card.appendChild(notes);
  }

  const actions = document.createElement("div");
  actions.className = "actions";

  if (sub.website) {
    const open = document.createElement("button");
    open.textContent = "Open";
    open.addEventListener("click", () => {
      chrome.tabs?.create
        ? chrome.tabs.create({ url: sub.website })
        : window.open(sub.website, "_blank");
    });
    actions.appendChild(open);
  }

  const edit = document.createElement("button");
  edit.textContent = "Edit";
  edit.addEventListener("click", () => fillForm(sub));

  const toggle = document.createElement("button");
  toggle.textContent = sub.active === false ? "Activate" : "Pause";
  toggle.addEventListener("click", async () => {
    const subscriptions = await getSubscriptions();
    const found = subscriptions.find(item => item.id === sub.id);
    if (!found) return;

    found.active = found.active === false;
    found.updatedAt = Date.now();

    await saveSubscriptions(subscriptions);
    await render();
    flash(found.active ? "Subscription activated." : "Subscription paused.");
  });

  const remove = document.createElement("button");
  remove.className = "danger";
  remove.textContent = "Delete";
  remove.addEventListener("click", async () => {
    if (!confirm(`Delete "${sub.name || "this subscription"}"?`)) return;

    const subscriptions = (await getSubscriptions())
      .filter(item => item.id !== sub.id);

    await saveSubscriptions(subscriptions);

    if (editingId === sub.id) clearForm();

    await render();
    flash("Subscription deleted.");
  });

  actions.appendChild(edit);
  actions.appendChild(toggle);
  actions.appendChild(remove);
  card.appendChild(actions);

  return card;
}

async function render() {
  const subscriptions = await getSubscriptions();
  const today = todayKey();

  const active = subscriptions.filter(sub => sub.active !== false);
  const soon = active.filter(sub => {
    const days = daysBetween(today, sub.nextRenewalDate);
    return days !== null && days >= 0 && days <= 7;
  });
  const overdue = active.filter(sub => {
    const days = daysBetween(today, sub.nextRenewalDate);
    return days !== null && days < 0;
  });

  $("countActive").textContent = String(active.length);
  $("countSoon").textContent = String(soon.length);
  $("countOverdue").textContent = String(overdue.length);

  renderTotals(subscriptions);

  const query = clean($("search").value).toLowerCase();
  const filter = $("filter").value;

  const visible = subscriptions
    .filter(sub => {
      if (filter === "active") return sub.active !== false;
      if (filter === "inactive") return sub.active === false;

      const days = daysBetween(today, sub.nextRenewalDate);

      if (filter === "soon") {
        return sub.active !== false && days !== null && days >= 0 && days <= 7;
      }

      if (filter === "overdue") {
        return sub.active !== false && days !== null && days < 0;
      }

      return true;
    })
    .filter(sub => {
      if (!query) return true;

      return [
        sub.name,
        sub.category,
        sub.notes,
        sub.currency,
        sub.website
      ].some(value =>
        String(value || "").toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      const ad = parseDateOnly(a.nextRenewalDate);
      const bd = parseDateOnly(b.nextRenewalDate);

      if (ad && bd && ad.getTime() !== bd.getTime()) {
        return ad - bd;
      }

      return String(a.name || "").localeCompare(String(b.name || ""));
    });

  $("visibleCount").textContent = String(visible.length);
  $("subscriptionList").replaceChildren();

  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = subscriptions.length
      ? "No subscriptions match this filter."
      : "No subscriptions tracked yet.";
    $("subscriptionList").appendChild(empty);
    return;
  }

  for (const sub of visible) {
    $("subscriptionList").appendChild(subscriptionCard(sub));
  }
}

$("cadence").addEventListener("change", () => {
  $("customDaysWrap").classList.toggle(
    "hidden",
    $("cadence").value !== "custom"
  );
});

$("saveSubscription").addEventListener("click", async () => {
  const name = clean($("name").value);
  const amount = Number($("amount").value);
  const nextRenewalDate = $("nextRenewalDate").value;

  if (!name) {
    flash("Enter a subscription name.");
    $("name").focus();
    return;
  }

  if (!Number.isFinite(amount) || amount < 0) {
    flash("Enter a valid amount.");
    $("amount").focus();
    return;
  }

  if (!nextRenewalDate) {
    flash("Choose the next renewal date.");
    $("nextRenewalDate").focus();
    return;
  }

  const subscriptions = await getSubscriptions();
  const now = Date.now();

  const payload = {
    name,
    amount: Math.round(amount * 100) / 100,
    currency: $("currency").value,
    cadence: $("cadence").value,
    customDays: Math.max(1, Number($("customDays").value) || 30),
    nextRenewalDate,
    reminderDays: Math.max(0, Number($("reminderDays").value) || 0),
    category: clean($("category").value),
    website: normalizeWebsite($("website").value),
    notes: $("notes").value.trim(),
    updatedAt: now
  };

  if (editingId) {
    const existing = subscriptions.find(sub => sub.id === editingId);

    if (existing) {
      Object.assign(existing, payload);
    }

    await saveSubscriptions(subscriptions);
    flash("Subscription updated.");
  } else {
    subscriptions.push({
      id: makeId(),
      ...payload,
      active: true,
      createdAt: now
    });

    await saveSubscriptions(subscriptions);
    flash("Subscription added.");
  }

  clearForm();
  await render();
});

$("cancelEdit").addEventListener("click", clearForm);
$("search").addEventListener("input", () => render());
$("filter").addEventListener("change", () => render());

$("exportJson").addEventListener("click", async () => {
  const subscriptions = await getSubscriptions();

  const payload = {
    app: "Subscription Reminder",
    version: 1,
    exportedAt: new Date().toISOString(),
    subscriptions
  };

  const blob = new Blob(
    [JSON.stringify(payload, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `subscription-reminder-${todayKey()}.json`;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
  flash("Backup exported.");
});

$("importJson").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    const incoming = Array.isArray(parsed)
      ? parsed
      : parsed.subscriptions;

    if (!Array.isArray(incoming)) {
      throw new Error("No subscriptions array found.");
    }

    const valid = incoming
      .filter(item => item && typeof item === "object" && item.name)
      .map(item => ({
        ...item,
        id: item.id || makeId(),
        active: item.active !== false,
        currency: item.currency || "EUR",
        cadence: item.cadence || "monthly",
        reminderDays: Math.max(0, Number(item.reminderDays ?? 3)),
        customDays: Math.max(1, Number(item.customDays || 30))
      }));

    if (!valid.length) {
      throw new Error("No valid subscriptions found.");
    }

    const replace = confirm(
      `Import ${valid.length} subscription(s)?\n\nOK = replace current data\nCancel = merge with current data`
    );

    if (replace) {
      await saveSubscriptions(valid);
    } else {
      const current = await getSubscriptions();
      const known = new Set(current.map(item => item.id));

      for (const item of valid) {
        if (known.has(item.id)) item.id = makeId();
        current.push(item);
      }

      await saveSubscriptions(current);
    }

    await render();
    flash("Backup imported.");
  } catch (error) {
    flash(`Import failed: ${error.message}`);
  } finally {
    event.target.value = "";
  }
});

clearForm();
render().catch(error => {
  $("message").textContent = String(error);
});

