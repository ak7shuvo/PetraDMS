import fs from 'node:fs';
import path from 'node:path';
import {
  IMPORT_FIELDS, IMPORT_LIMITS, PetraError, autoMap, checkRow, mappingProblems, parseCsv, templateRows, writeCsv, inertText,
  type CustomerRow, type DueRow, type ImportKind, type ImportPreview, type ImportResult, type ImportRowReport, type Mapping, type ProductRow, type RowIssue
} from '@petra/core';
import { all, get, scalar } from '../sql';
import { type Ctx, tx } from '../ctx';
import { audit } from '../audit';
import { createArea, createBrand, createCategory, createCustomer, createProduct } from '../masters';
import { postLedger } from '../ledger';
import { postStockAdjustment } from '../adjustments';
import type { Host } from './dispatcher';

interface Parsed {
  headers: string[];
  delimiter: string;
  mapping: Mapping;
  mappingIssues: { field: string; code: string }[];
  /** Data rows with their line numbers (the header is line 1). */
  rows: { line: number; cells: string[] }[];
}

function parseInput(kind: ImportKind, text: string, given: Mapping | undefined): Parsed {
  const csv = parseCsv(text);
  const [headers, ...data] = csv.rows;
  if (!headers) throw new PetraError('IMPORT_INVALID', 'the file is empty', { reason: 'empty' });
  if (data.length > IMPORT_LIMITS.maxRows) throw new PetraError('IMPORT_INVALID', 'too many rows', { reason: 'tooMany', max: IMPORT_LIMITS.maxRows });
  const mapping: Mapping = {};
  const auto = autoMap(kind, headers);
  for (const f of IMPORT_FIELDS[kind]) mapping[f.key] = given ? (given[f.key] ?? null) : (auto[f.key] ?? null);
  return {
    headers, delimiter: csv.delimiter, mapping, mappingIssues: mappingProblems(kind, mapping, headers.length),
    rows: data.map((cells, i) => ({ line: i + 2, cells }))
  };
}

const key = (s: string): string => s.trim().toLowerCase();

interface PartyIndex { byPhone: Map<string, number[]>; byName: Map<string, number[]> }

function partyIndex(ctx: Ctx, table: 'customers' | 'suppliers'): PartyIndex {
  const idx: PartyIndex = { byPhone: new Map(), byName: new Map() };
  const push = (m: Map<string, number[]>, k: string, id: number) => m.set(k, [...(m.get(k) ?? []), id]);
  for (const r of all<{ id: number; name: string; phone: string }>(ctx.db, `SELECT id, name, phone FROM ${table} WHERE status = 'active'`)) {
    if (r.phone) push(idx.byPhone, r.phone, r.id);
    push(idx.byName, key(r.name), r.id);
  }
  return idx;
}

function resolveParty(idx: PartyIndex, name: string, phone: string): { id: number } | { issue: string } {
  if (phone) {
    const ids = idx.byPhone.get(phone) ?? [];
    if (ids.length === 1) return { id: ids[0] as number };
    if (ids.length > 1) return { issue: 'partyAmbiguous' };
  }
  if (name) {
    const ids = idx.byName.get(key(name)) ?? [];
    if (ids.length === 1) return { id: ids[0] as number };
    if (ids.length > 1) return { issue: 'partyAmbiguous' };
  }
  return { issue: 'partyNotFound' };
}

