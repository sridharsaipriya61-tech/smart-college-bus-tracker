import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bus,
  LayoutDashboard,
  Map,
  MapPin,
  Route as RouteIcon,
  NotebookPen,
  Sparkles,
  User,
  LogOut,
  Menu,
  X,
  Users,
  Settings2,
  Radio,
  ChevronDown,
  ShieldCheck,
  Navigation,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Avatar, Badge, Button } from './ui.jsx';
import { cx } from '../lib/utils.js';

const navFor = (role) => {
  const common = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/map', label: 'Live Map', icon: Map },
  ];
  const explore = [
    { to: '/buses', label: 'Buses', icon: Bus },
    { to: '/stops', label: 'Bus Stops', icon: MapPin },
    { to: '/routes', label: 'Routes', icon: RouteIcon },
  ];
  const personal = [
    { to: '/notes', label: 'My Notes', icon: NotebookPen },
    { to: '/assistant', label: 'AI Assistant', icon: Sparkles },
    { to: '/profile', label: 'Profile', icon: User },
  ];

  if (role === 'admin') {
    return [
      ...common,
      { to: '/fleet', label: 'Manage Fleet', icon: Settings2 },
      { to: '/users', label: 'Users', icon: Users },
      { to: '/reports', label: 'AI Reports', icon: Sparkles },
      ...explore,
      { to: '/profile', label: 'Profile', icon: User },
    ];
  }
  if (role === 'driver') {
    return [
      ...common,
      { to: '/drive', label: 'My Bus', icon: Navigation },
      { to: '/events', label: 'Trip Log', icon: Radio },
      ...explore,
      ...personal.filter((p) => p.to !== '/profile'),
      { to: '/profile', label: 'Profile', icon: User },
    ];
  }
  return [...common, ...explore, ...personal];
};

const RoleBadge = ({ role }) => {
  if (role === 'admin') return <Badge tone="violet"><ShieldCheck className="h-3 w-3" /> Admin</Badge>;
  if (role === 'driver') return <Badge tone="sky"><Bus className="h-3 w-3" /> Driver</Badge>;
  return <Badge tone="blue"><User className="h-3 w-3" /> Student</Badge>;
};

function Brand({ compact }) {
  return (
    <div className={cx('flex items-center gap-3', compact && 'justify-center')}>
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-glow">
        <Bus className="h-5 w-5" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <p className="text-[15px] font-extrabold tracking-tight text-ink">Smart College</p>
          <p className="text-[11.5px] font-semibold text-ink-mute">Bus Tracker</p>
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const items = navFor(user?.role);

  useEffect(() => {
    setMenuOpen(false);
    setUserOpen(false);
  }, [location.pathname]);

  const NavItems = ({ onNavigate, variant }) =>
    items.map(({ to, label, icon: Icon, end }) => (
      <NavLink
        key={to}
        to={to}
        end={end}
        onClick={onNavigate}
        className={({ isActive }) => cx('nav-item', isActive && 'nav-item-active')}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        <span className="truncate">{label}</span>
      </NavLink>
    ));

  return (
    <div className="min-h-screen">
      {/* ---------------- desktop sidebar ---------------- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-slate-200/70 bg-white/80 backdrop-blur-xl lg:flex">
        <div className="px-5 py-5">
          <Brand />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin px-3 pb-4">
          <NavItems />
        </nav>
        <div className="border-t border-slate-100 p-3">
          <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-violet-600 p-4 text-white">
            <p className="text-[13px] font-bold">Need help?</p>
            <p className="mt-0.5 text-[12px] leading-snug text-white/75">
              Ask the AI assistant anything about your route.
            </p>
            <Button
              size="sm"
              className="mt-3 w-full bg-white text-brand-700 hover:bg-white/90"
              onClick={() => navigate('/assistant')}
            >
              <Sparkles className="h-3.5 w-3.5" /> Ask AI
            </Button>
          </div>
        </div>
      </aside>

      {/* ---------------- top bar ---------------- */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl lg:pl-[264px]">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <button
            onClick={() => setMenuOpen(true)}
            className="rounded-xl p-2 text-ink-soft transition hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="lg:hidden">
            <Brand compact />
          </div>

          <div className="hidden min-w-0 flex-1 lg:block">
            <p className="truncate text-[15px] font-bold tracking-tight text-ink">
              {items.find((i) => (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)))?.label ||
                'Smart College Bus Tracker'}
            </p>
            <p className="truncate text-[12.5px] text-ink-mute">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setUserOpen((v) => !v)}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-2.5 transition hover:border-brand-200 hover:shadow-soft"
              >
                <Avatar name={user?.full_name} size="sm" />
                <div className="hidden text-left leading-tight sm:block">
                  <p className="max-w-[120px] truncate text-[13px] font-bold text-ink">{user?.full_name}</p>
                  <p className="text-[11px] font-semibold text-ink-mute">@{user?.username}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-ink-mute" />
              </button>

              {userOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserOpen(false)} />
                  <div className="glass-strong absolute right-0 z-20 mt-2 w-64 animate-fade-up rounded-2xl p-2 shadow-card">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="truncate text-sm font-bold text-ink">{user?.full_name}</p>
                      <p className="truncate text-[12px] text-ink-mute">{user?.email}</p>
                      <div className="mt-2">
                        <RoleBadge role={user?.role} />
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/profile')}
                      className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft transition hover:bg-slate-100"
                    >
                      <User className="h-4 w-4" /> My profile
                    </button>
                    <button
                      onClick={() => {
                        logout();
                        navigate('/');
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                    >
                      <LogOut className="h-4 w-4" /> Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ---------------- content ---------------- */}
      <main className="px-4 pb-28 pt-5 sm:px-6 lg:pb-10 lg:pl-[288px] lg:pr-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>

      {/* ---------------- mobile drawer ---------------- */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[270px] flex-col bg-white shadow-card animate-slide-up">
            <div className="flex items-center justify-between px-5 py-4">
              <Brand />
              <button
                onClick={() => setMenuOpen(false)}
                className="rounded-xl p-2 text-ink-mute hover:bg-slate-100"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-6">
              <NavItems onNavigate={() => setMenuOpen(false)} />
            </nav>
          </aside>
        </div>
      )}

      {/* ---------------- mobile bottom nav ---------------- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/90 backdrop-blur-xl safe-bottom lg:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-between px-1">
          {items.slice(0, 5).map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cx(
                  'flex flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-[10.5px] font-bold transition',
                  isActive ? 'text-brand-600' : 'text-ink-mute'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cx(
                      'grid h-8 w-12 place-items-center rounded-full transition',
                      isActive && 'bg-brand-50'
                    )}
                  >
                    <Icon className={cx('h-[19px] w-[19px]', isActive && 'scale-105')} />
                  </span>
                  <span className="max-w-full truncate">{label.split(' ')[0]}</span>
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-[10.5px] font-bold text-ink-mute"
          >
            <span className="grid h-8 w-12 place-items-center rounded-full">
              <Menu className="h-[19px] w-[19px]" />
            </span>
            More
          </button>
        </div>
      </nav>
    </div>
  );
}

