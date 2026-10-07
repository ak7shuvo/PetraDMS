// Release-only checks, run by `pnpm verify:release` after the normal gate. It builds the real installer package and then
// proves the packaged app, not the dev build:
//   1. the package contents (app archive, database migrations, icon, size)
//   2. a fresh install starts, opens its database in WAL mode, creates every table and passes the integrity check
//   3. an existing shop's data (the version-1 fixture) opens with every row intact
//   4. the packaged app makes no network request at all, and an outside fetch fails
//   5. on Windows only: the silent installer installs, installs again over itself (upgrade) and uninstalls, and the
//      shop's data folder survives both
// On Linux and macOS the NSIS installer cannot be made, so the unpacked app from the same configuration is checked and the
// Windows steps are reported as skipped (the Windows CI job runs them).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const desktop = path.join(root, 'apps', 'desktop');
const release = path.join(desktop, 'release');
const win = process.platform === 'win32';
const results: Array<{ name: string; status: 'pass' | 'skip'; note?: string }> = [];
const pass = (name: string, note?: string) => { results.push({ name, status: 'pass', note }); console.log(`  PASS  ${name}${note ? ` (${note})` : ''}`); };
const skip = (name: string, note: string) => { results.push({ name, status: 'skip', note }); console.log(`  SKIP  ${name} (${note})`); };
const fail = (msg: string): never => { console.error(`\nFAIL  ${msg}`); process.exit(1); };
const check = (cond: unknown, msg: string): void => { if (!cond) fail(msg); };

const run = (cmd: string, args: string[], env: Record<string, string> = {}, cwd = root) =>
  spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: win, env: { ...process.env, ...env } });

console.log('\n== Build the package ==');
fs.rmSync(release, { recursive: true, force: true });
const built = run('pnpm', ['--filter', '@petra/desktop', win ? 'dist:win' : 'dist:dir'], { CSC_IDENTITY_AUTO_DISCOVERY: 'false' });
check(built.status === 0, 'electron-builder failed');

const version = (JSON.parse(fs.readFileSync(path.join(desktop, 'package.json'), 'utf8')) as { version: string }).version;
let installer: string | null = null;
let appExe: string;
let resources: string;
if (win) {
  installer = path.join(release, `PetraDMS-Setup-${version}-x64.exe`);
  check(fs.existsSync(installer), `installer not found: ${installer}`);
  const mb = fs.statSync(installer).size / 1048576;
  check(mb > 50, `installer is only ${mb.toFixed(1)} MB`);
  pass('installer produced', `${path.basename(installer)}, ${mb.toFixed(1)} MB`);
} else {
  appExe = '';
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'petra-release-'));
const installDir = path.join(tmp, 'PetraDMS-installed');
const sh = (cmd: string, args: string[]) => spawnSync(cmd, args, { stdio: 'inherit' });
if (win) {
  const r = sh(installer as string, ['/S', `/D=${installDir}`]);
  check(r.status === 0, 'silent install failed');
  appExe = path.join(installDir, 'PetraDMS.exe');
  resources = path.join(installDir, 'resources');
} else {
  const unpacked = path.join(release, 'linux-unpacked');
  appExe = path.join(unpacked, 'PetraDMS');
  resources = path.join(unpacked, 'resources');
}
check(fs.existsSync(appExe), `packaged app not found: ${appExe}`);

console.log('\n== Package contents ==');
check(fs.existsSync(path.join(resources, 'app.asar')), 'app.asar missing');
const migrations = fs.readdirSync(path.join(resources, 'migrations')).filter((f) => f.endsWith('.sql'));
check(migrations.length >= 1, 'database migrations are not in the package');
check(fs.existsSync(path.join(root, 'apps', 'desktop', 'build', 'icon.ico')), 'icon.ico missing');
pass('package contents', `app.asar, ${migrations.length} migration(s), icon`);

