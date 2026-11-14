// Where the app lives and where its server is.
// - On the laptop: app at "/", server at "/api" (same address).
// - On GitHub Pages: app at "/samrat-menu-orders/", server found via backend.json (the laptop's current public link).

/** App base path with trailing slash, e.g. "/" or "/samrat-menu-orders/". */
export const BASE = import.meta.env.BASE_URL;
/** Turn an app route ("/staff/orders") into a real URL path, and back. */
export const withBase = (route: string) => BASE === '/' ? route : BASE + route.replace(/^\//, '');
export const stripBase = (pathname: string) => BASE !== '/' && pathname.startsWith(BASE) ? '/' + pathname.slice(BASE.length) : BASE !== '/' && pathname === BASE.slice(0, -1) ? '/' : pathname;
/** Static files in public/ (images, icons): "/assets/x.webp" → base-prefixed URL. */
export const asset = (p?: string) => !p ? '' : /^(https?:|data:|blob:)/.test(p) ? p : withBase(p);
/** Permanent public address of the app, used for table QR codes. */
export const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_URL as string | undefined) || (location.origin + BASE);
/** true when the app is hosted separately from its server (GitHub Pages). */
export const REMOTE_BACKEND = import.meta.env.VITE_REMOTE_BACKEND === '1';
