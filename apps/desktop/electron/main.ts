import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  Dispatcher, PRODUCT_PUBLIC_KEY_PEM, healthInfo, loadMigrations, machineHash, migrate, openDatabase, registerCoreServices, registerCatalogServices, registerSalesServices, closeDatabase, type Db, type Host
} from '@petra/db';
import { ipcContract, PetraError, type PrintFormat } from '@petra/core';

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


// ===== Printing (plan 11.1): HTML templates rendered in a hidden window, printed or saved as PDF =====
let cachedFontCss: string | null = null;

/** Bundled fonts embedded as base64 so printed pages and PDFs carry Bangla glyphs without any network or system font. */
function fontCss(): string {
  if (cachedFontCss !== null) return cachedFontCss;
  const faces: [string, number, string, string][] = [
    ['JetBrains Mono', 400, 'jetbrains-mono-latin-400-normal.woff2', 'U+0000-00FF,U+2000-206F,U+20AC,U+2212'],
    ['JetBrains Mono', 700, 'jetbrains-mono-latin-700-normal.woff2', 'U+0000-00FF,U+2000-206F,U+20AC,U+2212'],
    ['Noto Sans Bengali', 400, 'noto-sans-bengali-bengali-400-normal.woff2', 'U+0980-09FE,U+200C-200D,U+20B9,U+25CC'],
    ['Noto Sans Bengali', 700, 'noto-sans-bengali-bengali-700-normal.woff2', 'U+0980-09FE,U+200C-200D,U+20B9,U+25CC']
  ];
  cachedFontCss = faces
    .map(([family, weight, file, range]) => {
      try {
        const b64 = fs.readFileSync(path.join(__dirname, 'fonts', file)).toString('base64');
        return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2');unicode-range:${range}}`;
      } catch {
        return '';
      }
    })
    .join('');
  return cachedFontCss;
}

const PAGE_MM: Record<PrintFormat, number> = { a4: 210, thermal80: 80, thermal58: 58 };

async function withPrintWindow<T>(html: string, fn: (w: BrowserWindow) => Promise<T>): Promise<T> {
  const tmp = path.join(os.tmpdir(), `petra-print-${process.pid}-${Date.now()}.html`);
  fs.writeFileSync(tmp, html, 'utf8');
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  try {
    await w.loadFile(tmp);
    await w.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
    return await fn(w);
  } catch (e) {
    if (e instanceof PetraError) throw e;
    throw new PetraError('IO_FAILED', e instanceof Error ? e.message : String(e));
  } finally {
    w.destroy();
    fs.rmSync(tmp, { force: true });
  }
}

/** Thermal rolls have no fixed height: measure the rendered content and size the page to it. */
async function contentHeightPx(w: BrowserWindow): Promise<number> {
  return Number(await w.webContents.executeJavaScript('Math.ceil(document.documentElement.scrollHeight)')) || 600;
}

const printHost = {
  fontCss,
  async printHtml(html: string, o: { format: PrintFormat; silent: boolean; printerName: string }): Promise<void> {
    await withPrintWindow(html, async (w) => {
      const pageSize = o.format === 'a4' ? 'A4' : { width: PAGE_MM[o.format] * 1000, height: Math.max(100_000, Math.round((await contentHeightPx(w)) * 264.58) + 10_000) };
      await new Promise<void>((resolve, reject) => {
        w.webContents.print({ silent: o.silent, deviceName: o.printerName || undefined, printBackground: true, pageSize }, (success, reason) =>
          success || reason === 'cancelled' ? resolve() : reject(new PetraError('IO_FAILED', `print failed: ${reason}`)));
      });
    });
  },
  async pdfHtml(html: string, o: { format: PrintFormat; file: string }): Promise<void> {
    const pdf = await withPrintWindow(html, async (w) => {
      if (o.format === 'a4') return w.webContents.printToPDF({ pageSize: 'A4', printBackground: true, preferCSSPageSize: true });
      const h = await contentHeightPx(w);
      return w.webContents.printToPDF({ pageSize: { width: PAGE_MM[o.format] / 25.4, height: Math.max(3, h / 96 + 0.2) }, margins: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 }, printBackground: true });
    });
    fs.mkdirSync(path.dirname(o.file), { recursive: true });
    fs.writeFileSync(o.file, pdf);
  },
  reveal(file: string): void {
    shell.showItemInFolder(file);
  }
};

const host: Host = {
  ...printHost,
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
    if (!url.startsWith('file://') && (app.isPackaged || !url.startsWith('http://localhost:'))) throw new Error('untrusted sender');
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
    if (!url.startsWith('file://') && (app.isPackaged || !url.startsWith('http://localhost:'))) e.preventDefault();
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
    registerSalesServices(dispatcher);
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
