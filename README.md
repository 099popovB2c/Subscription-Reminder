# Subscription Reminder

A privacy-first Chrome extension for tracking recurring subscriptions and receiving local browser reminders before renewal dates.

## v1.1.0

- Added **30-day upcoming cost insights**.
- Added **CSV export** for subscription data.
- Existing renewal reminders, recurring-cost summaries and JSON backup/import remain available.
- Currencies are still kept separate; no exchange-rate API is used.

## Features

- Add subscription name, price and currency.
- Billing cycles: Weekly, Monthly, Quarterly, Annual and Custom days.
- Track the next renewal date.
- Reminder options from renewal day up to 30 days in advance.
- Chrome notification reminders.
- Active / paused subscriptions.
- Categories, notes and optional account/management website.
- Dashboard with active count, due-soon count, overdue count and recurring cost estimates.
- 30-day upcoming payment insights.
- Search and filters.
- JSON backup export/import.
- CSV export.
- No bank integration.
- No external API.
- No account required.
- No backend.

## Privacy

Subscription data is stored only in `chrome.storage.local`. The extension does not send subscription names, prices, renewal dates, notes, website links, browsing history or account credentials to any external service.

## Reminders

A Manifest V3 background service worker checks subscriptions periodically using Chrome alarms. A reminder is shown once for a specific subscription renewal date when the renewal enters the configured reminder window.

## Cost estimates

The dashboard calculates monthly-equivalent recurring costs. Currencies are **not converted** and totals are grouped by currency to avoid external exchange-rate APIs.

## Backup

Use **Export** to save a JSON backup. The import tool can replace current subscriptions or merge imported subscriptions with current data.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this extension folder.
6. Add your subscriptions and renewal dates.

## Disclaimer

This extension is a personal reminder utility. Renewal dates, prices and cancellation terms should always be verified with the subscription provider.
