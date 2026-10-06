import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { mulDiv, type ProductDto, type PurchaseDetail, type PurchaseListItem } from '@petra/core';
import { call, errorText } from '../api';
import { useI18n } from '../i18n';
import { useApp } from '../store/app';
import { Badge, Button, Card, DateInput, DateRange, Drawer, EmptyState, Field, Input, Modal, MoneyInput, ProductPicker, QtyInput, Select, Table, Textarea, monthStart, productName, stockText, toast, useDisplayDate, useQuery, type Range } from '../ui';

export function PurchasesPage() {
  const { t, money, int } = useI18n();
  const today = useApp((s) => s.status?.businessDate ?? '');
  const date = useDisplayDate();
  const [mode, setMode] = useState<'list' | 'new'>('list');
  const [range, setRange] = useState<Range>({ from: monthStart(today), to: today });
  const [q, setQ] = useState('');
  const [detailId, setDetailId] = useState<number | null>(null);
  const loc = useLocation();
  useEffect(() => {
    const st = loc.state as { open?: number } | null;
    if (typeof st?.open === 'number') { setMode('list'); setDetailId(st.open); }
  }, [loc.state, loc.key]);
  const list = useQuery('purchase:list', { from: range.from, to: range.to, ...(q.trim() ? { search: q.trim() } : {}) });
  const total = (list.data ?? []).filter((p) => p.status === 'posted').reduce((a, p) => a + p.total, 0);

  if (mode === 'new') return <NewPurchase onDone={() => { setMode('list'); list.reload(); }} onCancel={() => setMode('list')} />;
  return (
    <div>
      <div className="page-h">
        <h2>{t('nav.purchases')}</h2>
        <Button variant="primary" onClick={() => setMode('new')} data-testid="new-purchase">{t('pur.new')}</Button>
      </div>
      <div className="p-toolbar" style={{ marginBottom: 12 }}>
        <DateRange value={range} onChange={setRange} today={today} />
        <Input placeholder={t('pur.searchHint')} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} aria-label={t('act.search')} />
        <span className="spacer" />
        <span>{t('word.total')}: <strong>{money(total)}</strong> · {int(list.data?.length ?? 0)} {t('word.rows')}</span>
      </div>
      {list.error && <div className="p-error" role="alert">{list.error}</div>}
      <Table
        rows={list.data ?? []}
        rowKey={(p) => p.id}
        pageSize={50}
        onRowClick={(p) => setDetailId(p.id)}
        columns={[
          { key: 'doc', header: t('pur.docNo'), render: (p: PurchaseListItem) => <span>{p.docNo} {p.status === 'void' && <Badge tone="warn">{t('state.void')}</Badge>}</span>, sortValue: (p) => p.docNo },
          { key: 'date', header: t('word.date'), render: (p) => date(p.date), sortValue: (p) => p.date },
          { key: 'sup', header: t('nav.suppliers'), render: (p) => p.supplierName || t('pur.cash'), sortValue: (p) => p.supplierName },
          { key: 'ref', header: t('pur.supplierRef'), render: (p) => p.supplierRef },
          { key: 'total', header: t('word.total'), right: true, render: (p) => money(p.total, { fixed: true }), sortValue: (p) => p.total },
          { key: 'paid', header: t('word.paid'), right: true, render: (p) => money(p.paid, { fixed: true }) },
          { key: 'due', header: t('word.due'), right: true, render: (p) => (p.due > 0 ? <Badge tone="red">{money(p.due, { fixed: true })}</Badge> : money(0, { fixed: true })), sortValue: (p) => p.due }
        ]}
        empty={list.loading ? undefined : <EmptyState title={t('pur.emptyTitle')} body={t('pur.emptyBody')} action={<Button variant="primary" onClick={() => setMode('new')}>{t('pur.new')}</Button>} />}
      />
      <PurchaseDrawer id={detailId} onClose={() => setDetailId(null)} onChanged={list.reload} />
    </div>
  );
}

interface Line {
  key: number;
  product: ProductDto;
  packId: number;
  qty: number | null;
  unitCost: number | null;
  batchNo: string;
  expiry: string | null;
}

