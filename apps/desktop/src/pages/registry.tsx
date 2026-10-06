import type { ReactElement } from 'react';
import type { Role } from '@petra/core';
import { StyleGuide } from './StyleGuide';
import { SettingsPage } from './Settings';

export interface PageDef {
  path: string;
  element: ReactElement;
  /** Appears in the sidebar when true; the style guide is reachable by URL and Ctrl+Shift+G only. */
  nav: boolean;
  /** Lowest role that may open the page (enforced again in the main process for every call). */
  minRole: Role;
}

/** Each phase adds its pages here; the sidebar shows an entry only when its page exists. */
export const PAGES: PageDef[] = [
  { path: '/settings', element: <SettingsPage />, nav: true, minRole: 'owner' },
  { path: '/style-guide', element: <StyleGuide />, nav: false, minRole: 'staff' }
];

const RANK: Record<Role, number> = { staff: 1, manager: 2, owner: 3 };

export function pagesFor(role: Role): PageDef[] {
  return PAGES.filter((p) => RANK[role] >= RANK[p.minRole]);
}

export function registeredPaths(role: Role): ReadonlySet<string> {
  return new Set(pagesFor(role).filter((p) => p.nav).map((p) => p.path));
}
