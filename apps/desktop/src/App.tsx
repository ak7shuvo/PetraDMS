import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import type { PetraApi } from '@petra/core';
import { Shell } from './shell/Shell';
import { PAGES } from './pages/registry';
import { applyUiToDocument, useUi } from './store/ui';
import { startLiteGuard } from './motion/lite';
import { toast } from './ui';
import { translate } from './i18n';

declare global {
  interface Window {
    petra: PetraApi;
  }
}

function Hotkeys() {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        navigate('/style-guide');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);
  return null;
}

export function App() {
  useEffect(() => {
    applyUiToDocument();
    const unsub = useUi.subscribe(applyUiToDocument);
    const stop = startLiteGuard(() => toast.ok(translate(useUi.getState().lang, 'sg.lite')));
    return () => {
      unsub();
      stop();
    };
  }, []);
  const home = PAGES.find((p) => p.nav)?.path ?? '/style-guide';
  return (
    <HashRouter>
      <Hotkeys />
      <Routes>
        <Route element={<Shell />}>
          {PAGES.map((p) => (
            <Route key={p.path} path={p.path} element={p.element} />
          ))}
          <Route path="*" element={<Navigate to={home} replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
