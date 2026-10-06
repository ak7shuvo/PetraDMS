import { useState, type ReactNode } from 'react';
import { Button } from './controls';
import { useI18n } from '../i18n';

export function Card({ title, actions, children, flat }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; flat?: boolean }) {
  return (
    <section className={`p-card${flat ? ' flat' : ''}`}>
      {(title || actions) && (
        <header className="p-card-h">
          <h3>{title}</h3>
          {actions}
        </header>
      )}
      <div className="p-card-b">{children}</div>
    </section>
  );
}

export function Badge({ tone = 'default', children }: { tone?: 'default' | 'red' | 'ok' | 'warn' | 'dark'; children: ReactNode }) {
  return <span className={`p-badge${tone === 'default' ? '' : ` ${tone}`}`}>{children}</span>;
}

export function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: boolean }) {
  return (
    <div className={`p-stat${accent ? ' accent' : ''}`}>
      <div className="p-stat-label">{label}</div>
      <div className="p-stat-value num">{value}</div>
      {sub && <div className="p-stat-sub">{sub}</div>}
    </div>
  );
}

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  right?: boolean;
  sortValue?: (row: T) => string | number;
  footer?: ReactNode;
}

export function Table<T>({ columns, rows, rowKey, onRowClick, empty, pageSize }: { columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string | number; onRowClick?: (r: T) => void; empty?: ReactNode; pageSize?: number }) {
  const { t, int } = useI18n();
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);
  let view = rows;
  const col = sort ? columns.find((c) => c.key === sort.key) : undefined;
  if (sort && col?.sortValue) {
    const sv = col.sortValue;
    view = [...rows].sort((a, b) => {
      const x = sv(a);
      const y = sv(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }
  const pages = pageSize ? Math.max(1, Math.ceil(view.length / pageSize)) : 1;
  const cur = Math.min(page, pages - 1);
  const shown = pageSize ? view.slice(cur * pageSize, cur * pageSize + pageSize) : view;
  const hasFooter = columns.some((c) => c.footer !== undefined);
  return (
    <div>
      <div className="p-tablewrap">
        <table className="p-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`${c.right ? 'right' : ''} ${c.sortValue ? 'sortable' : ''}`}
                  aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}
                  onClick={c.sortValue ? () => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 })) : undefined}
                >
                  {c.header}
                  {sort?.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={rowKey(r)} className={onRowClick ? 'clickable' : undefined} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                {columns.map((c) => (
                  <td key={c.key} className={c.right ? 'right num' : undefined}>{c.render(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
          {hasFooter && (
            <tfoot>
              <tr>
                {columns.map((c) => (
                  <td key={c.key} className={c.right ? 'right num' : undefined}>{c.footer}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {rows.length === 0 && (empty ?? <EmptyState title={t('empty.title')} body={t('state.noResults')} />)}
      {pageSize && rows.length > pageSize && (
        <div className="p-pager">
          <span>{t('word.showing', { from: int(cur * pageSize + 1), to: int(Math.min(rows.length, cur * pageSize + pageSize)), total: int(rows.length) })}</span>
          <span className="spacer" />
          <Button size="sm" disabled={cur === 0} onClick={() => setPage(cur - 1)}>{t('act.back')}</Button>
          <span>{t('word.page', { page: int(cur + 1), pages: int(pages) })}</span>
          <Button size="sm" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>{t('act.next')}</Button>
        </div>
      )}
    </div>
  );
}

export function Tabs<T extends string>({ value, tabs, onChange, label }: { value: T; tabs: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="p-tabs" role="tablist" aria-label={label}>
      {tabs.map((tb) => (
        <button key={tb.value} type="button" role="tab" aria-selected={tb.value === value} onClick={() => onChange(tb.value)}>
          {tb.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="p-empty">
      <svg className="idle" width="72" height="72" viewBox="0 0 72 72" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
        <path d="M10 26l26-14 26 14v26L36 66 10 52zM10 26l26 14 26-14M36 40v26" />
      </svg>
      <h3>{title}</h3>
      {body && <p style={{ margin: 0 }}>{body}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ width = '100%', height = '1em' }: { width?: string | number; height?: string | number }) {
  return <div className="p-skel" style={{ width, height }} aria-hidden="true" />;
}
export function Spinner({ label }: { label: string }) {
  return <div className="p-spinner" role="status" aria-label={label} />;
}
export function Progress({ value }: { value: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="p-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}>
      <div style={{ transform: `scaleX(${v})` }} />
    </div>
  );
}

export function Stamp({ kind, children }: { kind: 'paid' | 'due'; children: ReactNode }) {
  return <span className={`stamp ${kind}`}>{children}</span>;
}
export function CheckMark({ size = 48 }: { size?: number }) {
  return (
    <svg className="check-draw" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="3" strokeLinecap="square" aria-hidden="true">
      <path d="M4 12.5l5 5 11-12" />
    </svg>
  );
}
