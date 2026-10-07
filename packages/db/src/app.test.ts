import { describe, expect, it } from 'vitest';
import { generateKeyPairSync, sign as edSign, createPublicKey } from 'node:crypto';
import { PetraError, type LicenceStatus } from '@petra/core';
import { createBareDb } from './testkit';
import { DAY, MACHINE, PUB, T0, makeApp, setupInput } from './testApp';
import { makeCtx } from './ctx';
import { checkLicence, installLicence, licenceStatus, machineCodeOf, machineHash, signLicence, TRIAL_DAYS, type LicencePayload } from './app/licence';
import { LOCK_MINUTES, MAX_ATTEMPTS, generateRecoveryCode, hashSecret, verifySecret } from './app/auth';
import { TEST_PRIVATE as privateKey } from './testApp';

async function ok<T>(p: Promise<{ ok: boolean; data?: unknown; error?: { code: string } }>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(`call failed: ${r.error?.code}`);
  return r.data as T;
}

const other = generateKeyPairSync('ed25519');

function issue(over: Partial<LicencePayload> = {}, key = privateKey): string {
  const payload: LicencePayload = { v: 1, customer: 'Rahim Traders', edition: 'standard', machine: MACHINE.slice(0, 16), issuedAt: '2026-10-01', expiresAt: null, ...over };
  return signLicence(payload, key, (data, k) => edSign(null, data, k));
}

function clock(ms: { t: number }) {
  return () => new Date(ms.t).toISOString();
}

describe('licence', () => {
  const env = { publicKeyPem: PUB, machine: MACHINE };

  it('a valid licence is accepted and shown as licensed with no expiry', () => {
    const { db, close } = createBareDb();
    const ctx = makeCtx(db, null, () => new Date(T0).toISOString());
    const st = installLicence(ctx, env, issue());
    expect(st.state).toBe('licensed');
    expect(st.readOnly).toBe(false);
    expect(st.customer).toBe('Rahim Traders');
    expect(st.daysLeft).toBeNull();
    close();
  });

  it('a tampered licence is rejected', () => {
    const blob = issue();
    const [body, sig] = blob.split('.') as [string, string];
    const forged = JSON.parse(Buffer.from(body, 'base64url').toString()) as LicencePayload;
    forged.expiresAt = '2099-01-01';
    const tamperedBody = Buffer.from(JSON.stringify(forged)).toString('base64url');
    expect(checkLicence(`${tamperedBody}.${sig}`, PUB, MACHINE)).toEqual({ ok: false, problem: 'tampered' });
    expect(checkLicence(issue({}, other.privateKey), PUB, MACHINE)).toEqual({ ok: false, problem: 'tampered' });
    expect(checkLicence('not-a-licence', PUB, MACHINE)).toEqual({ ok: false, problem: 'malformed' });
    const { db, close } = createBareDb();
    const ctx = makeCtx(db, null, () => new Date(T0).toISOString());
    expect(() => installLicence(ctx, env, `${tamperedBody}.${sig}`)).toThrow(PetraError);
    close();
  });

  it('a licence for another machine is rejected', () => {
    const otherMachine = machineHash({ hostname: 'OTHER-PC', cpuModel: 'Intel(R) Core(TM) i3', platform: 'win32', arch: 'x64' });
    expect(checkLicence(issue({ machine: otherMachine.slice(0, 16) }), PUB, MACHINE)).toEqual({ ok: false, problem: 'wrong_machine' });
    const { db, close } = createBareDb();
    const ctx = makeCtx(db, null, () => new Date(T0).toISOString());
    try {
      installLicence(ctx, env, issue({ machine: otherMachine.slice(0, 16) }));
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as PetraError).params.problem).toBe('wrong_machine');
    }
    close();
  });

  it('an expired licence makes the app read-only; the last valid day still works', () => {
    const { db, close } = createBareDb();
    const now = { t: T0 };
    const ctx = makeCtx(db, null, clock(now));
    installLicence(ctx, env, issue({ expiresAt: '2026-10-10' }));
    now.t = Date.parse('2026-10-10T12:00:00Z');
    expect(licenceStatus(ctx, env).state).toBe('licensed');
    now.t = Date.parse('2026-10-11T06:00:00Z');
    const st = licenceStatus(ctx, env);
    expect(st.state).toBe('expired');
    expect(st.readOnly).toBe(true);
    close();
  });

  it('clock rollback is detected and the app goes read-only until the clock is restored', () => {
    const { db, close } = createBareDb();
    const now = { t: T0 };
    const ctx = makeCtx(db, null, clock(now));
    expect(licenceStatus(ctx, env).state).toBe('trial');
    now.t = T0 + 20 * DAY;
    licenceStatus(ctx, env);
    now.t = T0 + 2 * DAY; // user winds the clock back to extend the trial
    const st = licenceStatus(ctx, env);
    expect(st.state).toBe('clock_rollback');
    expect(st.readOnly).toBe(true);
    now.t = T0 + 20 * DAY + 3600_000; // back to real time
    expect(licenceStatus(ctx, env).state).toBe('trial');
    close();
  });

  it('a small clock adjustment (under a day) is tolerated', () => {
    const { db, close } = createBareDb();
    const now = { t: T0 };
    const ctx = makeCtx(db, null, clock(now));
    licenceStatus(ctx, env);
    now.t = T0 + 3 * DAY;
    licenceStatus(ctx, env);
    now.t = T0 + 3 * DAY - 2 * 3600_000;
    expect(licenceStatus(ctx, env).state).toBe('trial');
    close();
  });

  it('the trial lasts 30 days from first run, then the app is read-only', () => {
    const { db, close } = createBareDb();
    const now = { t: T0 };
    const ctx = makeCtx(db, null, clock(now));
    let st = licenceStatus(ctx, env);
    expect(st.state).toBe('trial');
    expect(st.daysLeft).toBe(TRIAL_DAYS);
    now.t = T0 + 29 * DAY;
    st = licenceStatus(ctx, env);
    expect(st).toMatchObject({ state: 'trial', daysLeft: 1, readOnly: false });
    now.t = T0 + 30 * DAY;
    st = licenceStatus(ctx, env);
    expect(st).toMatchObject({ state: 'expired', readOnly: true, daysLeft: 0 });
    close();
  });

  it('machine code is a stable, readable prefix of the fingerprint', () => {
    // with an OS machine id the code ignores the PC name and CPU; without one it is the old host-based code
    const a = machineHash({ hostname: 'A', cpuModel: 'x', platform: 'win32', arch: 'x64', machineId: '3F2A9C1E-5B7D-4E8A-9C0B-1D2E3F4A5B6C' });
    const b = machineHash({ hostname: 'RENAMED', cpuModel: 'another cpu', platform: 'win32', arch: 'x64', machineId: '3f2a9c1e-5b7d-4e8a-9c0b-1d2e3f4a5b6c' });
    expect(a).toBe(b);
    expect(a).not.toBe(machineHash({ hostname: 'A', cpuModel: 'x', platform: 'win32', arch: 'x64', machineId: '00000000-0000-4000-8000-000000000001' }));
    expect(machineHash({ hostname: 'A', cpuModel: 'x', platform: 'win32', arch: 'x64', machineId: null })).toBe(machineHash({ hostname: 'A', cpuModel: 'x', platform: 'win32', arch: 'x64' }));
    expect(machineHash({ hostname: 'A', cpuModel: 'x', platform: 'win32', arch: 'x64', machineId: 'not a guid' })).toBe(machineHash({ hostname: 'A', cpuModel: 'x', platform: 'win32', arch: 'x64' }));
    expect(machineCodeOf(MACHINE)).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);
    expect(createPublicKey(PUB).asymmetricKeyType).toBe('ed25519');
  });
});

