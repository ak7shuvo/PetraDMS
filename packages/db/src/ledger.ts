import { PetraError } from '@petra/core';
import { get, run } from './sql';
import type { Ctx } from './ctx';

export type PartyKind = 'customer' | 'supplier' | 'employee';
export type LedgerKind = 'opening' | 'sale' | 'purchase' | 'payment' | 'return' | 'adjustment' | 'salary_due' | 'salary_paid' | 'advance' | 'void_reversal';

const PARTY_TABLE: Record<PartyKind, string> = { customer: 'customers', supplier: 'suppliers', employee: 'employees' };

export interface LedgerPost {
  partyKind: PartyKind;
  partyId: number;
  kind: LedgerKind;
  /** Signed. customer: + they owe us. supplier/employee: + we owe them. */
  amount: number;
  refType?: string | null;
  refId?: number | null;
  date: string;
  note?: string;
  reversesId?: number | null;
}

/** Appends to the party ledger and updates the cached balance in the same transaction. */
export function postLedger(ctx: Ctx, p: LedgerPost): number {
  if (!Number.isSafeInteger(p.amount)) throw new PetraError('INVALID_INPUT', 'amount must be an integer');
  const table = PARTY_TABLE[p.partyKind];
  const exists = get(ctx.db, `SELECT id FROM ${table} WHERE id = ?`, p.partyId);
  if (!exists) throw new PetraError('NOT_FOUND', `${p.partyKind} not found`, { what: p.partyKind, id: p.partyId });
  const r = run(
    ctx.db,
    'INSERT INTO party_ledger(party_kind, party_id, entry_kind, amount, ref_type, ref_id, reverses_id, business_date, note, user_id, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    p.partyKind, p.partyId, p.kind, p.amount, p.refType ?? null, p.refId ?? null, p.reversesId ?? null, p.date, p.note ?? '', ctx.userId, ctx.now()
  );
  run(ctx.db, `UPDATE ${table} SET balance = balance + ?, updated_at = ? WHERE id = ?`, p.amount, ctx.now(), p.partyId);
  return r.id;
}

export type CashSource = 'opening' | 'sale' | 'purchase' | 'payment' | 'expense' | 'salary' | 'advance' | 'refund' | 'day_close' | 'void_reversal';

export interface CashPost {
  accountId: number;
  date: string;
  /** Signed: + money in, - money out. */
  amount: number;
  source: CashSource;
  refType?: string | null;
  refId?: number | null;
  partyKind?: PartyKind | null;
  partyId?: number | null;
  note?: string;
  reversesId?: number | null;
}

export function postCash(ctx: Ctx, p: CashPost): number {
  if (!Number.isSafeInteger(p.amount)) throw new PetraError('INVALID_INPUT', 'amount must be an integer');
  const acc = get<{ id: number; active: number }>(ctx.db, 'SELECT id, active FROM money_accounts WHERE id = ?', p.accountId);
  if (!acc) throw new PetraError('NOT_FOUND', 'money account not found', { what: 'account', id: p.accountId });
  const r = run(
    ctx.db,
    'INSERT INTO cash_transactions(account_id, business_date, direction, amount, source, ref_type, ref_id, reverses_id, party_kind, party_id, note, user_id, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
    p.accountId, p.date, p.amount >= 0 ? 'in' : 'out', p.amount, p.source, p.refType ?? null, p.refId ?? null, p.reversesId ?? null,
    p.partyKind ?? null, p.partyId ?? null, p.note ?? '', ctx.userId, ctx.now()
  );
  run(ctx.db, 'UPDATE money_accounts SET balance = balance + ? WHERE id = ?', p.amount, p.accountId);
  return r.id;
}

export function defaultAccountId(ctx: Ctx): number {
  const row = get<{ id: number }>(ctx.db, 'SELECT id FROM money_accounts WHERE active = 1 ORDER BY is_default DESC, id LIMIT 1');
  if (!row) throw new PetraError('NOT_FOUND', 'no money account configured', { what: 'account' });
  return row.id;
}

export function resolveAccount(ctx: Ctx, accountId: number | null | undefined): number {
  if (accountId === null || accountId === undefined) return defaultAccountId(ctx);
  const acc = get<{ id: number; active: number }>(ctx.db, 'SELECT id, active FROM money_accounts WHERE id = ?', accountId);
  if (!acc) throw new PetraError('NOT_FOUND', 'money account not found', { what: 'account', id: accountId });
  if (!acc.active) throw new PetraError('INVALID_INPUT', 'money account is inactive', { field: 'account' });
  return accountId;
}
