# PetraDMS - Decisions log

Non-obvious decisions made during the build. The plan (`docs/PetraDMS_Product_Architecture_Plan_v2.md`) stays authoritative.

## D1. Prototype `index.html` was not supplied
The plan references an `index.html` prototype for tokens, layout and demo data. It was not in the upload. Fallbacks used:
- Colours: the plan's own fallbacks (red `#C8202F`, black `#121212`, cream `#F6F1E7`).
- Demo data: the supplied `Readable_Product_SKU_List.md` (Marks, Ama, SS, tea, noodles, beverages) plus invented Bangladeshi customers.
If the prototype is added later, only `apps/desktop/src/styles/tokens.css` and the demo seed need to change.

## D2. Bundling instead of shipping node_modules
The Electron main and preload are bundled by esbuild into `dist-electron/*.cjs`; the renderer is bundled by Vite into `dist/`. The installer ships no `node_modules` and no native addons. This keeps the pnpm workspace layout from breaking electron-builder and honours "no native addon" for `node:sqlite`.

## D3. TypeScript 5.9 rather than 7.x
TypeScript 7 exists on npm at build time, but typescript-eslint and the Vite/Vitest toolchain are validated against 5.9. Pinned to 5.9.3. The plan only requires "latest stable" for Electron.

## D4. Electron 44.5.1 pinned
Latest stable at build time. It bundles a Node that provides `node:sqlite` without a flag; verified by the Playwright spike test (WAL + integrity_check inside Electron) and by the CI smoke test against the installed, packaged app.

## D5. Smoke-test flag
`PetraDMS.exe --smoke-test` opens the database in the packaged app, writes `PETRA_SMOKE_OUT`, and exits 0/1. CI uses it after a silent NSIS install. It does nothing for a normal launch.

## D6. Network blocking
Besides having no code that calls the network, the main process cancels every request that is not `file:`, `data:`, `blob:` or `devtools:` (and `localhost` in dev). The renderer CSP also restricts `connect-src` to `'self'`.

## D7. Installer artifact and release
CI builds on `windows-latest`, requires the installer to exceed 50 MB (a stub-only build would not), silently installs it, launches the installed app with `--smoke-test`, and only then uploads the artifact `PetraDMS-Windows-x64-Installer`. `release-windows.yml` does the same for `v*.*.*` tags and attaches the `.exe` to a GitHub Release with `gh release create`.

## D8. Code signing
No certificate is available. `signAndEditExecutable` stays true so icon/version metadata are applied; the installer is unsigned and Windows SmartScreen will warn (plan section 18).
