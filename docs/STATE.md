# PetraDMS - Build state

## Current phase
Phase 5 complete (gate passes locally). Next: Phase 6 (customers and POS: discount, bonus, payments, returns, void, drafts, invoice printing).

## Done
- Phase 1: pnpm monorepo, Electron 44 + Vite + React 19 shell, `node:sqlite` WAL opened in main, typed IPC (zod), network blocking, `ci.yml` + `release-windows.yml`, Playwright spike test.
- Phase 2: `packages/core` (money, units, costing, invoice, aging, business date, errors) and `packages/db` (schema `0001_init.sql`, migrator, posting engine for purchases / sales / returns / voids / edits / payments / expenses / salary / adjustments / day close, generic reversal, integrity checker I1-I10, sim). `pnpm test:core` runs 50 tests including 1,000 random scenarios and a 10,000-operation run; `pnpm check:integrity` self-tests the checker.
- Phase 3: design tokens and CSS, i18n (`bn`/`en` JSON dictionaries with a key + placeholder parity test), Zustand UI prefs store (language, Simple/Full, Animations Full/Reduced/Off, font size, high contrast), motion system (launch sequence, page cross-fade, count-up, Lite-mode frame guard), components (Button, Field, inputs incl. money/qty/date, Select, Switch, Segmented, Modal, Drawer, Confirm, Toast with 6 s Undo, Table with sort/paging, Tabs, Badge, Stat, Card, Empty, Skeleton, Spinner, Progress, SVG bar/line charts, Stamp, CheckMark), shell (sidebar with Simple 6 / Full 12 entries, topbar, language toggle), `/style-guide` route (Ctrl+Shift+G). Sidebar entries appear only when their page is registered in `pages/registry.tsx`.
- Phase 4: setup wizard (language, business, owner PIN/password, data folder, mode, printable recovery code), sign-in (on-screen keypad or password, 5-attempt lockout), recovery by code, users and roles (Owner/Manager/Staff, enforced in the main process), settings (business, language/look, sales rules, users, licence), idle auto-lock, Ed25519 offline licence + 30-day trial + clock-rollback detection + read-only mode, `pnpm keygen` vendor tool. IPC is now one `petra:invoke` channel through a `Dispatcher` (validate with zod, authorise by role, block writes when read-only, return data or a structured error).
- Phase 5: products (packs, barcodes, expiry tracking, categories/brands, archive, role-gated cost fields), suppliers (opening balance, payments, ledger), purchases (credit/cash, batch + expiry, discount, void, returns to supplier), inventory (stock with alerts, batches and expiry, movement history, adjustments with undo). All services are IPC channels in `catalog.ts` with role checks; staff never receive cost data.
- Phase 6: POS (search, favourites grid, keyboard flow F3/F4/F8/F9/Ctrl+S, per-line and invoice discounts, bonus lines, wholesale/dealer tiers, draft autosave and restore, edit mode), invoice list and detail (staff: today only, no cost or profit), sale return and void, customers (areas, quick add, ledger, due), payment receiving, manager approval by one-time token, printing (A4, thermal 80 mm and 58 mm, PDF with embedded Bangla fonts into the invoices folder).
- Phase 7: expenses (categories, void, filters), employees (salary, advance, ledger), salary sheets by month with bonus and deduction, money accounts (cash, bank, bKash, Nagad, other), cash book with running balance, day closing (expected vs counted, shortfall booked, Owner-only reopen). Pages `/expenses` and `/money` (same screen with four tabs), `/employees`, and Simple-mode `/people` (customers, suppliers, employees).

## Gate status
- Phase 7: `money.services.test.ts` (4 service tests) and `money.spec.ts` e2e (expense and void, employee, salary sheet, pay, cash book, close day, reopen, then I1-I10 on the real database including I6 and I8; staff blocked). 94 unit tests, 14 e2e.
- Phase 6: `sales.test.ts` (6 service tests, golden invoice, approvals, drafts, edit/return/void, prints) and `sales.spec.ts` (golden invoice 6,735.50, draft restore after reload, PDF header, return, void refusal, integrity; staff approval and no-profit). 89 unit tests, 12 e2e. The 10,000-operation property test from Phase 2 covers the posting engine.
- Phase 5: `catalog.test.ts` (6 service tests) and the `catalog.spec.ts` e2e (products, supplier, credit purchase, expiry purchase, adjustment, void, then `checkIntegrity` I1-I10 on the real database) pass; a unit test checks every literal `t('...')` key exists in both languages. 82 unit tests, 10 e2e.
- Phase 1 "CI green and installer artifact produced": runs on GitHub after the first push (no Windows runner in the build sandbox).
- Phase 2: `pnpm test:core` and `pnpm check:integrity` pass.
- Phase 4: unit tests for licence (valid, tampered, expired, wrong machine, clock rollback, trial length), secrets, lockout, recovery, roles, read-only; 8 Playwright e2e (fresh install, lockout, recovery, staff restrictions, licence flow, expiry, data-folder move, no network) pass.
- Phase 3: `pnpm test:unit` (55 tests) passes; Playwright renders every component in bn and en at 1366x768 with no console errors, no horizontal overflow and no external requests (4 e2e tests, repeatable).

## Resume commands
```
pnpm install
pnpm typecheck && pnpm lint && pnpm test:core && pnpm check:integrity
pnpm build && xvfb-run -a pnpm exec playwright test   # Linux; on Windows: pnpm test:e2e
```

## Vendor licence tool
- `pnpm keygen issue --key <private.pem> --customer "Name" --machine ABCD-1234-EF56-7890 [--expires YYYY-MM-DD] --out licence.petra`
- The private key `petra-licence-private.pem` was generated with this build and is NOT in the repository. Keep it safe; whoever holds it can issue licences. The matching public key is embedded in `packages/db/src/app/publicKey.ts`.
