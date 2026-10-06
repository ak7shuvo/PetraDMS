import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useApp } from '../store/app';
import { Badge, Button, Card, EmptyState, HBarList, LineChart, ReceivePaymentFlow, Stat, Table, useQuery } from '../ui';
import { ExpenseModal } from './money/ExpensesTab';

/** Owner and Manager home: today at a glance, this month, what is owed, what needs attention, and the six quick actions. */
export function DashboardPage() {
  const { t, money, int, lang } = useI18n();
  const navigate = useNavigate();
  const user = useApp((s) => s.status?.session?.displayName ?? '');
  const dash = useQuery('dash:get', undefined);
  const [pay, setPay] = useState(false);
  const [expense, setExpense] = useState(false);
  const d = dash.data;
  const go = (path: string, add = false) => () => navigate(path, add ? { state: { add: true } } : undefined);
  return (
    <div>
      <div className="page-h"><h2>{t('dash.hello', { name: user })}</h2></div>
      {dash.error && <div className="p-error" role="alert">{dash.error}</div>}
      <div className="row wrap" style={{ gap: 8, marginBottom: 16 }} data-testid="quick-actions">
        <Button variant="primary" onClick={go('/sales')} data-testid="qa-sale">{t('dash.qaSale')}</Button>
        <Button onClick={go('/purchases')} data-testid="qa-purchase">{t('dash.qaPurchase')}</Button>
        <Button onClick={() => setPay(true)} data-testid="qa-receive">{t('dash.qaReceive')}</Button>
        <Button onClick={() => setExpense(true)} data-testid="qa-expense">{t('dash.qaExpense')}</Button>
        <Button onClick={go('/products', true)} data-testid="qa-product">{t('dash.qaProduct')}</Button>
        <Button onClick={go('/customers', true)} data-testid="qa-customer">{t('dash.qaCustomer')}</Button>
      </div>
      {d && (
        <div className="grid" style={{ gap: 16 }}>
          {(d.unclosedDays > 0 || d.lowStock > 0 || d.expiring > 0 || d.expired > 0) && (
            <div className="row wrap" style={{ gap: 8 }} data-testid="dash-alerts">
              {d.unclosedDays > 0 && <Button size="sm" onClick={go('/expenses')}><Badge tone="warn">{int(d.unclosedDays)}</Badge> {t('dash.alertUnclosed')}</Button>}
              {d.lowStock > 0 && <Button size="sm" onClick={go('/inventory')}><Badge tone="red">{int(d.lowStock)}</Badge> {t('dash.alertLow')}</Button>}
              {d.expired > 0 && <Button size="sm" onClick={go('/inventory')}><Badge tone="red">{int(d.expired)}</Badge> {t('dash.alertExpired')}</Button>}
              {d.expiring > 0 && <Button size="sm" onClick={go('/inventory')}><Badge tone="warn">{int(d.expiring)}</Badge> {t('dash.alertExpiring')}</Button>}
            </div>
          )}
          <section aria-label={t('dash.today')}>
            <h3 style={{ margin: '0 0 8px' }}>{t('dash.today')}</h3>
            <div className="grid cols-4">
              <Stat label={t('dash.sales')} value={<span data-testid="dash-today-sales">{money(d.today.sales)}</span>} sub={`${int(d.today.invoices)} ${t('dash.invoices')}`} accent />
              <Stat label={t('dash.collected')} value={money(d.today.collected)} />
              <Stat label={t('dash.dueGiven')} value={money(d.today.due)} />
              <Stat label={t('dash.grossProfit')} value={<span data-testid="dash-today-profit">{money(d.today.profit)}</span>} />
            </div>
          </section>
          <section aria-label={t('dash.month')}>
            <h3 style={{ margin: '0 0 8px' }}>{t('dash.month')}</h3>
            <div className="grid cols-4">
              <Stat label={t('dash.sales')} value={money(d.month.sales)} />
              <Stat label={t('dash.grossProfit')} value={money(d.month.profit)} />
              <Stat label={t('dash.costs')} value={money(d.month.expenses + d.month.salary + d.month.stockLoss)} sub={`${t('dash.expenses')} ${money(d.month.expenses)} · ${t('dash.salary')} ${money(d.month.salary)}`} />
              <Stat label={t('dash.netProfit')} value={<span data-testid="dash-month-net">{money(d.month.netProfit)}</span>} accent={d.month.netProfit > 0} />
            </div>
          </section>
          <section aria-label={t('dash.position')}>
            <h3 style={{ margin: '0 0 8px' }}>{t('dash.position')}</h3>
            <div className="grid cols-4">
              <Stat label={t('dash.cash')} value={<span data-testid="dash-cash">{money(d.cash)}</span>} sub={`${t('dash.allAccounts')} ${money(d.accountsTotal)}`} />
              <Stat label={t('dash.receivable')} value={money(d.receivables)} />
              <Stat label={t('dash.payable')} value={money(d.payables)} />
              <Stat label={t('dash.stockValue')} value={money(d.stockValue)} />
            </div>
          </section>
          <div className="grid cols-2">
            <Card title={t('dash.trend')}>
              <LineChart title={t('dash.trend')} data={d.trend.map((x) => ({ label: x.date.slice(8), value: x.sales }))} fmt={(n) => money(Math.round(n), { symbol: false })} />
            </Card>
            <Card title={t('dash.topProducts')}>
              {d.topProducts.length === 0 ? <EmptyState title={t('dash.noSalesTitle')} body={t('dash.noSalesBody')} /> : <HBarList data={d.topProducts.map((p) => ({ label: lang === 'bn' && p.nameBn ? p.nameBn : p.name, value: p.net }))} fmt={(n) => money(n)} />}
            </Card>
          </div>
          <div className="grid cols-2">
            <Card title={t('dash.recent')}>
              <Table
                rows={d.recent}
                rowKey={(r) => r.id}
                columns={[
                  { key: 'no', header: t('word.number'), render: (r) => <span>{r.docNo} {r.status === 'void' && <Badge tone="warn">{t('state.void')}</Badge>}</span> },
                  { key: 'c', header: t('nav.customers'), render: (r) => r.customer || t('rep.walkIn') },
                  { key: 't', header: t('word.total'), right: true, render: (r) => money(r.total, { fixed: true }) },
                  { key: 'd', header: t('word.due'), right: true, render: (r) => (r.due > 0 ? <Badge tone="red">{money(r.due, { fixed: true })}</Badge> : '') }
                ]}
                empty={<EmptyState title={t('dash.noSalesTitle')} body={t('dash.noSalesBody')} />}
              />
            </Card>
            <Card title={t('dash.topDue')}>
              <Table
                rows={d.topDue}
                rowKey={(r) => r.customerId}
                columns={[{ key: 'n', header: t('word.name'), render: (r) => r.name }, { key: 'd', header: t('word.due'), right: true, render: (r) => <Badge tone="red">{money(r.due, { fixed: true })}</Badge> }]}
                empty={<EmptyState title={t('dash.noDueTitle')} body={t('dash.noDueBody')} />}
              />
            </Card>
          </div>
        </div>
      )}
      <ReceivePaymentFlow open={pay} onClose={() => setPay(false)} onDone={() => dash.reload()} />
      <ExpenseModal open={expense} onClose={() => setExpense(false)} onDone={() => { setExpense(false); dash.reload(); }} />
    </div>
  );
}
