# Changelog

All notable changes to PetraDMS. The newest version is first. The installer's release notes are taken from the section
for its version, so every release needs a section here.

## [1.1.1] - 2026-10-08

A look-and-feel release: lighter type, a softer 3D design, the right names, and a utility dock. No change to how sales, purchases, stock or money are recorded, and no database change.

### Names
- The footer now reads "PetraDMS · v1.1.1" with "Made by Petra" under it (Bangla: "প্রস্তুতকারক: Petra"). PetraDMS is the product, Petra the company. The shop's own name and logo stay at the top.

### Type
- English in Nunito, Bangla in Tiro Bangla, figures in JetBrains Mono; no heavy bold anywhere, and Bangla is never drawn in a fake bold.
- Bangla text is a little larger with more line spacing, so small table and input text stays readable. Printed invoices and PDFs use the same fonts.
- Three unused fonts were removed: the app's font files are 60 % smaller.

### Look
- Rounded cards with soft layered shadows, gentle entry and hover lift; smoother dialogs, tabs, switches, tables and toasts.
- One clear button hierarchy on every screen: a raised red primary action, neutral secondary, red-outline danger, and quiet tertiary buttons.
- The dashboard's quick actions are equal tiles, with New sale as the one primary action.
- Animations Full, Reduced (fades only) and Off (none) are respected everywhere, as is the Windows "reduce motion" setting; a slow PC gets flatter shadows.

### Utility dock
- A slim bar on the right edge of every screen with a **Calculator** (Alt+C) and **Games** (Alt+G).
- The calculator handles whole sums with brackets and %, uses exact decimals (0.1 + 0.2 = 0.3), keeps the last five results and copies the answer. It never types into a field by itself.
- 2048, Snake and Memory for a short break. They pause on their own and work offline.
- The panel can be dragged, remembers where it was, stays under dialogs, is never printed, and never takes the keyboard from the field you are typing in.
- The Owner can hide the games or the whole dock in Settings, Language and look.

### Quality
- Unit tests for the calculator (decimals, brackets, percent, bad input) and the game rules, plus end-to-end tests for the dock in both languages, the settings and roles, Animations Off, and font and weight checks on every screen.

## [1.1.0] - 2026-10-08

Built for FMCG distributors who buy by the company invoice and sell by the box and the piece.

### Companies and their products
- Each supplier (company) has a **Products** tab: link products one by one or a whole brand, with the usual pack and last cost per box remembered. A product bought from a company is linked automatically.

### Bulk purchase entry
- A new purchase opens every product of the chosen company in a grid, in boxes and pieces, with the last cost filled in; "Only rows with a quantity" narrows it to the invoice.
- Keyboard first: Enter moves along a row and on to the next, the arrow keys move up and down, Ctrl+S saves.
- **Add many products** at once, and **Paste from Excel** with column matching and per-row problems.
- Company invoice number, invoice date and pay-by date; a warning (and a reason) before the same company invoice is entered twice.
- Line discount (percent or amount), bill discount, freight and optional VAT shared over the lines by value; free boxes and pieces at no cost.
- Unsaved purchases are kept as a draft; after saving, a selling-price update with margins and a printable goods received note (GRN).

### Box + pcs everywhere
- Products have their default sale and purchase units, box prices and a box barcode; **Add box** in the product editor.
- At the counter a line can be boxes plus pieces, each with its own price; type `2b5` for 2 boxes and 5 pieces; scanning a box barcode adds a box.
- Returns, stock ("12 Box 5 pcs"), reports, exports and printed invoices show boxes and pieces.
- CSV import: box size, box prices, units, supplying company and opening stock in boxes and pieces for products; a new **Company invoices** import.

### Look and branding
- The shop's name at the top of every screen and printout, "Powered by Petra DMS" and the version at the bottom, and an optional logo on invoices.
- New bundled fonts (Plus Jakarta Sans, Hind Siliguri, Fraunces, Noto Serif Bengali, JetBrains Mono), also embedded in PDFs; no font is downloaded.

### Data safety
- Database migration 2 runs after the automatic pre-migration backup; a version 1.0 database upgrades with every figure unchanged.
- Two new integrity checks (I11 box + pcs quantities and free lines, I12 company links and default units), and the purchase total check now includes VAT and freight.
- A purchase that already has returns cannot be voided until its returns are voided.

### Quality
- 257 unit tests (including property tests for the new purchase paths) and 43 end-to-end tests.
- A 60-line company invoice saves in about 13 ms (95th percentile); a 500-product grid opens in about half a second and stays smooth at 1366x768.

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
