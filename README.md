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

1. Push this repository to GitHub (commands below). The **CI** workflow runs by itself.
2. Open the repository on GitHub, **Actions**, the latest **CI** run, and scroll to **Artifacts**.
3. Download **PetraDMS-Windows-x64-Installer** (a ZIP). Inside are `PetraDMS-Setup-<version>-x64.exe` and `SHA256SUMS.txt`.
4. For a public download page, publish a release (see "Release" below) and take the installer from the repository's **Releases** page.

Installing and first use: [`docs/INSTALL.md`](docs/INSTALL.md). The installer is not code-signed, so Windows SmartScreen shows a warning the first time: choose **More info**, then **Run anyway**.

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
pnpm dist:win            # Windows only: builds apps/desktop/release/PetraDMS-Setup-<version>-x64.exe
pnpm dist:dir            # any OS: the unpacked app, same configuration, no installer
pnpm verify:release      # verify + build the package + install/first-run/upgrade/offline checks
pnpm seed:perf           # a big sample shop in ./.perf-data (10,000 products, 5,000 customers)
pnpm keygen --help       # vendor tool that issues licence files
```

On Linux the end-to-end tests need a display: `xvfb-run -a pnpm exec playwright test`.

### What `pnpm verify:release` proves

After the whole test suite it builds the package and then checks the packaged app, not the dev build: the package contents; a fresh start (WAL, every table, integrity check, empty shop); the committed version-1 database opens with every row intact; the app makes no network request and an outside `fetch` or XHR is blocked. On Windows it also installs silently, installs again over the top (upgrade), and uninstalls, and checks that the shop's data folder survives both.

## Release (GitHub Release with the installer)

Set the version in `apps/desktop/package.json`, commit, then:

```bash
git tag vX.Y.Z && git push origin vX.Y.Z
```

The **Release Windows installer** workflow runs the tests, builds and verifies the installer, uploads the artifact and creates the GitHub Release with the installer and `SHA256SUMS.txt`. The tag must equal the version in `apps/desktop/package.json` or the workflow stops. **Run workflow** on that workflow builds the installer without publishing a release.

### Code signing (optional, removes the SmartScreen warning over time)

Without a certificate the installer is unsigned and `forceCodeSigning` is off. To sign, add the repository secrets `CSC_LINK` (the base64 `.pfx`) and `CSC_KEY_PASSWORD`, and remove `CSC_IDENTITY_AUTO_DISCOVERY: 'false'` from the two workflows. electron-builder then signs the installer and the app.

## Licensing

A new install is a 30-day trial. After that PetraDMS turns read-only (viewing, printing, export and backup still work) until a licence file or key tied to the computer's machine code is entered. Licences are Ed25519-signed and checked offline. The vendor private key is not in this repository; only the public key is built in.

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
