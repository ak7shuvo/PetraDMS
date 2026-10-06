import type { ReactElement } from 'react';
import { StyleGuide } from './StyleGuide';

export interface PageDef {
  path: string;
  element: ReactElement;
  /** Appears in the sidebar when true; the style guide is reachable by URL and Ctrl+Shift+G only. */
  nav: boolean;
}

/** Each phase adds its pages here; the sidebar shows an entry only when its page exists. */
export const PAGES: PageDef[] = [{ path: '/style-guide', element: <StyleGuide />, nav: false }];

export function registeredPaths(): ReadonlySet<string> {
  return new Set(PAGES.filter((p) => p.nav).map((p) => p.path));
}
