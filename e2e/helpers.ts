import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

export interface Launched {
  app: ElectronApplication;
  page: Page;
  dataDir: string;
  consoleErrors: string[];
}

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../apps/desktop');

export async function launch(opts: { dataDir?: string; env?: Record<string, string> } = {}): Promise<Launched> {
  const dataDir = opts.dataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'petra-e2e-'));
  const args = [desktopDir];
  // GitHub-hosted Ubuntu runners and containers need the sandbox flags off for Chromium.
  if (process.platform === 'linux') args.push('--no-sandbox', '--disable-gpu');
  const app = await electron.launch({
    args,
    env: { ...process.env, PETRA_DATA_DIR: dataDir, ELECTRON_DISABLE_SECURITY_WARNINGS: '1', ...opts.env } as Record<string, string>
  });
  const page = await app.firstWindow();
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  await page.waitForLoadState('domcontentloaded');
  return { app, page, dataDir, consoleErrors };
}
