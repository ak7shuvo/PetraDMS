import { test, expect } from '@playwright/test';
import { generateKeyPairSync, sign as edSign, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { launch, completeSetup, signInPin } from './helpers';

const DAY = 86_400_000;

test('fresh install: wizard, recovery code, sign out, sign in, wrong PIN, lockout, recovery', async () => {
  const { app, page, dataDir, consoleErrors } = await launch();
  const code = await completeSetup(page, { lang: 'en' });
  expect(code).toMatch(/^([A-Z2-9]{4}-){4}[A-Z2-9]{4}$/);

  // lands inside the app as Owner
  await expect(page.getByTestId('account')).toContainText('Rahim');
  await page.locator('nav').getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('licence-banner')).toContainText('30 days');

  // the database was created in the chosen folder with the owner and defaults
  expect(fs.existsSync(path.join(dataDir, 'data', 'petra.db'))).toBe(true);

  // sign out, then wrong PIN twice, then correct PIN
  await page.getByTestId('account').click();
  await page.getByTestId('signout').click();
  await page.waitForSelector('[data-testid="pin-dots"]');
  await signInPin(page, '1111');
  await expect(page.getByTestId('login-error')).toContainText('Wrong PIN');
  await signInPin(page, '2222');
  await expect(page.getByTestId('login-error')).toContainText('Wrong PIN');
  await signInPin(page, '4321');
  await expect(page.getByTestId('account')).toContainText('Rahim');

  // five wrong attempts lock the account
  await page.getByTestId('account').click();
  await page.getByTestId('signout').click();
  for (let i = 0; i < 5; i++) await signInPin(page, '9999');
  await expect(page.getByTestId('login-error')).toContainText('Locked');
  await expect(page.getByTestId('signin')).toBeDisabled();

  // recovery code resets the Owner PIN
  await page.getByTestId('forgot').click();
  await page.getByTestId('recover-code').fill(code);
  const pw = page.getByRole('dialog').locator('input[type="password"]');
  await pw.nth(0).fill('7777');
  await pw.nth(1).fill('7777');
  await page.getByTestId('recover-submit').click();
  await page.waitForSelector('[data-testid="recovery-code"]');
  const code2 = (await page.getByTestId('recovery-code').innerText()).trim();
  expect(code2).not.toBe(code);
  await page.getByTestId('recover-done').click();
  await expect(page.getByTestId('account')).toContainText('Rahim');

  expect(consoleErrors).toEqual([]);
  await app.close();
});

test('wizard can move the data folder before anything is stored', async () => {
  const { app, page } = await launch();
  await page.waitForSelector('[data-testid="wizard-step-1"]');
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'petra-newroot-'));
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.getByTestId('wizard-next').click();
  await page.getByTestId('biz-name').fill('Moved Co');
  await page.getByTestId('wizard-next').click();
  await page.getByTestId('owner-name').fill('Owner');
  await page.getByTestId('owner-username').fill('owner');
  const pw = page.locator('[data-testid="wizard-step-3"] input[type="password"]');
  await pw.nth(0).fill('123456');
  await pw.nth(1).fill('123456');
  await page.getByTestId('wizard-next').click();
  await page.evaluate((p) => window.petra.invoke('setup:applyDataDir', { path: p }), target);
  expect(fs.existsSync(path.join(target, 'data', 'petra.db'))).toBe(true);
  await app.close();
});

test('staff cannot reach settings; roles are enforced in the main process', async () => {
  const { app, page } = await launch();
  await completeSetup(page, { lang: 'en' });
  await page.locator('nav').getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Users' }).click();
  await page.getByTestId('add-user').click();
  await page.getByTestId('user-username').fill('sara');
  await page.getByTestId('user-name').fill('Sara');
  await page.getByTestId('user-role').selectOption('staff');
  const pw = page.getByRole('dialog').locator('input[type="password"]');
  await pw.nth(0).fill('2468');
  await pw.nth(1).fill('2468');
  await page.getByTestId('user-save').click();
  await expect(page.getByRole('cell', { name: /Sara/ })).toBeVisible();
  await page.getByTestId('account').click();
  await page.getByTestId('signout').click();
  await signInPin(page, '2468', 'Sara');
  await expect(page.getByTestId('account')).toContainText('Sara');
  // staff default to Simple mode and have no Settings entry
  await expect(page.getByTestId('mode-toggle')).toContainText('full');
  await expect(page.getByRole('link', { name: 'Settings' })).toHaveCount(0);
  // a direct call to an owner-only channel is refused by the main process
  const denied = await page.evaluate(() => window.petra.invoke('users:list').then(() => 'allowed', (e: Error) => e.message));
  expect(denied).toContain('PERMISSION');
  await app.close();
});

