# Changelog

All notable changes to PetraDMS. The newest version is first. The installer's release notes are taken from the section
for its version, so every release needs a section here.

## [1.0.0] - 2026-10-07

First commercial release: PetraDMS, an offline distribution management system for FMCG shops and wholesalers in Bangladesh.

### What it does
- Sales and invoicing (keyboard-first POS, discounts, bonus lines, price tiers, returns, voids, A4/thermal/PDF printing)
- Purchases, suppliers, stock with batches and expiry, adjustments
- Customer and supplier dues and payments, expenses, employees and salary, cash and bank accounts, day closing
- Dashboard and 17 reports with print, PDF, CSV and Excel export
- Bangla and English, Simple and Full mode, search (Ctrl+K), calculator, barcode scanner and label printing
- Backup and restore (automatic, second folder, recovery from a damaged file), CSV import, export everything, demo mode
- Offline licence: 30-day trial, then a signed licence file tied to the computer (see docs/LICENSING.md)

### Windows installer
- Per-user install, no administrator rights; Start Menu and Desktop shortcuts; uninstall never deletes business data
- Business data is kept outside the program folder (`%LOCALAPPDATA%\PetraDMS` unless the owner chooses another folder),
  so installing a newer version keeps every record, setting and the licence state
- The installer is not code-signed, so Windows SmartScreen may warn on first run (More info, Run anyway)

### Quality
- 200+ unit tests, 33 end-to-end tests driving the real app, performance asserted on 10,000 products and 1,000,000 stock movements
- The release pipeline installs the packaged app, runs it offline, upgrades it over a previous version and uninstalls it
