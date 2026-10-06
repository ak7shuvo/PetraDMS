# PetraDMS - Build state

## Current phase
Phase 2 complete (gate passes locally). Next: Phase 3 (design system and shell).

## Done
- Phase 1: pnpm monorepo, Electron 44 + Vite + React 19 shell, `node:sqlite` WAL opened in main, typed IPC (zod), network blocking, `ci.yml` + `release-windows.yml`, Playwright spike test.
- Phase 2: `packages/core` (money, units, costing, invoice, aging, business date, errors) and `packages/db` (schema `0001_init.sql`, migrator, posting engine for purchases / sales / returns / voids / edits / payments / expenses / salary / adjustments / day close, generic reversal, integrity checker I1-I10, sim). `pnpm test:core` runs 50 tests including 1,000 random scenarios and a 10,000-operation run; `pnpm check:integrity` self-tests the checker.

## Gate status
- Phase 1 "CI green and installer artifact produced": runs on GitHub after the first push (no Windows runner in the build sandbox).
- Phase 2: `pnpm test:core` and `pnpm check:integrity` pass.

## Resume commands
```
pnpm install
pnpm typecheck && pnpm lint && pnpm test:core && pnpm check:integrity
pnpm build && xvfb-run -a pnpm exec playwright test   # Linux; on Windows: pnpm test:e2e
```