/** Reads every row, applies the field rules and then the checks that need the database: duplicates (in the file and in the shop) and unknown parties. */
function evaluate(ctx: Ctx, kind: ImportKind, p: Parsed): { reports: ImportRowReport[]; parsed: Map<number, unknown> } {
  const reports: ImportRowReport[] = [];
  const parsed = new Map<number, unknown>();
  const skus = kind === 'products' ? new Set(all<{ sku: string }>(ctx.db, 'SELECT sku FROM products').map((r) => key(r.sku))) : new Set<string>();
  const codes = kind === 'products' ? new Set(all<{ barcode: string }>(ctx.db, 'SELECT barcode FROM product_barcodes').map((r) => r.barcode)) : new Set<string>();
  const phones = kind === 'customers' ? new Set(all<{ phone: string }>(ctx.db, "SELECT phone FROM customers WHERE phone <> ''").map((r) => r.phone)) : new Set<string>();
  const cust = kind === 'dues' ? partyIndex(ctx, 'customers') : null;
  const supp = kind === 'dues' ? partyIndex(ctx, 'suppliers') : null;
  const seenSku = new Set<string>();
  const seenCode = new Set<string>();
  const seenPhone = new Set<string>();
  const seenParty = new Set<string>();
  for (const r of p.rows) {
    const { value, issues } = checkRow(kind, r.cells, p.mapping);
    const extra: RowIssue[] = [...issues];
    if (value) {
      if (kind === 'products') {
        const v = value as ProductRow;
        const k = key(v.sku);
        if (skus.has(k)) extra.push({ field: 'sku', code: 'skuExists' });
        else if (seenSku.has(k)) extra.push({ field: 'sku', code: 'dupInFile' });
        if (v.barcode) {
          if (codes.has(v.barcode)) extra.push({ field: 'barcode', code: 'barcodeExists' });
          else if (seenCode.has(v.barcode)) extra.push({ field: 'barcode', code: 'dupInFile' });
        }
        seenSku.add(k);
        if (v.barcode) seenCode.add(v.barcode);
      } else if (kind === 'customers') {
        const v = value as CustomerRow;
        if (v.phone) {
          if (phones.has(v.phone)) extra.push({ field: 'phone', code: 'phoneExists' });
          else if (seenPhone.has(v.phone)) extra.push({ field: 'phone', code: 'dupInFile' });
          seenPhone.add(v.phone);
        }
      } else {
        const v = value as DueRow;
        const res = resolveParty(v.party === 'customer' ? (cust as PartyIndex) : (supp as PartyIndex), v.name, v.phone);
        if ('issue' in res) extra.push({ field: 'name', code: res.issue });
        else {
          const pk = `${v.party}:${res.id}`;
          if (seenParty.has(pk)) extra.push({ field: 'name', code: 'dupInFile' });
          seenParty.add(pk);
          if (extra.length === 0) parsed.set(r.line, { ...v, id: res.id });
        }
      }
    }
    if (extra.length === 0 && value && !parsed.has(r.line)) parsed.set(r.line, value);
    reports.push({ line: r.line, ok: extra.length === 0, cells: r.cells, issues: extra });
  }
  return { reports, parsed };
}

export function previewImport(ctx: Ctx, kind: ImportKind, text: string, given: Mapping | undefined): ImportPreview {
  const p = parseInput(kind, text, given);
  const base = { headers: p.headers, delimiter: p.delimiter, mapping: p.mapping, mappingIssues: p.mappingIssues };
  if (p.mappingIssues.length) return { ...base, total: p.rows.length, good: 0, bad: 0, rows: [], truncated: false };
  const { reports } = evaluate(ctx, kind, p);
  const bad = reports.filter((r) => !r.ok);
  const good = reports.filter((r) => r.ok);
  const rows = [...bad.slice(0, 500), ...good.slice(0, 20)];
  return { ...base, total: reports.length, good: good.length, bad: bad.length, rows, truncated: bad.length > 500 || good.length > 20 };
}

class DryRunDone extends Error {}

