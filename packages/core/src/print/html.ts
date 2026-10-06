import { formatDate } from '../businessDate';
import { formatInt, formatMoney, toBnDigits } from '../money';
import { label, type LabelKey, type PrintLang } from './labels';
import type { PrintFormat } from '../ipc/sales';
import type { SaleDetail } from '../ipc/sales';

export interface PrintBusiness {
  name: string;
  nameBn: string;
  address: string;
  phone: string;
  taxNo: string;
  footerNote: string;
}

export interface PrintOpts {
  format: PrintFormat;
  lang: PrintLang;
  bilingual: boolean;
  bnDigits: boolean;
  grouping: 'lakh' | 'intl';
  /** @font-face rules with embedded fonts (so PDFs carry Bangla glyphs). */
  fontCss: string;
}

export const esc = (s: string | number | null | undefined): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface Fmt {
  money: (p: number) => string;
  int: (n: number) => string;
  date: (iso: string) => string;
  t: (k: LabelKey) => string;
  digits: (s: string) => string;
}

export function makeFmt(o: PrintOpts): Fmt {
  return {
    money: (p) => formatMoney(p, { grouping: o.grouping, bnDigits: o.bnDigits, symbol: true, fixedDecimals: false }),
    int: (n) => formatInt(n, { grouping: o.grouping, bnDigits: o.bnDigits }),
    date: (iso) => (o.bnDigits ? toBnDigits(formatDate(iso)) : formatDate(iso)),
    t: (k) => label(k, o.lang, o.bilingual),
    digits: (s) => (o.bnDigits ? toBnDigits(s) : s)
  };
}

const BASE_CSS = `
*{box-sizing:border-box}
body{margin:0;font-family:'JetBrains Mono','Noto Sans Bengali',ui-monospace,monospace;color:#121212;font-size:12px;line-height:1.4;font-variant-numeric:tabular-nums}
h1,h2,h3{margin:0}
table{border-collapse:collapse;width:100%}
.r{text-align:right}.c{text-align:center}
.muted{color:#555}
.stamp{display:inline-block;border:3px solid #C8202F;color:#C8202F;font-weight:700;letter-spacing:.12em;padding:2px 12px;transform:rotate(-6deg);text-transform:uppercase}
.stamp.paid{border-color:#2E6B43;color:#2E6B43}
.stamp.void{border-color:#555;color:#555}
`;

const A4_CSS = `
@page{size:A4;margin:14mm}
body{font-size:12px}
.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #C8202F;padding-bottom:8px;margin-bottom:10px}
.biz h1{font-size:22px;color:#C8202F}
.doc{text-align:right}.doc h2{font-size:18px;text-transform:uppercase;letter-spacing:.06em}
.meta{display:flex;justify-content:space-between;gap:16px;margin:8px 0 12px}
.meta div{flex:1}
.items th{background:#121212;color:#fff;padding:5px 6px;text-align:left;font-weight:600}
.items th.r{text-align:right}
.items td{padding:5px 6px;border-bottom:1px solid #ddd;vertical-align:top}
.totals{margin-left:auto;width:55%;margin-top:10px}
.totals td{padding:3px 6px}
.totals tr.grand td{font-size:14px;font-weight:700;border-top:2px solid #121212}
.foot{margin-top:18px;border-top:1px solid #aaa;padding-top:6px;display:flex;justify-content:space-between;align-items:flex-end}
`;

const thermalCss = (w: number, fs: number): string => `
@page{size:${w}mm auto;margin:2mm}
body{width:${w - 6}mm;font-size:${fs}px}
.head{text-align:center;border-bottom:1px dashed #000;padding-bottom:4px;margin-bottom:4px}
.biz h1{font-size:${fs + 4}px}
.doc h2{font-size:${fs + 1}px;margin-top:2px;text-transform:uppercase}
.meta div{margin:1px 0}
.items td{padding:1px 0;vertical-align:top}
.items tr.line td{border-top:1px dotted #999;padding-top:3px}
.totals{width:100%;margin-top:4px;border-top:1px dashed #000}
.totals td{padding:1px 0}
.totals tr.grand td{font-weight:700;font-size:${fs + 2}px}
.foot{text-align:center;margin-top:6px;border-top:1px dashed #000;padding-top:4px}
.stamp{font-size:${fs + 2}px;padding:0 6px;border-width:2px}
`;

export function wrapDoc(title: string, body: string, o: PrintOpts): string {
  const css = o.format === 'a4' ? A4_CSS : o.format === 'thermal80' ? thermalCss(80, 11) : thermalCss(58, 10);
  return `<!doctype html><html lang="${o.lang}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${o.fontCss}${BASE_CSS}${css}</style></head><body>${body}</body></html>`;
}

