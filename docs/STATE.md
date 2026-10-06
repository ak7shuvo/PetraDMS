# PetraDMS - Build state

## Current phase
Phase 1 complete locally. Next: Phase 2 (core + DB).

## Done
- Phase 1: pnpm monorepo, Electron 44 + Vite + React 19 shell, `node:sqlite` WAL opened in main, typed IPC (zod), network blocking, `ci.yml` + `release-windows.yml`, Playwright spike test (passes under xvfb), cross-build validated up to NSIS stage.

## Gate status
- Phase 1 gate "CI green and installer artifact produced": runs on GitHub after the first push. Not verifiable from the Linux build sandbox (no Windows, no wine).

## Resume commands
```
pnpm install
pnpm typecheck && pnpm lint && pnpm test:unit && pnpm check:integrity
pnpm build && xvfb-run -a pnpm exec playwright test   # Linux; on Windows just: pnpm test:e2e
```