function lookupId(ctx: Ctx, table: 'categories' | 'brands', name: string, cache: Map<string, number>): number | null {
  if (!name) return null;
  const k = `${table}:${key(name)}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const found = get<{ id: number }>(ctx.db, `SELECT id FROM ${table} WHERE lower(name) = ?`, key(name));
  const id = found?.id ?? (table === 'categories' ? createCategory(ctx, name) : createBrand(ctx, name));
  cache.set(k, id);
  return id;
}

/**
 * Imports the good rows in one transaction, each row in its own savepoint so a conflict skips only that row. A dry run
 * does exactly the same work and then rolls everything back, so what it reports is what the real run would do.
 */
export function runImport(ctx: Ctx, today: string, i: { kind: ImportKind; text: string; mapping: Mapping; dryRun: boolean; skipBad: boolean }): ImportResult {
  const p = parseInput(i.kind, i.text, i.mapping);
  if (p.mappingIssues.length) throw new PetraError('IMPORT_INVALID', 'the columns are not matched', { reason: 'mapping' });
  const { reports, parsed } = evaluate(ctx, i.kind, p);
  const refused = reports.filter((r) => !r.ok);
  if (!i.skipBad && refused.length > 0) throw new PetraError('IMPORT_HAS_ERRORS', 'some rows have problems', { bad: refused.length });
  const failed: ImportRowReport[] = [...refused];
  const out: ImportResult = { dryRun: i.dryRun, created: 0, skipped: 0, failed, newCategories: 0, newBrands: 0, newAreas: 0, stockLines: 0, duesPosted: 0 };
  const count = (t: string) => scalar<number>(ctx.db, `SELECT COUNT(*) FROM ${t}`);
  try {
    tx(ctx, () => {
      const before = { c: count('categories'), b: count('brands'), a: count('areas') };
      let cache = new Map<string, number>();
      for (const r of reports) {
        if (!r.ok) continue;
        const v = parsed.get(r.line);
        try {
          tx(ctx, () => {
            if (i.kind === 'products') {
              const x = v as ProductRow;
              const id = createProduct(ctx, {
                sku: x.sku, name: x.name, nameBn: x.nameBn, categoryId: lookupId(ctx, 'categories', x.category, cache), brandId: lookupId(ctx, 'brands', x.brand, cache), baseUnit: x.unit,
                trackExpiry: x.trackExpiry, priceRetail: x.priceRetail, priceWholesale: x.priceWholesale ?? undefined, priceDealer: x.priceDealer ?? undefined,
                minPrice: x.minPrice, reorderLevel: x.reorderLevel, barcodes: x.barcode ? [x.barcode] : []
              });
              if (x.openingQty > 0) {
                postStockAdjustment(ctx, { productId: id, kind: 'opening', baseQty: x.openingQty, value: x.openingQty * (x.openingCost ?? 0), date: today, reason: 'Imported opening stock' });
                out.stockLines++;
              }
            } else if (i.kind === 'customers') {
              const x = v as CustomerRow;
              const areaId = x.area ? (cache.get(`areas:${key(x.area)}`) ?? createArea(ctx, x.area)) : null;
              if (areaId) cache.set(`areas:${key(x.area)}`, areaId);
              createCustomer(ctx, {
                name: x.name, nameBn: x.nameBn, phone: x.phone, address: x.address, areaId, type: x.type, creditLimit: x.creditLimit,
                openingBalance: x.openingDue || undefined, openingDate: x.openingDate ?? today
              });
              if (x.openingDue) out.duesPosted++;
            } else {
              const x = v as DueRow & { id: number };
              postLedger(ctx, { partyKind: x.party, partyId: x.id, kind: 'opening', amount: x.amount, date: x.date ?? today, note: 'Imported opening due' });
              out.duesPosted++;
            }
            out.created++;
          });
        } catch (e) {
          if (!(e instanceof PetraError)) throw e;
          cache = new Map();
          failed.push({ ...r, ok: false, issues: [{ field: e.code === 'DUPLICATE' ? (e.params.what === 'barcode' ? 'barcode' : 'sku') : null, code: `db.${e.code}` }] });
        }
      }
      out.newCategories = count('categories') - before.c;
      out.newBrands = count('brands') - before.b;
      out.newAreas = count('areas') - before.a;
      out.skipped = failed.length;
      failed.sort((a, b) => a.line - b.line);
      if (i.dryRun) throw new DryRunDone();
      audit(ctx, { action: `import.${i.kind}`, entity: 'import', after: { created: out.created, skipped: out.skipped, rows: reports.length } });
    });
  } catch (e) {
    if (!(e instanceof DryRunDone)) throw e;
  }
  return out;
}

/** The refused rows as a CSV the owner can fix and load again: the original columns plus one column saying what is wrong. */
export function rejectsFile(ctx: Ctx, host: Host, i: { kind: ImportKind; text: string; mapping?: Mapping; problemHeader: string; messages: Record<string, string> }): { path: string } {
  const p = parseInput(i.kind, i.text, i.mapping);
  const { reports } = evaluate(ctx, i.kind, p);
  const bad = reports.filter((r) => !r.ok);
  const width = p.headers.length;
  const rows = [[...p.headers, i.problemHeader], ...bad.map((r) => [
    ...Array.from({ length: width }, (_, c) => inertText(r.cells[c] ?? '')),
    r.issues.map((x) => `${x.field ? `${x.field}: ` : ''}${i.messages[x.code] ?? x.code}`).join('; ')
  ])];
  const file = path.join(host.dataDir, 'exports', `import-${i.kind}-rejected-${ctx.now().slice(0, 10)}.csv`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, writeCsv(rows));
  host.reveal(file);
  return { path: file };
}

export function templateFile(ctx: Ctx, host: Host, kind: ImportKind): { path: string } {
  const file = path.join(host.dataDir, 'exports', `import-template-${kind}.csv`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, writeCsv(templateRows(kind)));
  host.reveal(file);
  void ctx;
  return { path: file };
}