export function businessHeader(b: PrintBusiness, o: PrintOpts, docTitle: string, docNo: string, extra = ''): string {
  const name = o.lang === 'bn' && b.nameBn ? b.nameBn : b.name;
  const sub = o.bilingual && b.nameBn && b.name ? `<div class="muted">${esc(o.lang === 'bn' ? b.name : b.nameBn)}</div>` : '';
  const f = makeFmt(o);
  return `<div class="head"><div class="biz"><h1>${esc(name)}</h1>${sub}<div>${esc(b.address)}</div><div>${b.phone ? esc(f.digits(b.phone)) : ''}${b.taxNo ? ` · ${esc(f.t('vatNo'))}: ${esc(b.taxNo)}` : ''}</div></div><div class="doc"><h2>${esc(docTitle)}</h2><div>${esc(docNo)}</div>${extra}</div></div>`;
}

export function stampFor(status: 'posted' | 'void', due: number, f: Fmt): string {
  if (status === 'void') return `<span class="stamp void">${esc(f.t('stampVoid'))}</span>`;
  return due > 0 ? `<span class="stamp">${esc(f.t('stampDue'))}</span>` : `<span class="stamp paid">${esc(f.t('stampPaid'))}</span>`;
}

function disc(it: SaleDetail['items'][number], f: Fmt): string {
  if (it.kind === 'bonus') return '';
  if (it.discount <= 0) return '';
  return it.discKind === 'pct' ? f.digits(`${(it.discValue / 100).toFixed(it.discValue % 100 === 0 ? 0 : 2)}%`) : f.money(it.discount);
}

export function renderInvoice(sale: SaleDetail, b: PrintBusiness, o: PrintOpts): string {
  const f = makeFmt(o);
  const thermal = o.format !== 'a4';
  const iname = (it: SaleDetail['items'][number]) => (o.lang === 'bn' && it.productNameBn ? it.productNameBn : it.productName) + (it.kind === 'bonus' ? ` (${f.t('bonus')})` : '');
  const qtyText = (it: SaleDetail['items'][number]) => `${f.int(it.qty)} ${it.packName}`;
  const customer = sale.customerId ? `${esc(sale.customerName)}${sale.customerPhone ? ` · ${esc(f.digits(sale.customerPhone))}` : ''}` : esc(f.t('walkIn'));
  const rev = sale.revision > 1 ? `<div class="muted">${esc(f.t('revision'))} ${esc(f.int(sale.revision))}</div>` : '';
  const head = businessHeader(b, o, f.t('invoice'), sale.docNo, rev);
  const meta = `<div class="meta"><div><strong>${esc(f.t('customer'))}:</strong> ${customer}${sale.customerAddress ? `<br>${esc(sale.customerAddress)}` : ''}${sale.areaName ? `<br>${esc(f.t('area'))}: ${esc(sale.areaName)}` : ''}</div><div class="${thermal ? '' : 'r'}"><strong>${esc(f.t('date'))}:</strong> ${esc(f.date(sale.date))}</div></div>`;
  const rows = thermal
    ? sale.items.map((it) => `<tr class="line"><td colspan="2">${esc(iname(it))}</td></tr><tr><td>${esc(qtyText(it))} × ${it.kind === 'bonus' ? '0' : esc(f.money(it.price))}${disc(it, f) ? ` −${esc(disc(it, f))}` : ''}</td><td class="r">${esc(f.money(it.amount))}</td></tr>`).join('')
    : sale.items.map((it) => `<tr><td>${esc(iname(it))}</td><td class="r">${esc(qtyText(it))}</td><td class="r">${it.kind === 'bonus' ? esc(f.money(0)) : esc(f.money(it.price))}</td><td class="r">${esc(disc(it, f))}</td><td class="r">${esc(f.money(it.amount))}</td></tr>`).join('');
  const table = thermal
    ? `<table class="items"><tbody>${rows}</tbody></table>`
    : `<table class="items"><thead><tr><th>${esc(f.t('item'))}</th><th class="r">${esc(f.t('qty'))}</th><th class="r">${esc(f.t('price'))}</th><th class="r">${esc(f.t('disc'))}</th><th class="r">${esc(f.t('amount'))}</th></tr></thead><tbody>${rows}</tbody></table>`;
  const tr = (k: LabelKey, v: string, cls = '') => `<tr class="${cls}"><td>${esc(f.t(k))}</td><td class="r">${esc(v)}</td></tr>`;
  const totals = [
    tr('subtotal', f.money(sale.subtotal)),
    sale.discount > 0 ? tr('discount', `−${f.money(sale.discount)}`) : '',
    sale.tax > 0 ? tr('tax', f.money(sale.tax)) : '',
    sale.roundOff !== 0 ? tr('roundOff', f.money(sale.roundOff)) : '',
    tr('total', f.money(sale.total), 'grand'),
    tr('paid', f.money(sale.paid)),
    sale.due > 0 ? tr('due', f.money(sale.due)) : ''
  ].join('');
  const khata = sale.customerId && sale.previousDue !== null && sale.currentDue !== null
    ? `<table class="totals"><tbody>${tr('previousDue', f.money(sale.previousDue))}${tr('thisInvoice', f.money(sale.total))}${tr('paid', f.money(sale.paid))}${tr('totalDue', f.money(sale.currentDue), 'grand')}</tbody></table>` : '';
  const note = sale.note ? `<p><strong>${esc(f.t('note'))}:</strong> ${esc(sale.note)}</p>` : '';
  const foot = `<div class="foot"><div>${esc(b.footerNote || f.t('thanks'))}</div><div>${stampFor(sale.status, sale.due, f)}</div></div>`;
  return wrapDoc(`${sale.docNo}`, `${head}${meta}${table}<table class="totals"><tbody>${totals}</tbody></table>${khata}${note}${foot}`, o);
}

