import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { openDatabase, healthInfo, type Db } from '@petra/db';
import { ipcContract, type IpcChannel } from '@petra/core';

// Test and CI runs can point the app at an isolated data directory.
const dataRoot = process.env.PETRA_DATA_DIR
  ? path.resolve(process.env.PETRA_DATA_DIR)
  : path.join(process.env.LOCALAPPDATA ?? app.getPath('userData'), 'PetraDMS');

// Isolated runs also isolate Chromium's profile (localStorage, locks) so tests never share UI prefs.
if (process.env.PETRA_DATA_DIR) app.setPath('userData', path.join(dataRoot, 'electron'));

let db: Db | null = null;
let mainWindow: BrowserWindow | null = null;

function ensureDirs(): void {
  for (const d of ['data', 'backups', 'exports', 'invoices', 'logs']) {
    fs.mkdirSync(path.join(dataRoot, d), { recursive: true });
  }
}

function handle<C extends IpcChannel>(channel: C, fn: (input: unknown) => unknown): void {
  ipcMain.handle(channel, async (_event, raw: unknown) => {
    const parsedIn = ipcContract[channel].input.parse(raw);
    const result = await fn(parsedIn);
    return ipcContract[channel].output.parse(result);
  });
}

function registerIpc(): void {
  handle('app:health', () => {
    const h = healthInfo(db as Db);
    return {
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron ?? '',
      nodeVersion: process.versions.node,
      ...h,
      packaged: app.isPackaged,
      dataDir: dataRoot
    };
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
    ensureDirs();
    db = openDatabase(path.join(dataRoot, 'data', 'petra.db'));
    blockNetwork();
    registerIpc();
    if (process.argv.includes('--smoke-test')) {
      // Installer smoke test: prove the packaged app can open node:sqlite in WAL mode, then exit.
      const h = healthInfo(db);
      const out = process.env.PETRA_SMOKE_OUT;
      const ok = h.journalMode === 'wal' && h.integrity === 'ok' && app.isPackaged;
      if (out) fs.writeFileSync(out, JSON.stringify({ ok, packaged: app.isPackaged, ...h, version: app.getVersion() }));
      db.close();
      db = null;
      app.exit(ok ? 0 : 1);
      return;
    }
    createWindow();
  });

  app.on('window-all-closed', () => {
    db?.close();
    db = null;
    app.quit();
  });
}
