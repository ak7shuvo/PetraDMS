import { app, BrowserWindow, dialog, ipcMain, session } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  Dispatcher, PRODUCT_PUBLIC_KEY_PEM, healthInfo, loadMigrations, machineHash, migrate, openDatabase, registerCoreServices, registerCatalogServices, closeDatabase, type Db, type Host
} from '@petra/db';
import { ipcContract } from '@petra/core';

const defaultRoot = path.join(process.env.LOCALAPPDATA ?? app.getPath('userData'), 'PetraDMS');
const pointerFile = path.join(defaultRoot, 'location.json');

/** Data root: PETRA_DATA_DIR (tests, CI) > folder chosen in the setup wizard > %LOCALAPPDATA%\PetraDMS. */
function resolveDataRoot(): string {
  if (process.env.PETRA_DATA_DIR) return path.resolve(process.env.PETRA_DATA_DIR);
  try {
    const p = JSON.parse(fs.readFileSync(pointerFile, 'utf8')) as { dataRoot?: string };
    if (p.dataRoot && fs.existsSync(p.dataRoot)) return p.dataRoot;
  } catch {
    /* no pointer: default location */
  }
  return defaultRoot;
}

let dataRoot = resolveDataRoot();

// Isolated runs also isolate Chromium's profile (localStorage, locks) so tests never share UI prefs.
if (process.env.PETRA_DATA_DIR) app.setPath('userData', path.join(dataRoot, 'electron'));

let db: Db | null = null;
let dispatcher: Dispatcher | null = null;
let mainWindow: BrowserWindow | null = null;

function ensureDirs(root: string): void {
  for (const d of ['data', 'backups', 'exports', 'invoices', 'logs']) fs.mkdirSync(path.join(root, d), { recursive: true });
}

/** Packaged: SQL ships in resources/migrations (extraResources). Dev: read straight from the repository. */
function migrationsDir(): string {
  return app.isPackaged ? path.join(process.resourcesPath, 'migrations') : path.resolve(__dirname, '../../../packages/db/migrations');
}

function openAndMigrate(root: string): Db {
  ensureDirs(root);
  const d = openDatabase(path.join(root, 'data', 'petra.db'));
  migrate(d, loadMigrations(migrationsDir()));
  return d;
}

function machineFacts() {
  return { hostname: os.hostname(), cpuModel: os.cpus()[0]?.model ?? 'cpu', platform: process.platform, arch: process.arch };
}

function recommendedDataDir(): string {
  if (process.platform === 'win32') {
    for (const letter of 'DEFGH') {
      const root = `${letter}:\\`;
      try {
        if (fs.existsSync(root)) return `${root}PetraData`;
      } catch {
        /* drive not readable */
      }
    }
  }
  return defaultRoot;
}

const host: Host = {
  appVersion: app.getVersion(),
  get dataDir() {
    return dataRoot;
  },
  health: () => ({
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron ?? '',
    nodeVersion: process.versions.node,
    ...healthInfo(db as Db),
    packaged: app.isPackaged,
    dataDir: dataRoot
  }),
  recommendedDataDir,
  async pickDataDir() {
    const r = await dialog.showOpenDialog(mainWindow ?? undefined!, { properties: ['openDirectory', 'createDirectory'] });
    return r.canceled ? null : (r.filePaths[0] ?? null);
  },
  async applyDataDir(target) {
    const root = path.resolve(target);
    ensureDirs(root);
    const oldRoot = dataRoot;
    if (root === oldRoot) return;
    if (db) closeDatabase(db);
    // The database being left behind is brand new (this is only allowed during first-run setup): remove it.
    for (const ext of ['', '-wal', '-shm']) fs.rmSync(path.join(oldRoot, 'data', `petra.db${ext}`), { force: true });
    fs.mkdirSync(defaultRoot, { recursive: true });
    fs.writeFileSync(pointerFile, JSON.stringify({ dataRoot: root }));
    dataRoot = root;
    db = openAndMigrate(root);
    dispatcher?.swapDb(db);
  },
  async pickLicenceFile() {
    const r = await dialog.showOpenDialog(mainWindow ?? undefined!, { properties: ['openFile'], filters: [{ name: 'Petra licence', extensions: ['petra', 'txt'] }] });
    const f = r.canceled ? null : (r.filePaths[0] ?? null);
    return f ? fs.readFileSync(f, 'utf8').trim() : null;
  }
};

function registerIpc(d: Dispatcher): void {
  ipcMain.handle('petra:invoke', async (event, channel: unknown, raw: unknown) => {
    const url = event.senderFrame?.url ?? '';
    if (!url.startsWith('file://') && !url.startsWith('http://localhost:')) throw new Error('untrusted sender');
    if (typeof channel !== 'string' || !(channel in ipcContract)) throw new Error('unknown channel');
    return d.call(channel, raw);
  });
}

/** The app makes zero network requests: block everything except local file/devtools targets. */
function blockNetwork(): void {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;
    const local = url.startsWith('file://') || url.startsWith('devtools://') || url.startsWith('data:') || url.startsWith('blob:') ||
      (!app.isPackaged && url.startsWith('http://localhost:'));
    if (!local) console.error('[net-blocked]', url);
    callback({ cancel: !local });
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#F6F1E7',
    title: 'PetraDMS',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://') && !url.startsWith('http://localhost:')) e.preventDefault();
  });
  if (!app.isPackaged && process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  void app.whenReady().then(() => {
    db = openAndMigrate(dataRoot);
    // Tests may substitute the licence key; a packaged build always uses the embedded vendor key.
    const publicKeyPem = !app.isPackaged && process.env.PETRA_LICENCE_PUBLIC_KEY ? process.env.PETRA_LICENCE_PUBLIC_KEY.replace(/\\n/g, '\n') : PRODUCT_PUBLIC_KEY_PEM;
    dispatcher = new Dispatcher(db, { publicKeyPem, machine: process.env.PETRA_MACHINE_HASH && !app.isPackaged ? process.env.PETRA_MACHINE_HASH : machineHash(machineFacts()) }, host);
    registerCoreServices(dispatcher);
    registerCatalogServices(dispatcher);
    blockNetwork();
    registerIpc(dispatcher);
    if (process.argv.includes('--smoke-test')) {
      // Installer smoke test: prove the packaged app opens node:sqlite in WAL mode, applied its migrations, and exits.
      const h = healthInfo(db);
      const out = process.env.PETRA_SMOKE_OUT;
      const tables = (db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'").get() as { n: number }).n;
      const ok = h.journalMode === 'wal' && h.integrity === 'ok' && app.isPackaged && tables > 20;
      if (out) fs.writeFileSync(out, JSON.stringify({ ok, packaged: app.isPackaged, tables, ...h, version: app.getVersion() }));
      closeDatabase(db);
      db = null;
      app.exit(ok ? 0 : 1);
      return;
    }
    createWindow();
  });

  app.on('window-all-closed', () => {
    if (db) closeDatabase(db);
    db = null;
    app.quit();
  });
}
