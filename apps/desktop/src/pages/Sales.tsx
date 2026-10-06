import { useEffect, useMemo, useState } from 'react';
import type { SaleDetail, SaleItemDto, SaleListItem } from '@petra/core';
import { mulDiv } from '@petra/core';
import { call, errorText } from '../api';
import { useI18n } from '../i18n';
import { useApp } from '../store/app';
import { Badge, Button, Card, DateRange, Drawer, EmptyState, Field, Input, Modal, PrintActions, QtyInput, Select, Table, Tabs, Textarea, monthStart, toast, useDisplayDate, useQuery, type Range } from '../ui';
import { Pos } from './Pos';

type Tab = 'new' | 'invoices';

export function SalesPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('new');
  const [edit, setEdit] = useState<SaleDetail | null>(null);
  useEffect(() => {
    const open = () => { setEdit(null); setTab('new'); };
    window.addEventListener('petra:new-sale', open);
    return () => window.removeEventListener('petra:new-sale', open);
  }, []);
  return (
    <div>
      <div className="page-h"><h2>{t('nav.sales')}</h2></div>
      <Tabs value={tab} tabs={[{ value: 'new', label: t('sales.tabNew') }, { value: 'invoices', label: t('sales.tabInvoices') }]} onChange={(v) => { setTab(v); setEdit(null); }} label={t('nav.sales')} />
      <div style={{ marginTop: 12 }}>
        {tab === 'new' ? <Pos key={edit?.id ?? 'new'} edit={edit} onEditDone={() => { setEdit(null); setTab('invoices'); }} /> : <Invoices onEdit={(d) => { setEdit(d); setTab('new'); }} />}
      </div>
    </div>
  );
}

function Invoices({ onEdit }: { onEdit: (d: SaleDetail) => void }) {
  const { t, money, int } = useI18n();
  const status = useApp((s) => s.status)!;
  const role = status.session!.role;
  const today = status.businessDate;
  const date = useDisplayDate();
  const [range, setRange] = useState<Range>({ from: role === 'staff' ? today : monthStart(today), to: today });
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const list = useQuery('sale:list', { from: range.from, to: range.to, ...(q.trim() ? { search: q.trim() } : {}) });
  const rows = list.data ?? [];
  const live = rows.filter((r) => r.status === 'posted');
  const total = live.reduce((a, r) => a + r.total, 0);
  const due = live.reduce((a, r) => a + r.due, 0);
  const profit = role === 'staff' ? null : live.reduce((a, r) => a + (r.profit ?? 0), 0);
  return (
    <div>
      <div className="p-toolbar" style={{ marginBottom: 12 }}>
        {role !== 'staff' && <DateRange value={range} onChange={setRange} today={today} />}
        <Input placeholder={t('sales.searchHint')} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} aria-label={t('act.search')} data-testid="inv-search" />
        <span className="spacer" />
        <span>{t('word.total')}: <strong>{money(total)}</strong> · {t('word.due')}: <strong>{money(due)}</strong>{profit !== null && <> · {t('word.profit')}: <strong data-testid="inv-profit">{money(profit)}</strong></>} · {int(rows.length)} {t('word.rows')}</span>
      </div>
      {list.error && <div className="p-error" role="alert">{list.error}</div>}
      <Table
        rows={rows}
        rowKey={(r) => r.id}
        pageSize={50}
        onRowClick={(r) => setOpenId(r.id)}
        columns={[
          { key: 'doc', header: t('pur.docNo'), render: (r: SaleListItem) => <span>{r.docNo} {r.revision > 1 && <Badge>{t('sales.rev', { n: int(r.revision) })}</Badge>} {r.status === 'void' && <Badge tone="warn">{t('state.void')}</Badge>}</span>, sortValue: (r) => r.docNo },
          { key: 'date', header: t('word.date'), render: (r) => date(r.date), sortValue: (r) => r.date },
          { key: 'cust', header: t('nav.customers'), render: (r) => r.customerName || t('cust.walkIn'), sortValue: (r) => r.customerName },
          { key: 'total', header: t('word.total'), right: true, render: (r) => money(r.total, { fixed: true }), sortValue: (r) => r.total },
          { key: 'paid', header: t('word.paid'), right: true, render: (r) => money(r.paid, { fixed: true }) },
          { key: 'due', header: t('word.due'), right: true, render: (r) => (r.due > 0 ? <Badge tone="red">{money(r.due, { fixed: true })}</Badge> : money(0, { fixed: true })), sortValue: (r) => r.due },
          ...(role !== 'staff' ? [{ key: 'profit', header: t('word.profit'), right: true, render: (r: SaleListItem) => (r.profit === null ? '' : money(r.profit, { fixed: true })), sortValue: (r: SaleListItem) => r.profit ?? 0 }] : [])
        ]}
        empty={list.loading ? undefined : <EmptyState title={t('sales.emptyTitle')} body={t('sales.emptyBody')} />}
      />
      <SaleDrawer id={openId} onClose={() => setOpenId(null)} onChanged={list.reload} onEdit={(d) => { setOpenId(null); onEdit(d); }} />
    </div>
  );
}

