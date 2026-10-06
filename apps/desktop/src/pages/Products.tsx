import { useMemo, useState } from 'react';
import type { LookupDto, ProductDto } from '@petra/core';
import { call, errorText } from '../api';
import { useI18n } from '../i18n';
import { useApp } from '../store/app';
import { Badge, Button, Checkbox, Drawer, EmptyState, Field, Input, Modal, MoneyInput, QtyInput, Select, Switch, Table, Textarea, productName, stockText, toast, useQuery, type Column } from '../ui';

export function ProductsPage() {
  const i18n = useI18n();
  const { t } = i18n;
  const role = useApp((s) => s.status?.session?.role ?? 'staff');
  const canEdit = role !== 'staff';
  const [showArchived, setShowArchived] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<number | 'all'>('all');
  const [editing, setEditing] = useState<ProductDto | 'new' | null>(null);
  const products = useQuery('catalog:products', { includeArchived: showArchived });
  const lookups = useQuery('catalog:lookups', undefined);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (products.data ?? []).filter((p) => (cat === 'all' || p.categoryId === cat) && (!s || p.name.toLowerCase().includes(s) || p.nameBn.includes(q.trim()) || p.sku.toLowerCase().includes(s) || p.barcodes.some((b) => b.includes(s))));
  }, [products.data, q, cat]);

  const cols: Column<ProductDto>[] = [
    { key: 'sku', header: t('prod.sku'), render: (p) => <span className="num" style={{ textAlign: 'left' }}>{p.sku}</span>, sortValue: (p) => p.sku },
    { key: 'name', header: t('word.name'), render: (p) => <span>{productName(i18n.lang, p)} {p.status === 'archived' && <Badge tone="warn">{t('state.archived')}</Badge>}</span>, sortValue: (p) => p.name.toLowerCase() },
    { key: 'cat', header: t('prod.category'), render: (p) => p.categoryName || '-', sortValue: (p) => p.categoryName },
    {
      key: 'stock', header: t('nav.stock'), right: true,
      render: (p) => <span>{stockText(i18n, p, p.stockQty)} {p.reorderLevel > 0 && p.stockQty <= p.reorderLevel && <Badge tone="red">{t('prod.low')}</Badge>}</span>,
      sortValue: (p) => p.stockQty
    },
    { key: 'retail', header: `${t('prod.retail')} / ${t('prod.perUnit')}`, right: true, render: (p) => i18n.money(p.priceRetail, { fixed: true }), sortValue: (p) => p.priceRetail },
    { key: 'wholesale', header: t('prod.wholesale'), right: true, render: (p) => i18n.money(p.priceWholesale, { fixed: true }), sortValue: (p) => p.priceWholesale },
    ...(canEdit ? [
      { key: 'cost', header: t('prod.avgCost'), right: true, render: (p: ProductDto) => (p.avgCost === null ? '' : i18n.money(p.avgCost, { fixed: true })), sortValue: (p: ProductDto) => p.avgCost ?? 0 },
      { key: 'value', header: t('prod.stockValue'), right: true, render: (p: ProductDto) => (p.stockValue === null ? '' : i18n.money(p.stockValue)), sortValue: (p: ProductDto) => p.stockValue ?? 0 }
    ] : [])
  ];

  return (
    <div>
      <div className="page-h">
        <h2>{t('nav.products')}</h2>
        {canEdit && <Button variant="primary" onClick={() => setEditing('new')} data-testid="add-product">{t('prod.add')}</Button>}
      </div>
      <div className="p-toolbar" style={{ marginBottom: 12 }}>
        <Input placeholder={t('prod.searchHint')} value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320 }} aria-label={t('act.search')} data-testid="product-search" />
        <Select value={String(cat)} onChange={(e) => setCat(e.target.value === 'all' ? 'all' : Number(e.target.value))} style={{ maxWidth: 220 }} aria-label={t('prod.category')}>
          <option value="all">{t('state.all')}</option>
          {(lookups.data?.categories ?? []).filter((c) => c.status === 'active').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Checkbox label={t('prod.showArchived')} checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        <span className="spacer" />
        <span className="muted">{i18n.int(rows.length)} {t('word.rows')}</span>
      </div>
      {products.error && <div className="p-error" role="alert">{products.error}</div>}
      <Table
        columns={cols}
        rows={rows}
        rowKey={(p) => p.id}
        pageSize={50}
        onRowClick={canEdit ? (p) => setEditing(p) : undefined}
        empty={products.loading ? undefined : <EmptyState title={t('prod.emptyTitle')} body={t('prod.emptyBody')} action={canEdit ? <Button variant="primary" onClick={() => setEditing('new')}>{t('prod.add')}</Button> : undefined} />}
      />
      <ProductEditor
        open={editing !== null}
        product={editing === 'new' ? null : editing}
        lookups={lookups.data ?? { categories: [], brands: [] }}
        onLookupsChanged={lookups.reload}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); products.reload(); }}
      />
    </div>
  );
}

