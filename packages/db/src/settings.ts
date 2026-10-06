import { type Db, all, get, run } from './sql';
import type { Ctx } from './ctx';

export interface Settings {
  allowNegativeStock: boolean;
  creditLimitMode: 'off' | 'warn' | 'approval' | 'block';
  minPriceMode: 'off' | 'approval';
  taxBp: number;
  roundOff: boolean;
  rolloverHour: number;
  language: 'en' | 'bn';
  bnDigits: boolean;
  grouping: 'lakh' | 'intl';
  fontSize: 'normal' | 'large' | 'xlarge';
  highContrast: boolean;
  animations: 'full' | 'reduced' | 'off';
  uiMode: 'simple' | 'full';
  idleLockMinutes: number;
  receiptFormat: 'a4' | 'thermal80' | 'thermal58';
  printSilently: boolean;
  printerName: string;
  bilingualHeadings: boolean;
  backupIntervalMinutes: number;
  secondBackupDir: string;
  dataDirRecommended: string;
}

export const SETTING_DEFAULTS: Settings = {
  allowNegativeStock: false,
  creditLimitMode: 'warn',
  minPriceMode: 'approval',
  taxBp: 0,
  roundOff: false,
  rolloverHour: 4,
  language: 'en',
  bnDigits: false,
  grouping: 'lakh',
  fontSize: 'normal',
  highContrast: false,
  animations: 'full',
  uiMode: 'full',
  idleLockMinutes: 0,
  receiptFormat: 'a4',
  printSilently: false,
  printerName: '',
  bilingualHeadings: false,
  backupIntervalMinutes: 30,
  secondBackupDir: '',
  dataDirRecommended: ''
};

const toKey = (k: string): string => k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());

export function loadSettings(db: Db): Settings {
  const rows = all<{ key: string; value: string }>(db, 'SELECT key, value FROM app_settings');
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const out: Record<string, unknown> = { ...SETTING_DEFAULTS };
  for (const [k, def] of Object.entries(SETTING_DEFAULTS)) {
    const raw = map.get(toKey(k));
    if (raw === undefined) continue;
    if (typeof def === 'boolean') out[k] = raw === '1' || raw === 'true';
    else if (typeof def === 'number') out[k] = Number(raw);
    else out[k] = raw;
  }
  return out as unknown as Settings;
}

export function saveSetting<K extends keyof Settings>(ctx: Ctx, key: K, value: Settings[K]): void {
  const v = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
  run(ctx.db, 'INSERT INTO app_settings(key, value, updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at', toKey(key), v, ctx.now());
}

export function getRaw(db: Db, key: string): string | undefined {
  return get<{ value: string }>(db, 'SELECT value FROM app_settings WHERE key = ?', key)?.value;
}

export function setRaw(ctx: Ctx, key: string, value: string): void {
  run(ctx.db, 'INSERT INTO app_settings(key, value, updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at', key, value, ctx.now());
}

const DEFAULT_PREFIX: Record<string, string> = {
  INV: 'INV-', PUR: 'PUR-', RCT: 'RCT-', PAY: 'PAY-', EXP: 'EXP-', SRN: 'SRN-', PRN: 'PRN-', ADJ: 'ADJ-', CLS: 'CLS-'
};

/** Next document number, incremented atomically inside the posting transaction (section 5.9). */
export function nextDocNo(ctx: Ctx, key: keyof typeof DEFAULT_PREFIX | string): string {
  run(ctx.db, 'INSERT INTO counters(key, next) VALUES(?, 1) ON CONFLICT(key) DO NOTHING', key);
  const row = get<{ next: number }>(ctx.db, 'UPDATE counters SET next = next + 1 WHERE key = ? RETURNING next - 1 AS next', key);
  const n = row?.next ?? 1;
  const prefix = getRaw(ctx.db, `num_${key.toLowerCase()}_prefix`) ?? DEFAULT_PREFIX[key] ?? `${key}-`;
  const pad = Number(getRaw(ctx.db, `num_${key.toLowerCase()}_pad`) ?? 6);
  return `${prefix}${String(n).padStart(pad, '0')}`;
}
