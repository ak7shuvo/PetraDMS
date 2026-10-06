import { generateKeyPairSync } from 'node:crypto';
import type { IpcChannel, IpcInput, IpcOutput, Role } from '@petra/core';
import { createBareDb } from './testkit';
import { Dispatcher, type Host } from './app/dispatcher';
import { registerCoreServices } from './app/coreServices';
import { registerCatalogServices } from './app/catalogServices';
import { registerSalesServices } from './app/salesServices';
import { registerMoneyServices } from './app/moneyServices';
import { machineHash } from './app/licence';
import { checkIntegrity, formatViolations } from './integrity';

export const { publicKey: TEST_PUBLIC, privateKey: TEST_PRIVATE } = generateKeyPairSync('ed25519');
export const PUB = TEST_PUBLIC.export({ type: 'spki', format: 'pem' }).toString();
export const MACHINE = machineHash({ hostname: 'SHOP-PC', cpuModel: 'Intel(R) Core(TM) i3', platform: 'win32', arch: 'x64' });
export const DAY = 86_400_000;
export const T0 = Date.parse('2026-10-01T05:00:00.000Z');

export const setupInput = {
  language: 'bn' as const,
  business: { name: 'Rahim Traders', nameBn: 'রহিম ট্রেডার্স', address: 'Sylhet', phone: '01712345678', email: '', taxNo: '', footerNote: '' },
  owner: { displayName: 'Rahim', username: 'rahim', kind: 'pin' as const, secret: '4321' },
  uiMode: 'full' as const
};

export function makeApp(nowRef: { t: number } = { t: T0 }) {
  const { db, close } = createBareDb();
  const printed: string[] = [];
  const pdfs: string[] = [];
  const host: Host = {
    appVersion: '1.0.0',
    dataDir: 'C:\\PetraDMS',
    health: () => ({ appVersion: '1.0.0', electronVersion: '', nodeVersion: '', sqliteVersion: '', journalMode: 'wal', synchronous: 2, foreignKeys: 1, integrity: 'ok', packaged: false, dataDir: '' }),
    pickDataDir: async () => null,
    applyDataDir: async () => undefined,
    recommendedDataDir: () => 'D:\\PetraData',
    pickLicenceFile: async () => null,
    fontCss: () => '',
    printHtml: async (html) => { printed.push(html); },
    pdfHtml: async (html, o) => { printed.push(html); pdfs.push(o.file); },
    reveal: () => undefined
  };
  const d = new Dispatcher(db, { publicKeyPem: PUB, machine: MACHINE }, host, () => new Date(nowRef.t).toISOString());
  registerCoreServices(d);
  registerCatalogServices(d);
  registerSalesServices(d);
  registerMoneyServices(d);
  return { d, db, close, nowRef, printed, pdfs };
}

export type App = ReturnType<typeof makeApp>;

/** Calls a channel and returns its data, throwing with the error code when it fails. */
export async function ok<C extends IpcChannel>(d: Dispatcher, channel: C, input?: IpcInput<C>): Promise<IpcOutput<C>> {
  const r = await d.call(channel, input);
  if (!r.ok) throw new Error(`${channel} failed: ${r.error.code} ${r.error.message}`);
  return r.data as IpcOutput<C>;
}

export async function fail(d: Dispatcher, channel: IpcChannel, input?: unknown): Promise<string> {
  const r = await d.call(channel, input);
  if (r.ok) throw new Error(`${channel} should have failed`);
  return r.error.code;
}

/** Runs first-run setup (Owner signed in) and creates a manager and a staff user. Returns their ids. */
export async function setupWithUsers(d: Dispatcher): Promise<{ owner: number; manager: number; staff: number }> {
  const done = await ok(d, 'setup:complete', setupInput);
  const manager = await ok(d, 'users:create', { username: 'mgr', displayName: 'Manager', role: 'manager', kind: 'pin', secret: '1111' });
  const staff = await ok(d, 'users:create', { username: 'stf', displayName: 'Staff', role: 'staff', kind: 'pin', secret: '2222' });
  return { owner: done.session.userId, manager: manager.id, staff: staff.id };
}

export async function signInAs(d: Dispatcher, userId: number, role: Role): Promise<void> {
  await ok(d, 'auth:logout');
  await ok(d, 'auth:login', { userId, secret: role === 'owner' ? '4321' : role === 'manager' ? '1111' : '2222' });
}

/** Asserts all ten integrity invariants hold, printing violations when they do not. */
export function expectIntegrity(app: App): void {
  const v = checkIntegrity(app.db);
  if (v.length > 0) throw new Error(`integrity violations:\n${formatViolations(v)}`);
}