export interface PaymentReceiptData {
  docNo: string;
  date: string;
  direction: 'received' | 'given';
  partyName: string;
  partyKind: 'customer' | 'supplier' | 'employee';
  amount: number;
  accountName: string;
  reference: string;
  note: string;
  status: 'posted' | 'void';
  balanceAfter: number | null;
}

export function renderPaymentReceipt(p: PaymentReceiptData, b: PrintBusiness, o: PrintOpts): string {
  const f = makeFmt(o);
  const title = p.direction === 'received' ? f.t('receipt') : f.t('paymentVoucher');
  const rows = [
    [p.direction === 'received' ? f.t('receivedFrom') : f.t('paidTo'), esc(p.partyName)],
    [f.t('date'), esc(f.date(p.date))],
    [f.t('account'), esc(p.accountName)],
    p.reference ? [f.t('reference'), esc(p.reference)] : null,
    p.balanceAfter !== null ? [f.t('balanceAfter'), esc(f.money(p.balanceAfter))] : null,
    p.note ? [f.t('note'), esc(p.note)] : null
  ].filter((r): r is string[] => r !== null).map((r) => `<tr><td>${r[0]}</td><td class="r">${r[1]}</td></tr>`).join('');
  const body = `${businessHeader(b, o, title, p.docNo)}<table class="totals" style="margin-top:14px"><tbody>${rows}<tr class="grand"><td>${esc(f.t('amount'))}</td><td class="r">${esc(f.money(p.amount))}</td></tr></tbody></table><div class="foot"><div>${esc(b.footerNote || f.t('thanks'))}</div><div>${p.status === 'void' ? `<span class="stamp void">${esc(f.t('stampVoid'))}</span>` : `<span class="stamp paid">${esc(f.t('stampPaid'))}</span>`}</div></div>`;
  return wrapDoc(p.docNo, body, o);
}

export interface TableDoc {
  title: string;
  subtitle?: string;
  /** Summary lines shown above the table, e.g. [["Customer","Rahim"]]. */
  summary?: [string, string][];
  columns: { header: string; align?: 'l' | 'r' }[];
  rows: string[][];
  /** Rows shown bold under the table (totals). */
  totals?: string[][];
}

/** Generic table document used by statements and every report. All cell text is escaped here. */
export function renderTableDoc(doc: TableDoc, b: PrintBusiness, o: PrintOpts): string {
  const f = makeFmt(o);
  const th = doc.columns.map((c) => `<th class="${c.align === 'r' ? 'r' : ''}">${esc(c.header)}</th>`).join('');
  const cell = (c: { align?: 'l' | 'r' }, v: string) => `<td class="${c.align === 'r' ? 'r' : ''}">${esc(v)}</td>`;
  const body = doc.rows.map((r) => `<tr>${r.map((v, i) => cell(doc.columns[i] ?? {}, v)).join('')}</tr>`).join('');
  const tot = (doc.totals ?? []).map((r) => `<tr style="font-weight:700;border-top:2px solid #121212">${r.map((v, i) => cell(doc.columns[i] ?? {}, v)).join('')}</tr>`).join('');
  const summary = (doc.summary ?? []).map(([k, v]) => `<div><strong>${esc(k)}:</strong> ${esc(v)}</div>`).join('');
  const head = businessHeader(b, o, doc.title, doc.subtitle ?? '');
  return wrapDoc(doc.title, `${head}${summary ? `<div class="meta"><div>${summary}</div></div>` : ''}<table class="items"><thead><tr>${th}</tr></thead><tbody>${body}${tot}</tbody></table><div class="foot"><div class="muted">${esc(f.t('printed'))}: ${esc(f.date(new Date().toISOString().slice(0, 10)))}</div></div>`, o);
}
