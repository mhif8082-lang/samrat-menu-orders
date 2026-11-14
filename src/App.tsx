import { useRoute } from './router';
import { Home, MenuPage, MyOrders, TrackPage } from './pages/guest';
import { canSee, StaffLogin } from './pages/staff-shell';
import { navigate } from './router';
import { useEffect } from 'react';
import { FrontDesk, KitchenBoard, StaffHome, StationBoard } from './pages/boards';
import { Dashboard, MenuAdmin, SettingsPage, Tables, Team } from './pages/admin';
import { InstallPage } from './pwa';
import { Empty, Toasts } from './components/ui';
import { NoticeStack, Splash } from './components/fx';
import { Link } from './router';
import { ROLE_INFO, useAuth, type Station } from './api';

function Page() {
  const { path } = useRoute();
  const auth = useAuth();
  const seg = path.split('/').filter(Boolean);
  const blocked = !!auth && path.startsWith('/staff/') && path !== '/staff/login' && !canSee(auth.staff.role, path === '/admin' ? '/staff/dashboard' : path);
  useEffect(() => { if (blocked && auth) navigate(ROLE_INFO[auth.staff.role].home, true); }, [blocked, auth]);
  if (blocked) return null;
  const managerOnly = (el: React.ReactNode) => auth?.staff.role === 'admin' ? el : <StaffHome />;
  if (path === '/') return <Home />;
  if (path === '/menu') return <MenuPage />;
  if (seg[0] === 'order' && seg[1]) return <TrackPage id={seg[1]} />;
  if (path === '/my-orders') return <MyOrders />;
  if (path === '/install') return <InstallPage />;
  if (path === '/staff/login') return <StaffLogin />;
  if (path === '/staff') return <StaffHome />;
  if (path === '/staff/kitchen') return <KitchenBoard />;
  if (seg[0] === 'staff' && seg[1] === 'station' && seg[2]) return <StationBoard key={seg[2]} station={seg[2] as Station} />;
  if (path === '/staff/orders') return <FrontDesk />;
  if (path === '/staff/menu') return <MenuAdmin />;
  if (path === '/staff/dashboard' || path === '/admin') return managerOnly(<Dashboard />);
  if (path === '/staff/tables') return managerOnly(<Tables />);
  if (path === '/staff/team') return managerOnly(<Team />);
  if (path === '/staff/settings') return managerOnly(<SettingsPage />);
  return <div className="page"><Empty icon="menu" title="Page not found"><Link to="/">Go home</Link></Empty></div>;
}
export default function App() { return <><Splash /><Page /><Toasts /><NoticeStack /></>; }
