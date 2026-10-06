import type { ReactNode, SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };
function Svg({ size = 18, children, ...rest }: P & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}
export const IconDashboard = (p: P) => <Svg {...p}><path d="M3 3h8v10H3zM13 3h8v6h-8zM13 11h8v10h-8zM3 15h8v6H3z" /></Svg>;
export const IconSales = (p: P) => <Svg {...p}><path d="M4 3h16v18l-3-2-2 2-3-2-3 2-2-2-3 2zM8 8h8M8 12h8M8 16h5" /></Svg>;
export const IconPurchase = (p: P) => <Svg {...p}><path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10" /></Svg>;
export const IconStock = (p: P) => <Svg {...p}><path d="M3 21V9l9-6 9 6v12M8 21v-7h8v7" /></Svg>;
export const IconProducts = (p: P) => <Svg {...p}><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /></Svg>;
export const IconPeople = (p: P) => <Svg {...p}><path d="M9 11a4 4 0 100-8 4 4 0 000 8zM2 21v-2a5 5 0 015-5h4a5 5 0 015 5v2M17 3.5a4 4 0 010 7M22 21v-2a5 5 0 00-3-4.6" /></Svg>;
export const IconMoney = (p: P) => <Svg {...p}><path d="M3 6h18v12H3zM12 9a3 3 0 100 6 3 3 0 000-6zM6 9v.01M18 15v.01" /></Svg>;
export const IconReports = (p: P) => <Svg {...p}><path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3" /></Svg>;
export const IconBackup = (p: P) => <Svg {...p}><path d="M12 3v12M7 10l5 5 5-5M4 19h16" /></Svg>;
export const IconSettings = (p: P) => <Svg {...p}><path d="M12 9a3 3 0 100 6 3 3 0 000-6zM19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.4 1a7 7 0 00-2-1.2L14 3h-4l-.5 2.7a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.5a7 7 0 000 2.4l-2 1.5 2 3.4 2.4-1a7 7 0 002 1.2L10 21h4l.5-2.7a7 7 0 002-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" /></Svg>;
export const IconStyle = (p: P) => <Svg {...p}><path d="M12 3a9 9 0 100 18c1.5 0 2-1 1.5-2s0-2 1.5-2h2a3 3 0 003-3c0-6-4-11-8-11zM7.5 11v.01M10 7v.01M15 8v.01" /></Svg>;
export const IconClose = (p: P) => <Svg {...p}><path d="M5 5l14 14M19 5L5 19" /></Svg>;
export const IconMin = (p: P) => <Svg {...p}><path d="M5 12h14" /></Svg>;
export const IconMax = (p: P) => <Svg {...p}><path d="M5 5h14v14H5z" /></Svg>;
export const IconSearch = (p: P) => <Svg {...p}><path d="M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4" /></Svg>;
export const IconBox = (p: P) => <Svg {...p}><path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8" /></Svg>;
export const IconCheck = (p: P) => <Svg {...p}><path d="M5 12l5 5 9-10" /></Svg>;

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg className="brand-mark logo-draw" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="1.5" y="1.5" width="37" height="37" fill="#C8202F" stroke="#F6F1E7" strokeWidth="1.5" />
      <path d="M12 31V9h9.5a6.5 6.5 0 010 13H12" fill="none" stroke="#F6F1E7" strokeWidth="3.2" strokeLinecap="square" />
    </svg>
  );
}
