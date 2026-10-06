import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Button, BrandMark, Segmented, Toasts } from '../ui';
import { useI18n } from '../i18n';
import { effectiveMotion, useUi } from '../store/ui';
import { visibleNav } from './nav';
import { registeredPaths } from '../pages/registry';

export function Shell() {
  const { t } = useI18n();
  const mode = useUi((s) => s.mode);
  const lang = useUi((s) => s.lang);
  const setUi = useUi((s) => s.set);
  const animations = useUi((s) => s.animations);
  const liteActive = useUi((s) => s.liteActive);
  const loc = useLocation();
  const nav = visibleNav(mode, registeredPaths());
  const [launching, setLaunching] = useState(() => effectiveMotion({ animations, liteActive }) === 'full' && !sessionStorageFlag());

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

  return (
    <div className={`shell${mode === 'simple' ? ' simple' : ''}${launching ? ' launching' : ''}`}>
      <aside className="sidebar">
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
          <Button size="sm" onClick={() => setUi({ mode: mode === 'simple' ? 'full' : 'simple' })} style={{ color: 'var(--cream)', borderColor: 'var(--cream-3)', background: 'transparent' }}>
            {mode === 'simple' ? t('mode.switchToFull') : t('mode.switchToSimple')}
          </Button>
        </div>
      </aside>
      <header className="topbar">
        <h1>{title ? t(title.labelKey) : t('app.name')}</h1>
        <Segmented
          label={t('sg.language')}
          value={lang}
          options={[
            { value: 'bn', label: 'বাংলা' },
            { value: 'en', label: 'EN' }
          ]}
          onChange={(v) => setUi({ lang: v })}
        />
      </header>
      <main className="main">
        <div key={loc.pathname} className="page-fade">
          <Outlet />
        </div>
      </main>
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
