export type IconName = 'logo' | 'requirements' | 'diagram' | 'settings' | 'sun' | 'moon' | 'select' | 'hand' | 'add' | 'connect' | 'close' | 'panel' | 'check' | 'download';
const paths: Record<IconName, React.ReactNode> = {
  logo: <><rect x="2" y="2" width="20" height="20" rx="6" /><circle cx="9" cy="9" r="2" fill="var(--accent)" stroke="none" /><path d="m9 9 7 7" /><circle cx="16" cy="16" r="1.5" fill="currentColor" /></>,
  requirements: <path d="M6 7h12M6 12h12M6 17h7" />,
  diagram: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /><path d="M10 6h3a3 3 0 0 1 3 3v5" /></>,
  settings: <><path d="M3 7h9m6 0h3M3 17h3m6 0h9" /><circle cx="15" cy="7" r="3" /><circle cx="9" cy="17" r="3" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
  moon: <path d="M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10Z" />,
  select: <path d="m6 3 14 7-6 2-2 7Z" />,
  hand: <path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3" />,
  add: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8v8m-4-4h8" /></>,
  connect: <><circle cx="6" cy="18" r="3" /><circle cx="18" cy="6" r="3" /><path d="m8 16 8-8" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  panel: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M15 3v18" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  download: <><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" /></>,
};
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
