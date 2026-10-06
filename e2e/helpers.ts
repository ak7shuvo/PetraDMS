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

export interface SetupOptions {
  lang?: 'bn' | 'en';
  business?: string;
  name?: string;
  username?: string;
  pin?: string;
  mode?: 'simple' | 'full';
}

/** Walks the first-run wizard to the end and returns the printed recovery code. */
export async function completeSetup(page: Page, o: SetupOptions = {}): Promise<string> {
  const lang = o.lang ?? 'en';
  await page.waitForSelector('[data-testid="wizard-step-1"]');
  if (lang === 'en') await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByTestId('wizard-next').click();
  await page.getByTestId('biz-name').fill(o.business ?? 'Rahim Traders');
  await page.getByTestId('biz-phone').fill('01712345678');
  await page.getByTestId('wizard-next').click();
  await page.getByTestId('owner-name').fill(o.name ?? 'Rahim');
  await page.getByTestId('owner-username').fill(o.username ?? 'rahim');
  const pwInputs = page.locator('[data-testid="wizard-step-3"] input[type="password"]');
  await pwInputs.nth(0).fill(o.pin ?? '4321');
  await pwInputs.nth(1).fill(o.pin ?? '4321');
  await page.getByTestId('wizard-next').click();
  await page.getByTestId('wizard-next').click(); // data folder: keep
  if ((o.mode ?? 'full') === 'full') await page.getByTestId('mode-full').click();
  await page.getByTestId('wizard-next').click();
  await page.waitForSelector('[data-testid="recovery-code"]');
  const code = (await page.getByTestId('recovery-code').innerText()).trim();
  await page.getByTestId('recovery-confirm').check();
  await page.getByTestId('wizard-finish').click();
  return code;
}

/** Types a PIN on the on-screen keypad. */
export async function signInPin(page: Page, pin: string, userName?: string): Promise<void> {
  if (userName) await page.getByRole('button', { name: new RegExp(userName) }).click();
  for (const d of pin) await page.locator('.keypad').getByRole('button', { name: d, exact: true }).click();
  await page.getByTestId('signin').click();
}
