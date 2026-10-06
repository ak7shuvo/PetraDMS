import { createHash, createPublicKey, verify as edVerify, type KeyObject } from 'node:crypto';
import type { LicenceStatus } from '@petra/core';
import { PetraError } from '@petra/core';
import type { Ctx } from '../ctx';
import { get, run } from '../sql';
import { audit } from '../audit';

/**
 * Vendor public key (Ed25519, SPKI PEM). The matching private key lives only in the vendor keygen tool
 * and is never part of this repository. Replace this value by running `pnpm keygen generate-keys`.
 */
export { PRODUCT_PUBLIC_KEY_PEM } from './publicKey';

export const TRIAL_DAYS = 30;
/** Clock moved back by more than this relative to the highest time ever seen means rollback. */
export const ROLLBACK_TOLERANCE_MS = 24 * 3600_000;
const DAY_MS = 86_400_000;

export interface LicencePayload {
  v: 1;
  customer: string;
  edition: string;
  /** Machine fingerprint prefix (the 16 hex characters of the Machine Code, lower case). */
  machine: string;
  issuedAt: string;
  expiresAt: string | null;
}

const b64u = (b: Buffer): string => b.toString('base64url');
const fromB64u = (s: string): Buffer => Buffer.from(s, 'base64url');

/** Machine fingerprint: sha256 of stable host facts. The 16-character machine code shown to users is its prefix. */
export function machineHash(facts: { hostname: string; cpuModel: string; platform: string; arch: string }): string {
  return createHash('sha256').update(`petra|${facts.hostname}|${facts.cpuModel}|${facts.platform}|${facts.arch}`).digest('hex');
}

export function machineCodeOf(hash: string): string {
  return (hash.slice(0, 16).toUpperCase().match(/.{4}/g) ?? []).join('-');
}

/** A licence file is `base64url(payload).base64url(signature)`. Used by the keygen tool and tests. */
export function signLicence(payload: LicencePayload, privateKey: KeyObject, sign: (data: Buffer, key: KeyObject) => Buffer): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  return `${b64u(body)}.${b64u(sign(body, privateKey))}`;
}

export type LicenceCheck =
  | { ok: true; payload: LicencePayload }
  | { ok: false; problem: 'tampered' | 'wrong_machine' | 'malformed' };

export function checkLicence(blob: string, publicKeyPem: string, machine: string): LicenceCheck {
  const parts = blob.trim().split('.');
  if (parts.length !== 2) return { ok: false, problem: 'malformed' };
  let payload: LicencePayload;
  let sig: Buffer;
  let body: Buffer;
  try {
    body = fromB64u(parts[0]!);
    sig = fromB64u(parts[1]!);
    payload = JSON.parse(body.toString('utf8')) as LicencePayload;
  } catch {
    return { ok: false, problem: 'malformed' };
  }
  if (payload?.v !== 1 || typeof payload.machine !== 'string' || typeof payload.customer !== 'string') return { ok: false, problem: 'malformed' };
  let valid = false;
  try {
    valid = edVerify(null, body, createPublicKey(publicKeyPem), sig);
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, problem: 'tampered' };
  if (payload.machine.length < 16 || !machine.startsWith(payload.machine)) return { ok: false, problem: 'wrong_machine' };
  return { ok: true, payload };
}

export interface LicenceEnv {
  publicKeyPem: string;
  machine: string;
}

interface StateRow {
  trial_started_at: string | null;
  last_seen_max: string | null;
  license_blob: string | null;
}

/**
 * Evaluates the licence. Side effects: stamps the trial start on first call and advances `last_seen_max`
 * (never backwards). When the clock is behind `last_seen_max` by more than a day the app goes read-only.
 */
export function licenceStatus(ctx: Ctx, env: LicenceEnv, nowMs: number = Date.parse(ctx.now())): LicenceStatus {
  const nowIso = new Date(nowMs).toISOString();
  let row = get<StateRow>(ctx.db, 'SELECT trial_started_at, last_seen_max, license_blob FROM license_state WHERE id = 1');
  if (!row) {
    run(ctx.db, 'INSERT INTO license_state(id, updated_at) VALUES(1, ?)', nowIso);
    row = { trial_started_at: null, last_seen_max: null, license_blob: null };
  }
  if (!row.trial_started_at) {
    run(ctx.db, 'UPDATE license_state SET trial_started_at = ?, updated_at = ? WHERE id = 1', nowIso, nowIso);
    row.trial_started_at = nowIso;
  }
  const machineCode = machineCodeOf(env.machine);
  const base = { customer: '', edition: '', expiresAt: null as string | null, machineCode };

  const seenMs = row.last_seen_max ? Date.parse(row.last_seen_max) : 0;
  if (seenMs - nowMs > ROLLBACK_TOLERANCE_MS) {
    return { ...base, state: 'clock_rollback', readOnly: true, daysLeft: null, problem: 'none' };
  }
  if (nowMs > seenMs) run(ctx.db, 'UPDATE license_state SET last_seen_max = ?, updated_at = ? WHERE id = 1', nowIso, nowIso);

  let problem: LicenceStatus['problem'] = 'none';
  if (row.license_blob) {
    const c = checkLicence(row.license_blob, env.publicKeyPem, env.machine);
    if (c.ok) {
      const exp = c.payload.expiresAt;
      const endMs = exp ? Date.parse(`${exp}T23:59:59Z`) : null;
      const left = endMs === null ? null : Math.ceil((endMs - nowMs) / DAY_MS);
      const expired = endMs !== null && nowMs > endMs;
      return {
        ...base,
        customer: c.payload.customer,
        edition: c.payload.edition,
        expiresAt: exp,
        state: expired ? 'expired' : 'licensed',
        readOnly: expired,
        daysLeft: left === null ? null : Math.max(0, left),
        problem: 'none'
      };
    }
    problem = c.problem;
  }
  const used = Math.floor((nowMs - Date.parse(row.trial_started_at)) / DAY_MS);
  const left = TRIAL_DAYS - used;
  return { ...base, state: left > 0 ? 'trial' : 'expired', readOnly: left <= 0, daysLeft: Math.max(0, left), problem };
}

/** Validates and stores a licence file. Throws INVALID_INPUT with the reason when it is not acceptable. */
export function installLicence(ctx: Ctx, env: LicenceEnv, blob: string): LicenceStatus {
  const c = checkLicence(blob, env.publicKeyPem, env.machine);
  if (!c.ok) throw new PetraError('INVALID_INPUT', `licence rejected: ${c.problem}`, { field: 'licence', problem: c.problem });
  run(ctx.db, 'INSERT OR IGNORE INTO license_state(id, updated_at) VALUES(1, ?)', ctx.now());
  run(ctx.db, 'UPDATE license_state SET license_blob = ?, updated_at = ? WHERE id = 1', blob.trim(), ctx.now());
  audit(ctx, { action: 'licence.install', entity: 'license_state', entityId: 1, after: { customer: c.payload.customer, edition: c.payload.edition, expiresAt: c.payload.expiresAt } });
  return licenceStatus(ctx, env);
}

export function assertWritable(ctx: Ctx, env: LicenceEnv): void {
  if (licenceStatus(ctx, env).readOnly) throw new PetraError('READ_ONLY', 'licence expired: read-only');
}
