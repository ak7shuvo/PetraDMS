# PetraDMS

PetraDMS is an offline distribution management program for Windows, made for FMCG shops and wholesalers in Bangladesh. It does sales and invoicing (with printing and PDF), purchases, stock with expiry, customer and supplier dues, expenses, salaries, cash and day closing, reports, backup and restore. It works in Bangla and English, needs no internet and sends nothing anywhere. Data lives in one SQLite file on the shop's own computer.

| | |
|---|---|
| Desktop shell | Electron 44, React 19, TypeScript, Vite, Tailwind |
| Data | `node:sqlite` (WAL, `synchronous=FULL`, foreign keys on), money in whole poisha, quantity in base units |
| Packages | `packages/core` (pure domain rules), `packages/db` (schema, posting engine, services), `apps/desktop` (Electron main, preload, React), `tools` |
| Installer | electron-builder, NSIS, Windows 10/11 x64, per-user install |

The full design is in [`docs/PetraDMS_Product_Architecture_Plan_v2.md`](docs/PetraDMS_Product_Architecture_Plan_v2.md). Build progress is in [`docs/STATE.md`](docs/STATE.md) and the reasons behind each choice in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Get the Windows installer (no tools needed)

1. Open the repository on GitHub, **Actions**, **Windows Release**, **Run workflow**.
2. When the run is green, open it and download the artifact **PetraDMS-Windows-x64** (a ZIP). Inside are `PetraDMS-Setup-<version>.exe`, `SHA256SUMS.txt`, `VERSION.txt` and `RELEASE-NOTES.md`.
3. Every push to `main` also builds the same artifact (Actions, **CI**). For a public download page, publish a release with `git tag vX.Y.Z && git push origin vX.Y.Z`; the installer then appears on the **Releases** page.

Full steps, what the pipeline checks, and code signing: [`docs/RELEASING.md`](docs/RELEASING.md). Installing and first use: [`docs/INSTALL.md`](docs/INSTALL.md). Licensing: [`docs/LICENSING.md`](docs/LICENSING.md). The installer is not code-signed, so Windows SmartScreen shows a warning the first time: choose **More info**, then **Run anyway**.

## Build and run it yourself

You need Node.js 22 and pnpm 10 (`corepack enable`). Windows, macOS or Linux all work for development; the installer itself is built on Windows.

```bash
pnpm install
pnpm dev                 # the app with live reload (Vite + Electron)
pnpm typecheck           # TypeScript, all packages
pnpm lint                # ESLint
pnpm test:unit           # Vitest: rules, posting engine, services, performance targets
pnpm check:integrity     # self-test of the ledger integrity checker
pnpm test:e2e            # builds, then Playwright drives the real Electron app
pnpm verify              # all of the above
pnpm dist:win            # Windows only: builds apps/desktop/release/PetraDMS-Setup-<version>.exe
pnpm dist:dir            # any OS: the unpacked app, same configuration, no installer
pnpm verify:release      # verify + build the package + install, first run, upgrade, offline and uninstall checks
pnpm seed:perf           # a big sample shop in ./.perf-data (10,000 products, 5,000 customers)
pnpm keygen --help       # vendor tool that issues licence files
```

On Linux the end-to-end tests need a display: `xvfb-run -a pnpm exec playwright test`.

### What `pnpm verify:release` proves

After the whole test suite it builds the package and then checks the packaged app, not the dev build: the package contents; a fresh start (WAL, every table, integrity check, empty shop); the committed version-1 database opens with every row intact; the app makes no network request and an outside `fetch` or XHR is blocked. On Windows it also installs silently, installs again over the top (upgrade), and uninstalls, and checks that the shop's data folder survives both.

## Release (GitHub Release with the installer)

Set the version in `apps/desktop/package.json`, add its section to `CHANGELOG.md`, commit, then:

```bash
git tag vX.Y.Z && git push origin vX.Y.Z
```

The **Windows Release** workflow runs the tests, builds and verifies the installer, uploads the artifact `PetraDMS-Windows-x64` and creates the GitHub Release. The tag must equal the version in `apps/desktop/package.json` or the workflow stops. **Run workflow** on that workflow builds the installer without publishing a release. Code signing: add the secrets `WINDOWS_CSC_LINK` and `WINDOWS_CSC_PASSWORD` (see `docs/RELEASING.md`).

## Licensing

A new install is a 30-day trial. After that PetraDMS turns read-only (viewing, printing, export and backup still work) until a licence file (`.petra`) tied to the computer's Machine Code is installed under Settings, Licence. Licences are Ed25519-signed and checked offline. The vendor private key (`.pem`) is never in this repository; only the public key is built in. How it works and how to issue licences: [`docs/LICENSING.md`](docs/LICENSING.md).

## Push to GitHub

```bash
git init -b main            # skip if already a repository
git add .
git commit -m "Build PetraDMS"
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

## Repository map

```text
apps/desktop/    electron/ (main, preload, services)   src/ (React screens, i18n, styles)   build/ (icons)   electron-builder.yml
packages/core/   money, units, costing, invoice, aging, importer, IPC contract (zod)
packages/db/     migrations/, posting engine, integrity checker, services, fixtures/ (released-schema databases)
tools/           keygen/, seed/, check-integrity/, icons/, verify-release.ts
e2e/             Playwright tests that drive the real app
docs/            plan, state, decisions, user manuals (English and Bangla), install guide
.github/workflows/  ci.yml, release-windows.yml
```
# PetraDMS
