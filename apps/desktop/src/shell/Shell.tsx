import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BrandMark, Button, Badge, ChangeSecretModal, ErrorBoundary, Modal, Segmented, Toasts } from '../ui';
import { call } from '../api';
import { useI18n } from '../i18n';
import { effectiveMotion, useUi } from '../store/ui';
import { rememberMode, useApp } from '../store/app';
import { visibleNav } from './nav';
import { registeredPaths } from '../pages/registry';

function LicenceBanner() {
  const { t, n } = useI18n();
  const lic = useApp((s) => s.status?.licence);
  const navigate = useNavigate();
  const role = useApp((s) => s.status?.session?.role);
  if (!lic) return null;
  let text: string | null = null;
  let warn = false;
  if (lic.state === 'expired') text = t('lic.banner.expired');
  else if (lic.state === 'clock_rollback') text = t('lic.banner.clock');
  else if (lic.state === 'trial') {
    warn = true;
    text = lic.daysLeft !== null && lic.daysLeft <= 1 ? t('lic.banner.trialLast') : t('lic.banner.trial', { n: n(lic.daysLeft ?? 0) });
  } else if (lic.state === 'licensed' && lic.daysLeft !== null && lic.daysLeft <= 30) {
    warn = true;
    text = t('lic.banner.expiring', { n: n(lic.daysLeft) });
  }
  if (!text) return null;
  return (
    <div className={`banner${warn ? ' warn' : ''}`} role="status" data-testid="licence-banner">
      <span style={{ flex: 1 }}>{text}</span>
      {role === 'owner' && <Button size="sm" onClick={() => navigate('/settings')}>{t('lic.banner.open')}</Button>}
    </div>
  );
}

/** Shown after the app restored a backup by itself because the data file was damaged. The Owner dismisses it once read. */
function RecoveryBanner() {
  const { t, n } = useI18n();
  const rec = useApp((s) => s.status?.recovery);
  const refresh = useApp((s) => s.refresh);
  const role = useApp((s) => s.status?.session?.role);
  const navigate = useNavigate();
  if (!rec) return null;
  const when = (iso: string) => n(`${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 16)}`);
  return (
    <div className="banner" role="alert" data-testid="recovery-banner">
      <span style={{ flex: 1 }}>{t('rec.banner', { when: when(rec.backupAt) })}</span>
      {role === 'owner' && <Button size="sm" onClick={() => navigate('/backup')}>{t('nav.backup')}</Button>}
      <Button size="sm" onClick={() => void call('recovery:dismiss').then(refresh)} data-testid="recovery-dismiss">{t('rec.understood')}</Button>
    </div>
  );
}

function Banners() {
  return (
    <div className="banners" style={{ gridColumn: 2 }}>
      <RecoveryBanner />
      <LicenceBanner />
    </div>
  );
}

export function Shell() {
  const { t } = useI18n();
  const mode = useUi((s) => s.mode);
  const lang = useUi((s) => s.lang);
  const setUi = useUi((s) => s.set);
  const animations = useUi((s) => s.animations);
  const liteActive = useUi((s) => s.liteActive);
  const session = useApp((s) => s.status?.session);
  const refresh = useApp((s) => s.refresh);
  const loc = useLocation();
  const [account, setAccount] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const role = session?.role ?? 'staff';
  const nav = visibleNav(mode, registeredPaths(role));
  const [launching, setLaunching] = useState(() => effectiveMotion({ animations, liteActive }) === 'full' && !sessionStorageFlag());
  const licence = useApp((s) => s.status?.licence);
  const recovery = useApp((s) => s.status?.recovery);
  const hasBanner = !!recovery || (!!licence && (licence.state !== 'licensed' || (licence.daysLeft !== null && licence.daysLeft <= 30)));

  useEffect(() => {
    if (!launching) return;
    markLaunched();
    const end = () => setLaunching(false);
    const h = window.setTimeout(end, 700);
    window.addEventListener('keydown', end, { once: true });
    return () => {
      window.clearTimeout(h);
      window.removeEventListener('keydown', end);
    };
  }, [launching]);

  const title = nav.find((n) => (n.path === '/' ? loc.pathname === '/' : loc.pathname.startsWith(n.path)));
  const signOut = async () => {
    await call('auth:logout');
    await refresh();
  };

  return (
    <div className={`shell${mode === 'simple' ? ' simple' : ''}${launching ? ' launching' : ''}`} style={hasBanner ? { gridTemplateRows: 'auto 48px 1fr' } : undefined}>
      <aside className="sidebar" style={hasBanner ? { gridRow: '1 / span 3' } : undefined}>
        <div className="brand">
          <BrandMark />
          <div>
            <div className="brand-name">PETRA</div>
            <div className="brand-sub">DMS</div>
          </div>
        </div>
        <nav className="nav" aria-label="Main">
          {nav.map((n) => (
            <NavLink key={n.id} to={n.path} end={n.path === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
              <n.Icon />
              <span>{t(n.labelKey)}</span>
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <Button size="sm" onClick={() => session && rememberMode(session.userId, mode === 'simple' ? 'full' : 'simple')} style={{ color: 'var(--cream)', borderColor: 'var(--cream-3)', background: 'transparent' }} data-testid="mode-toggle">
            {mode === 'simple' ? t('mode.switchToFull') : t('mode.switchToSimple')}
          </Button>
        </div>
      </aside>
      {hasBanner && <Banners />}
      <header className="topbar">
        <h1>{title ? t(title.labelKey) : t('app.name')}</h1>
        <Segmented label={t('sg.language')} value={lang} options={[{ value: 'bn', label: 'বাংলা' }, { value: 'en', label: 'EN' }]} onChange={(v) => setUi({ lang: v })} />
        {session && (
          <Button size="sm" onClick={() => setAccount(true)} data-testid="account">
            {session.displayName} <Badge tone="dark">{t(`role.${session.role}`)}</Badge>
          </Button>
        )}
      </header>
      <main className="main">
        <div key={loc.pathname} className="page-fade">
          <ErrorBoundary resetKey={loc.pathname}><Outlet /></ErrorBoundary>
        </div>
      </main>
      <Modal open={account} title={session?.displayName ?? ''} onClose={() => setAccount(false)}>
        <div className="grid" style={{ gap: 8 }}>
          <Button onClick={() => { setAccount(false); setChangeOpen(true); }} data-testid="account-change">{t('set.changeSecret')}</Button>
          <Button variant="dark" onClick={() => void signOut()} data-testid="signout">{t('auth.signOut')}</Button>
        </div>
      </Modal>
      <ChangeSecretModal open={changeOpen} onClose={() => setChangeOpen(false)} />
      <Toasts />
    </div>
  );
}

function sessionStorageFlag(): boolean {
  try {
    return sessionStorage.getItem('petra.launched') === '1';
  } catch {
    return false;
  }
}
function markLaunched() {
  try {
    sessionStorage.setItem('petra.launched', '1');
  } catch {
    /* ignore */
  }
}
