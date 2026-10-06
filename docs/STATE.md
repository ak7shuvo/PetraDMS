# PetraDMS - Build state

## Current phase
Phase 3 complete (gate passes locally). Next: Phase 4 (setup wizard, settings, auth, roles, licence).

## Done
- Phase 1: pnpm monorepo, Electron 44 + Vite + React 19 shell, `node:sqlite` WAL opened in main, typed IPC (zod), network blocking, `ci.yml` + `release-windows.yml`, Playwright spike test.
- Phase 2: `packages/core` (money, units, costing, invoice, aging, business date, errors) and `packages/db` (schema `0001_init.sql`, migrator, posting engine for purchases / sales / returns / voids / edits / payments / expenses / salary / adjustments / day close, generic reversal, integrity checker I1-I10, sim). `pnpm test:core` runs 50 tests including 1,000 random scenarios and a 10,000-operation run; `pnpm check:integrity` self-tests the checker.
- Phase 3: design tokens and CSS, i18n (`bn`/`en` JSON dictionaries with a key + placeholder parity test), Zustand UI prefs store (language, Simple/Full, Animations Full/Reduced/Off, font size, high contrast), motion system (launch sequence, page cross-fade, count-up, Lite-mode frame guard), components (Button, Field, inputs incl. money/qty/date, Select, Switch, Segmented, Modal, Drawer, Confirm, Toast with 6 s Undo, Table with sort/paging, Tabs, Badge, Stat, Card, Empty, Skeleton, Spinner, Progress, SVG bar/line charts, Stamp, CheckMark), shell (sidebar with Simple 6 / Full 12 entries, topbar, language toggle), `/style-guide` route (Ctrl+Shift+G). Sidebar entries appear only when their page is registered in `pages/registry.tsx`.

## Gate status
- Phase 1 "CI green and installer artifact produced": runs on GitHub after the first push (no Windows runner in the build sandbox).
- Phase 2: `pnpm test:core` and `pnpm check:integrity` pass.
- Phase 3: `pnpm test:unit` (55 tests) passes; Playwright renders every component in bn and en at 1366x768 with no console errors, no horizontal overflow and no external requests (4 e2e tests, repeatable).

## Resume commands
```
pnpm install
pnpm typecheck && pnpm lint && pnpm test:core && pnpm check:integrity
pnpm build && xvfb-run -a pnpm exec playwright test   # Linux; on Windows: pnpm test:e2e
```
