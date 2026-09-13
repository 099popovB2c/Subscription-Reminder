# Subscription Reminder

A privacy-first Chrome extension for tracking recurring subscriptions and receiving local browser reminders before renewal dates.

## Features

- Add subscription name, price and currency.
- Billing cycles:
  - Weekly
  - Monthly
  - Quarterly
  - Annual
  - Custom number of days
- Track the next renewal date.
- Reminder options from renewal day up to 30 days in advance.
- Chrome notification reminders.
- Active / paused subscriptions.
- Categories, notes and optional account/management website.
- Dashboard:
  - active subscription count;
  - renewals due within 7 days;
  - overdue renewals;
  - estimated monthly and yearly recurring cost grouped by currency.
- Search and filters.
- JSON backup export/import.
- No bank integration.
- No external API.
- No account required.
- No backend.

## Privacy

Subscription data is stored only in `chrome.storage.local`.

The extension does not send:

- subscription names;
- prices;
- renewal dates;
- notes;
- website links;
- browsing history;
- account credentials

to any external service.

## Reminders

A Manifest V3 background service worker checks subscriptions periodically using Chrome alarms.

A reminder is shown once for a specific subscription renewal date when the renewal enters the configured reminder window.

If a renewal date has already passed, the extension can show it as overdue.

## Cost estimates

The dashboard calculates a monthly equivalent for each active subscription:

- weekly plans are annualized at 52 weeks;
- quarterly plans are divided by 3;
- annual plans are divided by 12;
- custom-day plans are annualized using 365 days.

Currencies are **not converted**. Totals are grouped by currency to avoid using external exchange-rate APIs.

## Backup

Use **Export** to save a JSON backup.

The import tool can either:

- replace current subscriptions; or
- merge imported subscriptions with current data.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this extension folder.
6. Add your subscriptions and renewal dates.

## Disclaimer

This extension is a personal reminder utility. Renewal dates, prices and cancellation terms should always be verified with the subscription provider.