describe('secrets', () => {
  it('hashes with scrypt and verifies', () => {
    const h = hashSecret('pin', '123456');
    expect(h.startsWith('pin:scrypt$')).toBe(true);
    expect(verifySecret(h, '123456')).toBe(true);
    expect(verifySecret(h, '123457')).toBe(false);
    expect(hashSecret('pin', '123456')).not.toBe(h);
  });
  it('enforces PIN 4 to 6 digits and password 6+ characters', () => {
    expect(() => hashSecret('pin', '123')).toThrow(PetraError);
    expect(() => hashSecret('pin', '1234567')).toThrow(PetraError);
    expect(() => hashSecret('pin', 'abcd')).toThrow(PetraError);
    expect(() => hashSecret('password', 'short')).toThrow(PetraError);
    expect(verifySecret(hashSecret('password', 'a longer pass'), 'a longer pass')).toBe(true);
  });
  it('recovery codes are 20 characters in groups and unique', () => {
    const a = generateRecoveryCode();
    expect(a).toMatch(/^([A-Z2-9]{4}-){4}[A-Z2-9]{4}$/);
    expect(generateRecoveryCode()).not.toBe(a);
  });
});

describe('first run, auth and roles through the dispatcher', () => {
  it('fresh database needs setup; setup creates the owner, defaults and a recovery code, and can run only once', async () => {
    const { d, close } = makeApp();
    let st = await ok<{ needsSetup: boolean; licence: LicenceStatus }>(d.call('app:status', undefined));
    expect(st.needsSetup).toBe(true);
    expect(st.licence.state).toBe('trial');
    const done = await ok<{ recoveryCode: string; session: { role: string } }>(d.call('setup:complete', setupInput));
    expect(done.session.role).toBe('owner');
    expect(done.recoveryCode).toMatch(/^([A-Z2-9]{4}-){4}[A-Z2-9]{4}$/);
    st = await ok(d.call('app:status', undefined));
    expect(st.needsSetup).toBe(false);
    const again = await d.call('setup:complete', setupInput);
    expect(again.ok).toBe(false);
    const accounts = (d.db.prepare('SELECT COUNT(*) AS n FROM money_accounts').get() as { n: number }).n;
    expect(accounts).toBe(4);
    close();
  });

  it('protected channels need a session; owner-only channels reject staff and managers', async () => {
    const { d, close } = makeApp();
    await ok(d.call('setup:complete', setupInput));
    d.session = null;
    expect(await d.call('settings:get', undefined)).toMatchObject({ ok: false, error: { code: 'PERMISSION' } });
    const owner = (await ok<{ id: number }[]>(d.call('auth:users', undefined)))[0]!;
    await ok(d.call('auth:login', { userId: owner.id, secret: '4321' }));
    const mgr = await ok<{ id: number }>(d.call('users:create', { username: 'mgr', displayName: 'Manager', role: 'manager', kind: 'pin', secret: '1111' }));
    const staff = await ok<{ id: number }>(d.call('users:create', { username: 'stf', displayName: 'Staff', role: 'staff', kind: 'pin', secret: '2222' }));
    await ok(d.call('auth:logout', undefined));
    await ok(d.call('auth:login', { userId: mgr.id, secret: '1111' }));
    expect(await d.call('users:list', undefined)).toMatchObject({ ok: false, error: { code: 'PERMISSION' } });
    expect(await d.call('settings:save', { taxBp: 500 })).toMatchObject({ ok: false, error: { code: 'PERMISSION' } });
    await ok(d.call('auth:logout', undefined));
    await ok(d.call('auth:login', { userId: staff.id, secret: '2222' }));
    expect(await d.call('settings:get', undefined)).toMatchObject({ ok: true });
    expect(await d.call('profile:save', setupInput.business)).toMatchObject({ ok: false, error: { code: 'PERMISSION' } });
    close();
  });

  it('five wrong attempts lock the account; the lock expires; success resets the counter', async () => {
    const now = { t: T0 };
    const { d, close } = makeApp(now);
    await ok(d.call('setup:complete', setupInput));
    d.session = null;
    const owner = (await ok<{ id: number }[]>(d.call('auth:users', undefined)))[0]!;
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      expect(await d.call('auth:login', { userId: owner.id, secret: '0000' })).toMatchObject({ ok: false, error: { code: 'AUTH_FAILED' } });
    }
    expect(await d.call('auth:login', { userId: owner.id, secret: '0000' })).toMatchObject({ ok: false, error: { code: 'LOCKED_OUT' } });
    expect(await d.call('auth:login', { userId: owner.id, secret: '4321' })).toMatchObject({ ok: false, error: { code: 'LOCKED_OUT' } });
    now.t += (LOCK_MINUTES + 1) * 60_000;
    expect(await d.call('auth:login', { userId: owner.id, secret: '4321' })).toMatchObject({ ok: true });
    close();
  });

  it('the recovery code resets the owner PIN once and issues a new code', async () => {
    const { d, close } = makeApp();
    const { recoveryCode } = await ok<{ recoveryCode: string }>(d.call('setup:complete', setupInput));
    d.session = null;
    expect(await d.call('auth:recover', { recoveryCode: 'AAAA-BBBB-CCCC-DDDD-EEEE', kind: 'pin', newSecret: '9999' })).toMatchObject({ ok: false, error: { code: 'AUTH_FAILED' } });
    const r = await ok<{ recoveryCode: string; session: { role: string } }>(d.call('auth:recover', { recoveryCode: recoveryCode.toLowerCase().replace(/-/g, ' '), kind: 'pin', newSecret: '9999' }));
    expect(r.session.role).toBe('owner');
    expect(r.recoveryCode).not.toBe(recoveryCode);
    d.session = null;
    const owner = (await ok<{ id: number }[]>(d.call('auth:users', undefined)))[0]!;
    expect(await d.call('auth:login', { userId: owner.id, secret: '9999' })).toMatchObject({ ok: true });
    d.session = null;
    expect(await d.call('auth:recover', { recoveryCode, kind: 'pin', newSecret: '1234' })).toMatchObject({ ok: false });
    close();
  });

  it('after the trial ends writes fail with READ_ONLY while reads, backup-style calls and sign-in still work', async () => {
    const now = { t: T0 };
    const { d, close } = makeApp(now);
    await ok(d.call('setup:complete', setupInput));
    now.t = T0 + 31 * DAY;
    expect(await d.call('profile:save', setupInput.business)).toMatchObject({ ok: false, error: { code: 'READ_ONLY' } });
    expect(await d.call('settings:get', undefined)).toMatchObject({ ok: true });
    expect(await d.call('auth:users', undefined)).toMatchObject({ ok: true });
    close();
  });

  it('the last active owner cannot be demoted or deactivated', async () => {
    const { d, close } = makeApp();
    const { session } = await ok<{ session: { userId: number } }>(d.call('setup:complete', setupInput));
    expect(await d.call('users:update', { id: session.userId, role: 'staff' })).toMatchObject({ ok: false, error: { code: 'PERMISSION' } });
    expect(await d.call('users:update', { id: session.userId, active: false })).toMatchObject({ ok: false, error: { code: 'PERMISSION' } });
    close();
  });

  it('invalid input is rejected before any handler runs', async () => {
    const { d, close } = makeApp();
    const r = await d.call('setup:complete', { ...setupInput, owner: { ...setupInput.owner, secret: '12' } });
    expect(r).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    close();
  });
});