interface PackRow {
  key: number;
  id?: number;
  name: string;
  nameBn: string;
  factor: number | null;
  priceRetail: number | null;
  priceWholesale: number | null;
  priceDealer: number | null;
}

function ProductEditor({ open, product, lookups, onLookupsChanged, onClose, onSaved }: { open: boolean; product: ProductDto | null; lookups: { categories: LookupDto[]; brands: LookupDto[] }; onLookupsChanged: () => void; onClose: () => void; onSaved: () => void }) {
  const i18n = useI18n();
  const { t } = i18n;
  const [f, setF] = useState(() => blank());
  const [packs, setPacks] = useState<PackRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState(false);
  const [addLookup, setAddLookup] = useState<'category' | 'brand' | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [lastKey, setLastKey] = useState<string>('');

  const key = open ? String(product?.id ?? 'new') : '';
  if (key !== lastKey) {
    setLastKey(key);
    if (open) {
      setF(product ? fromProduct(product) : blank());
      setPacks(product ? product.packs.filter((p) => p.factor > 1).map((p, i) => ({ key: i, id: p.id, name: p.name, nameBn: p.nameBn, factor: p.factor, priceRetail: p.priceRetail, priceWholesale: p.priceWholesale, priceDealer: p.priceDealer })) : []);
      setError(null);
      setFieldErr(false);
    }
  }

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const names = packs.map((p) => p.name.trim().toLowerCase());
  const packsOk = packs.every((p, i) => p.name.trim() !== '' && p.factor !== null && p.factor >= 2 && names.indexOf(p.name.trim().toLowerCase()) === i && p.name.trim().toLowerCase() !== f.baseUnit.trim().toLowerCase()) && new Set(packs.map((p) => p.factor)).size === packs.length;
  const valid = f.sku.trim() !== '' && f.name.trim() !== '' && f.baseUnit.trim() !== '' && f.priceRetail !== null && f.priceWholesale !== null && f.minPrice !== null && packsOk;

  const save = async () => {
    setFieldErr(true);
    if (!valid) return;
    try {
      await call('catalog:productSave', {
        ...(product ? { id: product.id } : {}),
        sku: f.sku, name: f.name, nameBn: f.nameBn, categoryId: f.categoryId, brandId: f.brandId, baseUnit: f.baseUnit.trim(), trackExpiry: f.trackExpiry,
        priceRetail: f.priceRetail!, priceWholesale: f.priceWholesale!, priceDealer: f.priceDealer ?? f.priceWholesale!, minPrice: f.minPrice!, reorderLevel: f.reorderLevel ?? 0,
        favourite: f.favourite, notes: f.notes,
        packs: packs.map((p) => ({ ...(p.id ? { id: p.id } : {}), name: p.name.trim(), nameBn: p.nameBn.trim(), factor: p.factor!, priceRetail: p.priceRetail, priceWholesale: p.priceWholesale, priceDealer: p.priceDealer })),
        barcodes: f.barcodes.split(/[\s,;]+/).map((b) => b.trim()).filter(Boolean)
      });
      toast.ok(t('toast.saved'));
      onSaved();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const lockExpiry = !!product?.hasHistory;
  return (
    <Drawer
      open={open}
      title={product ? productName(i18n.lang, product) : t('prod.add')}
      onClose={onClose}
      footer={
        <>
          {product && <Button variant={product.status === 'active' ? 'danger' : 'default'} onClick={() => setConfirmArchive(true)} data-testid="product-archive">{product.status === 'active' ? t('act.archive') : t('act.restore')}</Button>}
          <span className="spacer" />
          <Button onClick={onClose}>{t('act.cancel')}</Button>
          <Button variant="primary" kbd="Ctrl+S" onClick={() => void save()} disabled={fieldErr && !valid} data-testid="product-save">{t('act.save')}</Button>
        </>
      }
    >
      <div className="grid" style={{ gap: 12 }} onKeyDown={(e) => { if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); void save(); } }}>
        <div className="form-grid">
          <Field label={t('prod.sku')} required error={fieldErr && !f.sku.trim() ? t('field.required') : null}>{(a) => <Input id={a.id} aria-describedby={a.describedBy} invalid={a.invalid} value={f.sku} onChange={(e) => set('sku', e.target.value)} data-testid="product-sku" />}</Field>
          <Field label={t('prod.baseUnit')} hint={t('prod.baseUnitHint')} required>{(a) => <Input id={a.id} aria-describedby={a.describedBy} list="units" value={f.baseUnit} onChange={(e) => set('baseUnit', e.target.value)} data-testid="product-unit" />}</Field>
          <datalist id="units">{['pcs', 'kg', 'g', 'litre', 'ml', 'packet', 'bottle', 'sachet'].map((u) => <option key={u} value={u} />)}</datalist>
          <div className="wide"><Field label={t('prod.nameEn')} required error={fieldErr && !f.name.trim() ? t('field.required') : null}>{(a) => <Input id={a.id} aria-describedby={a.describedBy} invalid={a.invalid} value={f.name} onChange={(e) => set('name', e.target.value)} data-testid="product-name" />}</Field></div>
          <div className="wide"><Field label={t('prod.nameBn')}>{(a) => <Input id={a.id} value={f.nameBn} onChange={(e) => set('nameBn', e.target.value)} />}</Field></div>
          <Field label={t('prod.category')}>
            {(a) => (
              <div className="row">
                <Select id={a.id} value={f.categoryId ?? ''} onChange={(e) => set('categoryId', e.target.value ? Number(e.target.value) : null)}>
                  <option value="">-</option>
                  {lookups.categories.filter((c) => c.status === 'active' || c.id === f.categoryId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                <Button size="icon" aria-label={t('act.add')} onClick={() => setAddLookup('category')}>+</Button>
              </div>
            )}
          </Field>
          <Field label={t('prod.brand')}>
            {(a) => (
              <div className="row">
                <Select id={a.id} value={f.brandId ?? ''} onChange={(e) => set('brandId', e.target.value ? Number(e.target.value) : null)}>
                  <option value="">-</option>
                  {lookups.brands.filter((c) => c.status === 'active' || c.id === f.brandId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                <Button size="icon" aria-label={t('act.add')} onClick={() => setAddLookup('brand')}>+</Button>
              </div>
            )}
          </Field>
        </div>

        <strong>{t('prod.prices')} <small className="muted">({t('prod.perUnitOf', { unit: f.baseUnit || '' })})</small></strong>
        <div className="form-grid">
          <Field label={t('prod.retail')} required>{(a) => <MoneyInput id={a.id} value={f.priceRetail} onChange={(v) => set('priceRetail', v)} invalid={fieldErr && f.priceRetail === null} data-testid="product-retail" />}</Field>
          <Field label={t('prod.wholesale')} required>{(a) => <MoneyInput id={a.id} value={f.priceWholesale} onChange={(v) => set('priceWholesale', v)} invalid={fieldErr && f.priceWholesale === null} data-testid="product-wholesale" />}</Field>
          <Field label={t('prod.dealer')} hint={t('prod.dealerHint')}>{(a) => <MoneyInput id={a.id} value={f.priceDealer} onChange={(v) => set('priceDealer', v)} />}</Field>
          <Field label={t('prod.minPrice')} hint={t('prod.minPriceHint')}>{(a) => <MoneyInput id={a.id} aria-describedby={a.describedBy} value={f.minPrice} onChange={(v) => set('minPrice', v)} />}</Field>
        </div>

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>{t('prod.packs')}</strong>
          <Button size="sm" onClick={() => setPacks((p) => [...p, { key: Date.now(), name: '', nameBn: '', factor: null, priceRetail: null, priceWholesale: null, priceDealer: null }])} data-testid="add-pack">{t('prod.addPack')}</Button>
        </div>
        <div className="muted">{t('prod.packHelp', { unit: f.baseUnit || 'pcs' })}</div>
        {packs.length > 0 && (
          <table className="lines" data-testid="pack-table">
            <thead><tr><th>{t('prod.packName')}</th><th className="right">{t('prod.packFactor', { unit: f.baseUnit || 'pcs' })}</th><th className="right">{t('prod.packPrice')}</th><th /></tr></thead>
            <tbody>
              {packs.map((p, idx) => {
                const upd = (patch: Partial<PackRow>) => setPacks((all) => all.map((x, j) => (j === idx ? { ...x, ...patch } : x)));
                const auto = p.factor && f.priceRetail !== null ? p.factor * f.priceRetail : null;
                return (
                  <tr key={p.key}>
                    <td><Input aria-label={t('prod.packName')} value={p.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Carton" data-testid={`pack-name-${idx}`} /></td>
                    <td><QtyInput aria-label={t('prod.packFactor', { unit: f.baseUnit })} value={p.factor} onChange={(v) => upd({ factor: v })} data-testid={`pack-factor-${idx}`} /></td>
                    <td><MoneyInput aria-label={t('prod.packPrice')} value={p.priceRetail} onChange={(v) => upd({ priceRetail: v })} /><div className="p-hint">{auto !== null ? `${t('prod.auto')}: ${i18n.money(auto)}` : ''}</div></td>
                    <td><Button size="icon" variant="ghost" aria-label={t('act.delete')} onClick={() => setPacks((all) => all.filter((_, j) => j !== idx))}>×</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {fieldErr && !packsOk && <div className="p-error" role="alert">{t('prod.packInvalid')}</div>}

        <div className="form-grid">
          <Field label={t('prod.reorder')} hint={t('prod.reorderHint', { unit: f.baseUnit || 'pcs' })}>{(a) => <QtyInput id={a.id} aria-describedby={a.describedBy} value={f.reorderLevel} onChange={(v) => set('reorderLevel', v)} />}</Field>
          <Field label={t('prod.barcodes')} hint={t('prod.barcodesHint')}>{(a) => <Input id={a.id} aria-describedby={a.describedBy} value={f.barcodes} onChange={(e) => set('barcodes', e.target.value)} />}</Field>
        </div>
        <div>
          <Switch checked={f.trackExpiry} onChange={(v) => !lockExpiry && set('trackExpiry', v)} label={t('prod.trackExpiry')} />
          <div className="p-hint">{lockExpiry ? t('prod.trackExpiryLocked') : t('prod.trackExpiryHint')}</div>
        </div>
        <Switch checked={f.favourite} onChange={(v) => set('favourite', v)} label={t('prod.favourite')} />
        <Field label={t('word.note')}>{(a) => <Textarea id={a.id} rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} />}</Field>
        {product && (
          <div className="muted">{t('nav.stock')}: {stockText(i18n, product, product.stockQty)}{product.avgCost !== null ? ` · ${t('prod.avgCost')}: ${i18n.money(product.avgCost, { fixed: true })}/${product.baseUnit}` : ''}</div>
        )}
        {error && <div className="p-error shake" role="alert" data-testid="product-error">{error}</div>}
      </div>

      <LookupModal kind={addLookup} onClose={() => setAddLookup(null)} onSaved={(id) => { if (addLookup === 'category') set('categoryId', id); else set('brandId', id); setAddLookup(null); onLookupsChanged(); }} />
      <Modal
        open={confirmArchive}
        title={product?.status === 'active' ? t('act.archive') : t('act.restore')}
        onClose={() => setConfirmArchive(false)}
        footer={
          <>
            <Button onClick={() => setConfirmArchive(false)}>{t('act.cancel')}</Button>
            <Button
              variant="primary"
              data-autofocus
              onClick={() => void call('catalog:productArchive', { id: product!.id, archived: product!.status === 'active' }).then(() => { setConfirmArchive(false); onSaved(); }, (e: unknown) => { setConfirmArchive(false); setError(errorText(e)); })}
            >
              {product?.status === 'active' ? t('act.archive') : t('act.restore')}
            </Button>
          </>
        }
      >
        {t('prod.archiveBody')}
      </Modal>
    </Drawer>
  );
}

function LookupModal({ kind, onClose, onSaved }: { kind: 'category' | 'brand' | null; onClose: () => void; onSaved: (id: number) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [nameBn, setNameBn] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      open={kind !== null}
      title={kind === 'brand' ? t('prod.addBrand') : t('prod.addCategory')}
      onClose={() => { setName(''); setNameBn(''); setError(null); onClose(); }}
      footer={
        <>
          <Button onClick={onClose}>{t('act.cancel')}</Button>
          <Button
            variant="primary"
            disabled={!name.trim()}
            data-testid="lookup-save"
            onClick={() => void call('catalog:lookupSave', { kind: kind!, name, nameBn }).then((r) => { setName(''); setNameBn(''); setError(null); onSaved(r.id); }, (e: unknown) => setError(errorText(e)))}
          >
            {t('act.save')}
          </Button>
        </>
      }
    >
      <div className="grid" style={{ gap: 12 }}>
        <Field label={t('prod.nameEn')} required>{(a) => <Input id={a.id} value={name} onChange={(e) => setName(e.target.value)} data-autofocus data-testid="lookup-name" />}</Field>
        <Field label={t('prod.nameBn')}>{(a) => <Input id={a.id} value={nameBn} onChange={(e) => setNameBn(e.target.value)} />}</Field>
        {error && <div className="p-error" role="alert">{error}</div>}
      </div>
    </Modal>
  );
}

function blank() {
  return { sku: '', name: '', nameBn: '', categoryId: null as number | null, brandId: null as number | null, baseUnit: 'pcs', trackExpiry: false, priceRetail: null as number | null, priceWholesale: null as number | null, priceDealer: null as number | null, minPrice: 0 as number | null, reorderLevel: 0 as number | null, favourite: false, notes: '', barcodes: '' };
}

function fromProduct(p: ProductDto) {
  return { sku: p.sku, name: p.name, nameBn: p.nameBn, categoryId: p.categoryId, brandId: p.brandId, baseUnit: p.baseUnit, trackExpiry: p.trackExpiry, priceRetail: p.priceRetail as number | null, priceWholesale: p.priceWholesale as number | null, priceDealer: p.priceDealer as number | null, minPrice: p.minPrice as number | null, reorderLevel: p.reorderLevel as number | null, favourite: p.favourite, notes: p.notes, barcodes: p.barcodes.join(', ') };
}