function SaleDrawer({ id, onClose, onChanged, onEdit }: { id: number | null; onClose: () => void; onChanged: () => void; onEdit: (d: SaleDetail) => void }) {
  const i18n = useI18n();
  const { t, money, int } = i18n;
  const status = useApp((s) => s.status)!;
  const role = status.session!.role;
  const date = useDisplayDate();
  const q = useQuery('sale:get', { id: id ?? 1 }, id !== null);
  const d = id !== null ? q.data : null;
  const [voidOpen, setVoidOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const manager = role !== 'staff';
  const canChange = manager && d?.status === 'posted';
  const hasLiveReturns = (d?.returns ?? []).some((r) => r.status === 'posted');
  return (
    <Drawer open={id !== null} title={d ? `${d.docNo}${d.status === 'void' ? ` (${t('state.void')})` : ''}` : ''} onClose={onClose}
      footer={d ? (
        <>
          <PrintActions doc={{ type: 'invoice', id: d.id }} compact />
          <span className="spacer" />
          {canChange && <Button onClick={() => setReturnOpen(true)} data-testid="sale-return">{t('sales.return')}</Button>}
          {canChange && <Button onClick={() => onEdit(d)} disabled={hasLiveReturns || d.date !== status.businessDate} data-testid="sale-edit">{t('act.edit')}</Button>}
          {canChange && <Button variant="danger" onClick={() => setVoidOpen(true)} data-testid="sale-void">{t('sales.void')}</Button>}
        </>
      ) : undefined}>
      {d && (
        <div className="grid" style={{ gap: 12 }}>
          <div>{date(d.date)} · <strong>{d.customerName || t('cust.walkIn')}</strong> {d.areaName && <Badge>{d.areaName}</Badge>} <small className="muted">{d.userName}</small></div>
          {d.status === 'void' && <div className="p-error">{t('pur.voidReason')}: {d.voidReason}</div>}
          <table className="lines">
            <thead><tr><th>{t('word.name')}</th><th className="right">{t('word.qty')}</th><th className="right">{t('word.price')}</th><th className="right">{t('word.amount')}</th></tr></thead>
            <tbody>
              {d.items.map((it) => (
                <tr key={it.id}>
                  <td>{i18n.lang === 'bn' && it.productNameBn ? it.productNameBn : it.productName} {it.kind === 'bonus' && <Badge tone="ok">{t('pos.bonus')}</Badge>}<br /><small className="muted">{it.sku}{it.returnedBaseQty > 0 ? ` · ${t('sales.returned', { qty: int(it.returnedBaseQty) })}` : ''}</small></td>
                  <td className="right num">{int(it.qty)} {it.packName}</td>
                  <td className="right num">{it.kind === 'bonus' ? '-' : money(it.price, { fixed: true })}{it.discount > 0 && <small className="muted"><br />−{money(it.discount, { fixed: true })}</small>}</td>
                  <td className="right num">{money(it.amount, { fixed: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="totals" style={{ justifySelf: 'end' }}>
            <div className="row"><span>{t('word.subtotal')}</span><span className="num">{money(d.subtotal, { fixed: true })}</span></div>
            {d.discount > 0 && <div className="row"><span>{t('word.discount')}</span><span className="num">−{money(d.discount, { fixed: true })}</span></div>}
            {d.tax > 0 && <div className="row"><span>{t('word.tax')}</span><span className="num">{money(d.tax, { fixed: true })}</span></div>}
            <div className="row grand"><span>{t('word.total')}</span><span className="num" data-testid="detail-total">{money(d.total, { fixed: true })}</span></div>
            <div className="row"><span>{t('word.paid')}</span><span className="num">{money(d.paid, { fixed: true })}</span></div>
            <div className="row"><span>{t('word.due')}</span><span className="num">{money(d.due, { fixed: true })}</span></div>
            {d.previousDue !== null && d.currentDue !== null && (
              <>
                <div className="row muted"><span>{t('pay.prevDue')}</span><span className="num" data-testid="detail-prev">{money(d.previousDue, { fixed: true })}</span></div>
                <div className="row"><span>{t('pay.totalDue')}</span><span className="num" data-testid="detail-curr">{money(d.currentDue, { fixed: true })}</span></div>
              </>
            )}
            {d.profit !== null && <div className="row"><span>{t('word.profit')}</span><span className="num" data-testid="detail-profit">{money(d.profit, { fixed: true })}</span></div>}
          </div>
          {d.note && <div className="muted">{d.note}</div>}
          {d.returns.length > 0 && (
            <Card title={t('sales.returns')}>
              {d.returns.map((r) => (
                <div key={r.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span>{r.docNo} · {date(r.date)} {r.status === 'void' && <Badge tone="warn">{t('state.void')}</Badge>}</span>
                  <span className="row"><span className="num">{money(r.total, { fixed: true })}</span>{r.status === 'posted' && manager && <Button size="sm" onClick={() => void call('sale:returnVoid', { id: r.id, reason: t('pur.returnVoidReason') }).then(() => { q.reload(); onChanged(); }, (e: unknown) => setError(errorText(e)))}>{t('act.undo')}</Button>}</span>
                </div>
              ))}
            </Card>
          )}
          {error && <div className="p-error" role="alert">{error}</div>}
        </div>
      )}
      <Modal open={voidOpen} title={t('sales.void')} onClose={() => setVoidOpen(false)}
        footer={<><Button onClick={() => setVoidOpen(false)}>{t('act.cancel')}</Button><Button variant="danger" disabled={!reason.trim()} data-testid="void-confirm" onClick={() => void call('sale:void', { id: id!, reason }).then(() => { setVoidOpen(false); setReason(''); toast.ok(t('pur.voided')); q.reload(); onChanged(); }, (e: unknown) => { setVoidOpen(false); setError(errorText(e)); })}>{t('sales.void')}</Button></>}>
        <Field label={t('word.reason')} required>{(a) => <Textarea id={a.id} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="void-reason" data-autofocus />}</Field>
        <p className="muted">{t('sales.voidHelp')}</p>
      </Modal>
      {d && <SaleReturnModal open={returnOpen} detail={d} onClose={() => setReturnOpen(false)} onDone={() => { setReturnOpen(false); q.reload(); onChanged(); }} />}
    </Drawer>
  );
}

function SaleReturnModal({ open, detail, onClose, onDone }: { open: boolean; detail: SaleDetail; onClose: () => void; onDone: () => void }) {
  const i18n = useI18n();
  const { t, money, int } = i18n;
  const today = useApp((s) => s.status?.businessDate ?? '');
  const [qtys, setQtys] = useState<Record<number, number | null>>({});
  const [mode, setMode] = useState<'due' | 'cash'>(detail.customerId ? 'due' : 'cash');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const accounts = useQuery('money:accounts', undefined, open);
  const [accountId, setAccountId] = useState<number | null>(null);
  const lines = useMemo(() => detail.items.map((it: SaleItemDto) => {
    const left = it.baseQty - it.returnedBaseQty;
    const q = qtys[it.id] ?? 0;
    const net = q > 0 ? mulDiv(it.amount - it.allocDiscount, q, it.baseQty) : 0;
    return { it, left, q, net };
  }), [detail, qtys]);
  const active = lines.filter((l) => l.q > 0);
  const valid = active.length > 0 && active.every((l) => l.q <= l.left);
  const total = active.reduce((a, l) => a + l.net, 0);
  return (
    <Modal open={open} wide title={t('sales.return')} onClose={onClose}
      footer={<><Button onClick={onClose}>{t('act.cancel')}</Button><Button variant="primary" disabled={!valid} data-testid="return-save"
        onClick={() => void call('sale:return', { saleId: detail.id, date: today, items: active.map((l) => ({ saleItemId: l.it.id, baseQty: l.q })), refundMode: mode, accountId: mode === 'cash' ? accountId : null, reason }).then(() => { toast.ok(t('pur.returned')); onDone(); }, (e: unknown) => setError(errorText(e)))}>{t('sales.return')}</Button></>}>
      <div className="grid" style={{ gap: 12 }}>
        <p className="muted" style={{ margin: 0 }}>{t('sales.returnHelp')}</p>
        <table className="lines">
          <thead><tr><th>{t('word.name')}</th><th className="right">{t('sales.canReturn')}</th><th className="right" style={{ width: 120 }}>{t('pur.returnQty')}</th><th className="right">{t('pur.credit')}</th></tr></thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.it.id}>
                <td>{l.it.productName} {l.it.kind === 'bonus' && <Badge tone="ok">{t('pos.bonus')}</Badge>}</td>
                <td className="right num">{int(l.left)}</td>
                <td><QtyInput aria-label={t('pur.returnQty')} value={qtys[l.it.id] ?? null} onChange={(v) => setQtys((x) => ({ ...x, [l.it.id]: v }))} invalid={l.q > l.left} data-testid={`sret-qty-${l.it.lineNo}`} /></td>
                <td className="right num">{money(l.net, { fixed: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="form-grid">
          <Field label={t('pur.refund')}>
            {(a) => (
              <Select id={a.id} value={mode} onChange={(e) => setMode(e.target.value as 'due' | 'cash')} data-testid="sret-mode">
                {detail.customerId && <option value="due">{t('sales.refundDue')}</option>}
                <option value="cash">{t('pur.refundCash')}</option>
              </Select>
            )}
          </Field>
          {mode === 'cash' && (
            <Field label={t('pay.account')}>{(a) => <Select id={a.id} value={accountId ?? ''} onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : null)}><option value="">{t('pay.defaultAccount')}</option>{(accounts.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>}</Field>
          )}
        </div>
        <Field label={t('word.reason')}>{(a) => <Input id={a.id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}><strong>{t('pur.credit')}: {money(total, { fixed: true })}</strong></div>
        {error && <div className="p-error" role="alert">{error}</div>}
      </div>
    </Modal>
  );
}