function NewPurchase({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const i18n = useI18n();
  const { t, money } = i18n;
  const today = useApp((s) => s.status?.businessDate ?? '');
  const products = useQuery('catalog:products', { includeArchived: false });
  const suppliers = useQuery('catalog:suppliers', { includeArchived: false });
  const accounts = useQuery('money:accounts', undefined);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [date, setDate] = useState<string | null>(today);
  const [ref, setRef] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState<number | null>(0);
  const [paid, setPaid] = useState<number | null>(0);
  const [paidTouched, setPaidTouched] = useState(false);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const amount = (l: Line) => (l.qty && l.unitCost !== null ? l.qty * l.unitCost : 0);
  const subtotal = lines.reduce((a, l) => a + amount(l), 0);
  const disc = discount ?? 0;
  const total = Math.max(0, subtotal - disc);
  // Without a supplier a purchase is paid in full; with a supplier the paid amount defaults to the total until edited.
  useEffect(() => {
    if (!paidTouched || supplierId === null) setPaid(total);
  }, [total, supplierId, paidTouched]);
  const paidVal = paid ?? 0;
  const due = total - paidVal;
  const linesOk = lines.length > 0 && lines.every((l) => l.qty !== null && l.qty > 0 && l.unitCost !== null && (!l.product.trackExpiry || l.expiry !== null));
  const valid = linesOk && date !== null && disc <= subtotal && paidVal <= total && (supplierId !== null || due === 0);

  const addLine = (p: ProductDto) => {
    const base = p.packs.find((k) => k.factor === 1) ?? p.packs[0]!;
    const cost = p.avgCost ?? p.lastCost;
    setLines((ls) => [...ls, { key: Date.now() + ls.length, product: p, packId: base.id, qty: 1, unitCost: cost !== null && cost > 0 ? cost * base.factor : 0, batchNo: '', expiry: null }]);
  };
  const upd = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await call('purchase:save', {
        supplierId, supplierRef: ref, date: date!, discount: disc, paid: paidVal, accountId: paidVal > 0 ? accountId : null, note,
        lines: lines.map((l) => ({ productId: l.product.id, packId: l.packId, qty: l.qty!, unitCost: l.unitCost!, batchNo: l.batchNo, expiry: l.expiry }))
      });
      toast.ok(`${t('pur.saved')} ${r.docNo}`);
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key.toLowerCase() === 's') || e.key === 'F9') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div>
      <div className="page-h">
        <h2>{t('pur.new')}</h2>
        <div className="row">
          <Button onClick={onCancel}>{t('act.cancel')}</Button>
          <Button variant="primary" kbd="F9" disabled={!valid || busy} onClick={() => void save()} data-testid="purchase-save">{t('act.save')}</Button>
        </div>
      </div>
      <Card>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          <Field label={t('nav.suppliers')}>
            {(a) => (
              <Select id={a.id} value={supplierId ?? ''} onChange={(e) => { setSupplierId(e.target.value ? Number(e.target.value) : null); setPaidTouched(false); }} data-testid="purchase-supplier">
                <option value="">{t('pur.cash')}</option>
                {(suppliers.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label={t('word.date')} required>{(a) => <DateInput id={a.id} value={date} onChange={setDate} />}</Field>
          <Field label={t('pur.supplierRef')}>{(a) => <Input id={a.id} value={ref} onChange={(e) => setRef(e.target.value)} />}</Field>
          <Field label={t('pur.addItem')}>{(a) => <ProductPicker id={a.id} products={products.data ?? []} onPick={addLine} placeholder={t('pur.pickHint')} autoFocus />}</Field>
        </div>
      </Card>
      <div style={{ marginTop: 12 }}>
        {lines.length === 0 ? (
          <EmptyState title={t('pur.noLines')} body={t('pur.noLinesBody')} />
        ) : (
          <table className="lines" data-testid="purchase-lines">
            <thead>
              <tr><th>{t('word.name')}</th><th style={{ width: 130 }}>{t('pur.pack')}</th><th className="right" style={{ width: 90 }}>{t('word.qty')}</th><th className="right" style={{ width: 130 }}>{t('pur.unitCost')}</th><th className="right" style={{ width: 130 }}>{t('word.amount')}</th><th style={{ width: 170 }}>{t('pur.batchExpiry')}</th><th style={{ width: 40 }} /></tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => {
                const pack = l.product.packs.find((k) => k.id === l.packId) ?? l.product.packs[0]!;
                return (
                  <tr key={l.key}>
                    <td><strong>{productName(i18n.lang, l.product)}</strong><br /><small className="muted">{l.product.sku} · {t('nav.stock')}: {stockText(i18n, l.product, l.product.stockQty)}</small></td>
                    <td>
                      <Select aria-label={t('pur.pack')} value={l.packId} onChange={(e) => {
                        const np = l.product.packs.find((k) => k.id === Number(e.target.value))!;
                        const perBase = l.product.avgCost ?? l.product.lastCost ?? 0;
                        upd(l.key, { packId: np.id, unitCost: perBase > 0 ? perBase * np.factor : l.unitCost });
                      }}>
                        {l.product.packs.map((k) => <option key={k.id} value={k.id}>{k.name}{k.factor > 1 ? ` (${i18n.n(k.factor)})` : ''}</option>)}
                      </Select>
                    </td>
                    <td><QtyInput aria-label={t('word.qty')} value={l.qty} onChange={(v) => upd(l.key, { qty: v })} data-testid={`line-qty-${idx}`} /></td>
                    <td><MoneyInput aria-label={t('pur.unitCost')} value={l.unitCost} onChange={(v) => upd(l.key, { unitCost: v })} data-testid={`line-cost-${idx}`} /></td>
                    <td className="right num">{money(amount(l), { fixed: true })}<div className="p-hint">{pack.factor > 1 && l.qty ? `${i18n.int(l.qty * pack.factor)} ${l.product.baseUnit}` : ''}</div></td>
                    <td>
                      {l.product.trackExpiry ? (
                        <div className="grid" style={{ gap: 4 }}>
                          <Input aria-label={t('pur.batchNo')} placeholder={t('pur.batchNo')} value={l.batchNo} onChange={(e) => upd(l.key, { batchNo: e.target.value })} />
                          <DateInput aria-describedby={undefined} value={l.expiry} onChange={(v) => upd(l.key, { expiry: v })} invalid={l.expiry === null} />
                        </div>
                      ) : <span className="muted">-</span>}
                    </td>
                    <td><Button size="icon" variant="ghost" aria-label={t('act.delete')} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>×</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="row" style={{ alignItems: 'flex-start', marginTop: 16, gap: 24 }}>
        <div className="grid" style={{ flex: 1, gap: 12 }}>
          <Field label={t('word.note')}>{(a) => <Textarea id={a.id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
          {error && <div className="p-error shake" role="alert" data-testid="purchase-error">{error}</div>}
        </div>
        <div className="totals">
          <div className="row"><span>{t('word.subtotal')}</span><span className="num">{money(subtotal, { fixed: true })}</span></div>
          <div className="row"><span>{t('word.discount')}</span><div style={{ width: 150 }}><MoneyInput aria-describedby={undefined} value={discount} onChange={setDiscount} invalid={disc > subtotal} /></div></div>
          <div className="row grand"><span>{t('word.total')}</span><span className="num" data-testid="purchase-total">{money(total, { fixed: true })}</span></div>
          <div className="row"><span>{t('word.paid')}</span><div style={{ width: 150 }}><MoneyInput aria-describedby={undefined} value={paid} onChange={(v) => { setPaid(v); setPaidTouched(true); }} invalid={paidVal > total} data-testid="purchase-paid" /></div></div>
          {paidVal > 0 && (
            <div className="row"><span>{t('pay.account')}</span>
              <div style={{ width: 150 }}><Select value={accountId ?? ''} onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : null)} aria-label={t('pay.account')}><option value="">{t('pay.defaultAccount')}</option>{(accounts.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></div>
            </div>
          )}
          <div className="row"><span>{t('word.due')}</span><span className="num" data-testid="purchase-due">{money(due, { fixed: true })}</span></div>
          {supplierId === null && due !== 0 && <div className="p-error">{t('pur.cashMustPay')}</div>}
        </div>
      </div>
    </div>
  );
}

function PurchaseDrawer({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged: () => void }) {
  const i18n = useI18n();
  const { t, money } = i18n;
  const role = useApp((s) => s.status?.session?.role);
  const date = useDisplayDate();
  const detail = useQuery('purchase:get', { id: id ?? 1 }, id !== null);
  const d: PurchaseDetail | null = id !== null ? detail.data : null;
  const [voidOpen, setVoidOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const canVoid = role === 'owner' || role === 'manager';
  return (
    <Drawer open={id !== null} title={d ? `${d.docNo}${d.status === 'void' ? ` (${t('state.void')})` : ''}` : ''} onClose={onClose}
      footer={d && d.status === 'posted' && canVoid ? (<><Button onClick={() => setReturnOpen(true)} data-testid="purchase-return">{t('pur.return')}</Button><span className="spacer" /><Button variant="danger" onClick={() => setVoidOpen(true)} data-testid="purchase-void">{t('pur.void')}</Button></>) : undefined}>
      {d && (
        <div className="grid" style={{ gap: 12 }}>
          <div className="grid" style={{ gap: 2 }}>
            <div>{date(d.date)} · {d.supplierName || t('pur.cash')} {d.supplierRef && <small className="muted">#{d.supplierRef}</small>}</div>
            {d.status === 'void' && <div className="p-error">{t('pur.voidReason')}: {d.voidReason}</div>}
          </div>
          <table className="lines">
            <thead><tr><th>{t('word.name')}</th><th className="right">{t('word.qty')}</th><th className="right">{t('pur.unitCost')}</th><th className="right">{t('word.amount')}</th></tr></thead>
            <tbody>
              {d.items.map((it) => (
                <tr key={it.lineNo}>
                  <td>{it.productName}<br /><small className="muted">{it.sku}{it.batchNo ? ` · ${it.batchNo}` : ''}{it.expiry ? ` · ${date(it.expiry)}` : ''}</small></td>
                  <td className="right num">{i18n.int(it.qty)} {it.packName}</td>
                  <td className="right num">{money(it.unitCost, { fixed: true })}</td>
                  <td className="right num">{money(it.amount, { fixed: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="totals" style={{ justifySelf: 'end' }}>
            <div className="row"><span>{t('word.subtotal')}</span><span className="num">{money(d.subtotal, { fixed: true })}</span></div>
            {d.discount > 0 && <div className="row"><span>{t('word.discount')}</span><span className="num">{money(d.discount, { fixed: true })}</span></div>}
            <div className="row grand"><span>{t('word.total')}</span><span className="num">{money(d.total, { fixed: true })}</span></div>
            <div className="row"><span>{t('word.paid')}</span><span className="num">{money(d.paid, { fixed: true })}</span></div>
            <div className="row"><span>{t('word.due')}</span><span className="num">{money(d.due, { fixed: true })}</span></div>
          </div>
          {d.note && <div className="muted">{d.note}</div>}
          {d.returns.length > 0 && (
            <Card title={t('pur.returns')}>
              {d.returns.map((r) => (
                <div key={r.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span>{r.docNo} · {date(r.date)} {r.status === 'void' && <Badge tone="warn">{t('state.void')}</Badge>}</span>
                  <span className="row"><span className="num">{money(r.credit, { fixed: true })}</span>{r.status === 'posted' && canVoid && <Button size="sm" onClick={() => void call('purchase:returnVoid', { id: r.id, reason: t('pur.returnVoidReason') }).then(() => { detail.reload(); onChanged(); }, (e: unknown) => setError(errorText(e)))}>{t('act.undo')}</Button>}</span>
                </div>
              ))}
            </Card>
          )}
          {error && <div className="p-error" role="alert">{error}</div>}
        </div>
      )}
      <Modal open={voidOpen} title={t('pur.void')} onClose={() => setVoidOpen(false)} footer={<><Button onClick={() => setVoidOpen(false)}>{t('act.cancel')}</Button><Button variant="danger" disabled={!reason.trim()} data-testid="void-confirm" onClick={() => void call('purchase:void', { id: id!, reason }).then(() => { setVoidOpen(false); setReason(''); toast.ok(t('pur.voided')); detail.reload(); onChanged(); }, (e: unknown) => { setVoidOpen(false); setError(errorText(e)); })}>{t('pur.void')}</Button></>}>
        <Field label={t('word.reason')} required>{(a) => <Textarea id={a.id} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="void-reason" data-autofocus />}</Field>
        <p className="muted">{t('pur.voidHelp')}</p>
      </Modal>
      {d && <ReturnModal open={returnOpen} detail={d} onClose={() => setReturnOpen(false)} onDone={() => { setReturnOpen(false); detail.reload(); onChanged(); }} />}
    </Drawer>
  );
}

function ReturnModal({ open, detail, onClose, onDone }: { open: boolean; detail: PurchaseDetail; onClose: () => void; onDone: () => void }) {
  const i18n = useI18n();
  const { t, money } = i18n;
  const today = useApp((s) => s.status?.businessDate ?? '');
  const [qtys, setQtys] = useState<Record<number, number | null>>({});
  const [credits, setCredits] = useState<Record<number, number | null>>({});
  const [mode, setMode] = useState<'due' | 'cash'>(detail.supplierId ? 'due' : 'cash');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const lines = useMemo(() => detail.items.map((it) => ({ it, q: qtys[it.lineNo] ?? 0, credit: credits[it.lineNo] ?? (qtys[it.lineNo] ? mulDiv(it.amount, qtys[it.lineNo]!, it.baseQty) : 0) })), [detail, qtys, credits]);
  const active = lines.filter((l) => l.q > 0);
  const totalCredit = active.reduce((a, l) => a + (l.credit ?? 0), 0);
  const valid = active.length > 0 && active.every((l) => l.q <= l.it.baseQty && l.credit !== null);
  return (
    <Modal
      open={open}
      wide
      title={t('pur.return')}
      onClose={onClose}
      footer={<><Button onClick={onClose}>{t('act.cancel')}</Button><Button variant="primary" disabled={!valid} data-testid="return-save" onClick={() => void call('purchase:return', { supplierId: detail.supplierId, purchaseId: detail.id, date: today, refundMode: mode, accountId: null, reason, lines: active.map((l) => ({ productId: l.it.productId, baseQty: l.q, credit: l.credit ?? 0, batchId: l.it.batchId })) }).then(() => { toast.ok(t('pur.returned')); onDone(); }, (e: unknown) => setError(errorText(e)))}>{t('pur.return')}</Button></>}
    >
      <div className="grid" style={{ gap: 12 }}>
        <p className="muted" style={{ margin: 0 }}>{t('pur.returnHelp')}</p>
        <table className="lines">
          <thead><tr><th>{t('word.name')}</th><th className="right">{t('pur.boughtQty')}</th><th className="right" style={{ width: 110 }}>{t('pur.returnQty')}</th><th className="right" style={{ width: 140 }}>{t('pur.credit')}</th></tr></thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.it.lineNo}>
                <td>{l.it.productName}</td>
                <td className="right num">{i18n.int(l.it.baseQty)}</td>
                <td><QtyInput aria-label={t('pur.returnQty')} value={qtys[l.it.lineNo] ?? null} onChange={(v) => { setQtys((x) => ({ ...x, [l.it.lineNo]: v })); setCredits((c) => ({ ...c, [l.it.lineNo]: undefined as unknown as number | null })); }} invalid={l.q > l.it.baseQty} data-testid={`return-qty-${l.it.lineNo}`} /></td>
                <td><MoneyInput aria-label={t('pur.credit')} value={l.credit} onChange={(v) => setCredits((c) => ({ ...c, [l.it.lineNo]: v }))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="form-grid">
          <Field label={t('pur.refund')}>
            {(a) => (
              <Select id={a.id} value={mode} onChange={(e) => setMode(e.target.value as 'due' | 'cash')}>
                {detail.supplierId && <option value="due">{t('pur.refundDue')}</option>}
                <option value="cash">{t('pur.refundCash')}</option>
              </Select>
            )}
          </Field>
          <div className="row" style={{ alignSelf: 'end', justifyContent: 'flex-end' }}><strong>{t('pur.credit')}: {money(totalCredit, { fixed: true })}</strong></div>
        </div>
        <Field label={t('word.reason')}>{(a) => <Input id={a.id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        {error && <div className="p-error" role="alert">{error}</div>}
      </div>
    </Modal>
  );
}
