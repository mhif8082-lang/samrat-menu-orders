import type { CSSProperties } from 'react';

// One consistent line-icon set (24px grid, 1.6 stroke, round joins). No emoji anywhere in the UI.
const P: Record<string, string> = {
  bag: 'M5 7.5h14l1 13.5H4L5 7.5Z M8.5 9V6.5a3.5 3.5 0 0 1 7 0V9',
  search: 'M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M15.6 15.6 21 21',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3 M16 4h3a1 1 0 0 1 1 1v3 M20 16v3a1 1 0 0 1-1 1h-3 M8 20H5a1 1 0 0 1-1-1v-3 M8 9h3v3H8z M13 9h3v3h-3z M8 14h3 M13 14h3v2',
  flame: 'M12 2.8c.6 3.6 5.6 5.7 5.6 11.1a5.6 5.6 0 0 1-11.2 0c0-2.6 1.4-4.4 2.9-5.6.2 2 1 3.1 2.3 3.4-.6-3.3-.5-6.2.4-8.9Z',
  bell: 'M4 17.5h16 M5.2 17.5a6.8 6.8 0 0 1 13.6 0 M12 10.7V8.3 M10.2 8.3h3.6 M3 20.5h18',
  receipt: 'M6 3h12v18l-2.4-1.6L13.2 21l-2.4-1.6L8.4 21 6 19.4V3Z M9 8h6 M9 11.5h6 M9 15h3.5',
  waiter: 'M12 10a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7 M10.5 14.2 12 17l1.5-2.8',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7v5l3.2 2',
  close: 'M6 6l12 12 M18 6 6 18',
  home: 'M4 10.8 12 4l8 6.8V20h-5.2v-5.6H9.2V20H4z',
  board: 'M4 4h4.6v16H4z M9.7 4h4.6v10.5H9.7z M15.4 4H20v13H15.4z',
  pot: 'M4 10.5h16v2.2a8 8 0 0 1-16 0v-2.2Z M2.5 10.5h19 M9.5 7.5c0-1.2 1.2-1.2 1.2-2.5 M13.3 7.5c0-1.2 1.2-1.2 1.2-2.5',
  tandoor: 'M5.5 20.5c-1.2-6.2.8-10.3 3-12.3h7c2.2 2 4.2 6.1 3 12.3Z M8.5 8.2c1-.7 2.2-1 3.5-1s2.5.3 3.5 1 M6.6 13.2c3.4 1.1 7.4 1.1 10.8 0 M12 5c.4-.9 1.2-1.4 1.2-2.4',
  glass: 'M7 3h10l-1.6 17.2a1 1 0 0 1-1 .8H9.6a1 1 0 0 1-1-.8L7 3Z M7.6 9h8.8',
  menu: 'M8 6.5h12 M8 12h12 M8 17.5h12 M4 6.5h.01 M4 12h.01 M4 17.5h.01',
  chart: 'M4 20.5h16.5 M6.5 17V11 M11 17V6 M15.5 17v-4 M20 17V8.5',
  qr: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2.5v2.5H14z M18.5 14H20 M14 18.5h2 M18.5 18.5H20V20',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M2.5 20c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2 M16 4.4a3.5 3.5 0 0 1 0 6.7 M18 14.2c2 .7 3.5 2.8 3.5 5.8',
  sliders: 'M4 6.5h9 M18 6.5h2 M4 12h3 M12 12h8 M4 17.5h11 M20 17.5h0 M15.5 8.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M9.5 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M17.5 19.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  logout: 'M14.5 4H19v16h-4.5 M10 8l-4 4 4 4 M6 12h10',
  sound: 'M4 9.2h3.8L13 5v14l-5.2-4.2H4z M16.4 8.6a4.8 4.8 0 0 1 0 6.8 M18.8 6.2a8.2 8.2 0 0 1 0 11.6',
  mute: 'M4 9.2h3.8L13 5v14l-5.2-4.2H4z M16.5 9.5l5 5 M21.5 9.5l-5 5',
  download: 'M12 4v11 M7 10.5l5 5 5-5 M5 20h14',
  external: 'M14 4h6v6 M20 4l-9 9 M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  print: 'M7 9V3.5h10V9 M7 17H4.5V9.5h15V17H17 M7 13.5h10V21H7z',
  card: 'M3 6h18v12H3z M3 10h18 M7 14.5h3',
  cash: 'M3 7h18v10H3z M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M6 10v4 M18 10v4',
  alert: 'M12 3.5 21.5 20h-19L12 3.5Z M12 10v4.5 M12 17.5h.01',
  note: 'M4 20h4.2L19 9.2 14.8 5 4 15.8V20Z M13 6.8l4.2 4.2',
  phone: 'M7.5 2.5h9v19h-9z M11 18.5h2',
  arrowRight: 'M5 12h14 M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5 M11 6l-6 6 6 6',
  chef: 'M7 14.5V20h10v-5.5 M7 14.5a4 4 0 0 1-.7-7.9A5.5 5.5 0 0 1 17.7 6.6 4 4 0 0 1 17 14.5Z M7 17.5h10',
  sparkle: 'M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8Z',
  eye: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  eyeOff: 'M3 3l18 18 M10.6 5.6c.5-.1.9-.1 1.4-.1 6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4 M6.5 6.6A16.3 16.3 0 0 0 2.5 12s3.5 6.5 9.5 6.5c1.7 0 3.2-.5 4.5-1.2 M9.9 9.9a3 3 0 0 0 4.2 4.2',
  leaf: 'M5 19c0-8 5-13.5 15-14-.4 10-6 15-14 14Z M5 19l7-7',
  table: 'M3 9h18 M5 9v11 M19 9v11 M7 9l1-4h8l1 4',
  wifi: 'M2.5 9a14 14 0 0 1 19 0 M5.5 12.3a9.5 9.5 0 0 1 13 0 M8.6 15.5a5 5 0 0 1 6.8 0 M12 19h.01',
};
export type IconName = keyof typeof P;
export function Icon({ name, size = 20, className = '', style, label }: { name: IconName | string; size?: number; className?: string; style?: CSSProperties; label?: string }) {
  const d = P[name] ?? P.sparkle;
  return <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
    style={style} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    {d.split(' M').map((seg, i) => <path key={i} d={i ? `M${seg}` : seg} />)}
  </svg>;
}