const launchArgs = (extra: string[] = []) => (process.platform === 'linux' ? ['--no-sandbox', '--disable-gpu', ...extra] : extra);
const display = process.platform === 'linux' && !process.env.DISPLAY;
const smoke = (dataDir: string, label: string) => {
  const out = path.join(tmp, `${label}.json`);
  const args = launchArgs(['--smoke-test']);
  const env = { PETRA_DATA_DIR: dataDir, PETRA_SMOKE_OUT: out, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' };
  const r = display ? spawnSync('xvfb-run', ['-a', appExe, ...args], { env: { ...process.env, ...env } }) : spawnSync(appExe, args, { env: { ...process.env, ...env } });
  check(r.status === 0 && fs.existsSync(out), `${label}: packaged app did not pass its own smoke test (exit ${r.status})\n${r.stderr?.toString() ?? ''}`);
  return JSON.parse(fs.readFileSync(out, 'utf8')) as { ok: boolean; packaged: boolean; tables: number; journalMode: string; integrity: string; version: string; schema: number; counts: Record<string, number> };
};

console.log('\n== Fresh install ==');
const fresh = smoke(path.join(tmp, 'fresh'), 'fresh');
check(fresh.ok && fresh.packaged, 'fresh: not a packaged production run');
check(fresh.journalMode === 'wal' && fresh.integrity === 'ok', `fresh: journal ${fresh.journalMode}, integrity ${fresh.integrity}`);
check(fresh.tables > 30, `fresh: only ${fresh.tables} tables`);
check(fresh.version === version, `fresh: version ${fresh.version} is not ${version}`);
check(Object.values(fresh.counts).every((n) => n === 0), 'fresh: a new shop must start empty');
pass('fresh install opens', `v${fresh.version}, schema ${fresh.schema}, ${fresh.tables} tables, WAL, integrity ok`);

console.log('\n== Existing data kept on upgrade ==');
const fixtureDir = path.join(root, 'packages', 'db', 'fixtures');
const expected = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'petra-v1.json'), 'utf8')) as { counts: Record<string, number> };
const oldShop = path.join(tmp, 'old-shop');
fs.mkdirSync(path.join(oldShop, 'data'), { recursive: true });
fs.copyFileSync(path.join(fixtureDir, 'petra-v1.db'), path.join(oldShop, 'data', 'petra.db'));
const upgraded = smoke(oldShop, 'upgrade');
check(upgraded.ok && upgraded.integrity === 'ok', 'upgrade: database not healthy after opening');
for (const k of ['products', 'customers', 'suppliers', 'sales', 'purchases', 'users'] as const)
  check(upgraded.counts[k] === expected.counts[k], `upgrade: ${k} is ${upgraded.counts[k]}, expected ${expected.counts[k]}`);
pass('version-1 shop opens with every row', Object.entries(upgraded.counts).map(([k, v]) => `${k} ${v}`).join(', '));

console.log('\n== No network ==');
{
  const app = await electron.launch({
    executablePath: appExe,
    args: launchArgs(),
    env: { ...process.env, PETRA_DATA_DIR: path.join(tmp, 'net'), ELECTRON_DISABLE_SECURITY_WARNINGS: '1' } as Record<string, string>
  });
  const page = await app.firstWindow();
  const outside: string[] = [];
  page.on('request', (r) => { if (!/^(file|devtools|data|blob):/.test(r.url())) outside.push(r.url()); });
  await page.waitForSelector('[data-testid="wizard-step-1"]', { timeout: 30_000 });
  await page.waitForTimeout(1500);
  const appRequests = [...outside]; // what the app asked for on its own, before the deliberate probes below
  // Strings, because this script is type-checked without the browser's DOM types.
  const fetched = await page.evaluate<string>(`fetch('https://example.com/').then(() => 'reached', () => 'blocked')`);
  const xhr = await page.evaluate<string>(`new Promise((resolve) => { const x = new XMLHttpRequest(); x.onload = () => resolve('reached'); x.onerror = () => resolve('blocked'); x.open('GET', 'https://example.com/'); x.send(); })`);
  await app.close();
  check(appRequests.length === 0, `the app asked for: ${appRequests.join(', ')}`);
  check(fetched === 'blocked' && xhr === 'blocked', `an outside request got through (fetch ${fetched}, xhr ${xhr})`);
  pass('packaged app is offline', 'no request left the app; fetch and XHR to the internet are blocked');
}

console.log('\n== Windows installer lifecycle ==');
if (win) {
  const shopData = path.join(tmp, 'keep');
  const first = smoke(shopData, 'keep-1');
  check(first.ok, 'lifecycle: first run failed');
  const again = sh(installer as string, ['/S', `/D=${installDir}`]);
  check(again.status === 0, 'installing over an existing install (upgrade) failed');
  check(fs.existsSync(appExe), 'app missing after reinstall');
  check(smoke(shopData, 'keep-2').ok, 'lifecycle: app does not open after reinstall');
  pass('install over the top (upgrade) keeps the app working');
  const un = path.join(installDir, 'Uninstall PetraDMS.exe');
  check(fs.existsSync(un), 'uninstaller missing');
  const u = sh(un, ['/S', `_?=${installDir}`]);
  check(u.status === 0, 'silent uninstall failed');
  check(fs.existsSync(path.join(shopData, 'data', 'petra.db')), 'uninstall removed the shop data');
  pass('uninstall keeps the shop data folder');
} else {
  skip('silent install, upgrade over the top, uninstall', `needs Windows (this is ${process.platform}); the Windows CI job runs it`);
}

fs.rmSync(tmp, { recursive: true, force: true });
const passed = results.filter((r) => r.status === 'pass').length;
console.log(`\nverify:release OK - ${passed} checks passed, ${results.length - passed} skipped on this platform.`);