test('licence: trial banner, tampered key, key for another machine, valid key; expiry makes the app read-only', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString().replace(/\n/g, '\\n');
  const machine = createHash('sha256').update('e2e-machine').digest('hex');
  const env = { PETRA_LICENCE_PUBLIC_KEY: pem, PETRA_MACHINE_HASH: machine };
  const issue = (m: string, expiresAt: string | null) => {
    const body = Buffer.from(JSON.stringify({ v: 1, customer: 'Rahim Traders', edition: 'standard', machine: m, issuedAt: '2026-10-01', expiresAt }));
    return `${body.toString('base64url')}.${edSign(null, body, privateKey).toString('base64url')}`;
  };
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'petra-lic-'));
  let run = await launch({ dataDir, env });
  await completeSetup(run.page, { lang: 'en' });
  await run.page.locator('nav').getByRole('link', { name: 'Settings', exact: true }).click();
  await run.page.getByRole('tab', { name: 'Licence' }).click();
  await expect(run.page.getByTestId('machine-code')).toHaveText(`${machine.slice(0, 16).toUpperCase().match(/.{4}/g)!.join('-')}`);
  // the customer can copy the code to send it to the vendor
  await run.page.getByTestId('machine-copy').click();
  await expect.poll(() => run.app.evaluate(({ clipboard }) => clipboard.readText())).toBe(machine.slice(0, 16).toUpperCase().match(/.{4}/g)!.join('-'));
  await expect(run.page.getByTestId('lic-days')).toContainText('30');

  const good = issue(machine.slice(0, 16), null);
  const [gBody, gSig] = good.split('.') as [string, string];
  const forged = JSON.parse(Buffer.from(gBody, 'base64url').toString()) as { expiresAt: string | null };
  forged.expiresAt = '2099-12-31';
  const tampered = `${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${gSig}`;
  await run.page.getByTestId('lic-blob').fill(tampered);
  await run.page.getByTestId('lic-install').click();
  await expect(run.page.getByTestId('lic-error')).toContainText('not genuine');
  await run.page.getByTestId('lic-blob').fill(issue(createHash('sha256').update('other').digest('hex').slice(0, 16), null));
  await run.page.getByTestId('lic-install').click();
  await expect(run.page.getByTestId('lic-error')).toContainText('different computer');
  await run.page.getByTestId('lic-blob').fill(good);
  await run.page.getByTestId('lic-install').click();
  await expect(run.page.getByText('Licensed', { exact: true })).toBeVisible();
  await expect(run.page.getByTestId('licence-banner')).toHaveCount(0);
  await run.app.close();

  // Expire the trial (new data folder, no licence): the app opens read-only and refuses writes with a clear message.
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'petra-exp-'));
  run = await launch({ dataDir: dir2, env });
  await completeSetup(run.page, { lang: 'en' });
  await run.app.close();
  const db = new DatabaseSync(path.join(dir2, 'data', 'petra.db'));
  const old = new Date(Date.now() - 40 * DAY).toISOString();
  db.prepare('UPDATE license_state SET trial_started_at = ?, last_seen_max = ?').run(old, old);
  db.close();
  run = await launch({ dataDir: dir2, env });
  await signInPin(run.page, '4321', 'Rahim').catch(() => signInPin(run.page, '4321'));
  await expect(run.page.getByTestId('licence-banner')).toContainText('Read-only');
  const msg = await run.page.evaluate(() => window.petra.invoke('settings:save', { taxBp: 500 }).then(() => 'allowed', (e: Error) => e.message));
  expect(msg).toContain('READ_ONLY');
  await run.app.close();
});
