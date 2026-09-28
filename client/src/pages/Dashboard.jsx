import { Link, useNavigate } from 'react-router-dom';
import {
  Bus,
  MapPin,
  Route as RouteIcon,
  Users,
  Navigation,
  Clock,
  Sparkles,
  ArrowUpRight,
  Radio,
  Gauge,
  CalendarClock,
  ShieldCheck,
} from 'lucide-react';
import { useApi } from '../lib/hooks.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Card, StatTile, Badge, Button, EmptyState, Spinner } from '../components/ui.jsx';
import LiveMap from '../components/LiveMap.jsx';
import { cx, etaLabel, timeAgo, isFresh, clockTime } from '../lib/utils.js';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

function LiveBusRow({ bus, myStop, onSelect, active }) {
  return (
    <button
      onClick={() => onSelect(bus)}
      className={cx(
        'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition',
        active
          ? 'border-brand-300 bg-brand-50/60 shadow-soft'
          : 'border-slate-200/80 bg-white hover:border-brand-200 hover:shadow-soft'
      )}
    >
      <div
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-soft"
        style={{ background: bus.route?.color || '#2547EB' }}
      >
        <Bus className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold text-ink">{bus.bus_number}</p>
          {isFresh(bus.location?.updated_at) && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          )}
        </div>
        <p className="truncate text-[12.5px] text-ink-mute">
          {bus.route?.name || 'Route not assigned'} · {timeAgo(bus.location?.updated_at)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {myStop && bus.location ? (
          <p className="text-[13px] font-bold text-ink">{etaLabel(bus.location, myStop)}</p>
        ) : (
          <p className="text-[13px] font-bold text-ink-mute">{bus.driver?.full_name?.split(' ')[0] || '—'}</p>
        )}
        <p className="text-[11px] text-ink-mute">{bus.driver ? 'driver' : 'unassigned'}</p>
      </div>
    </button>
  );
}

export default function Dashboard() {
  const { user, isAdmin, isDriver } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi('/api/live/map', { poll: 10000 });
  const admin = useApi('/api/admin/overview', { enabled: isAdmin });
  const events = useApi('/api/live/events', { enabled: isDriver, poll: 20000 });

  if (loading) return <Spinner label="Loading your dashboard" />;
  if (error)
    return (
      <EmptyState
        icon={Radio}
        title="Cannot reach the bus service"
        message={error.message}
        action={<Button onClick={() => reload()}>Try again</Button>}
      />
    );

  const buses = data?.buses || [];
  const myBus = data?.my_bus;
  const myStop = data?.my_stop;
  const live = buses.filter((b) => isFresh(b.location?.updated_at)).length;

  return (
    <div className="space-y-5">
      {/* hero */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-brand-600 via-brand-700 to-violet-700 p-6 text-white shadow-card sm:p-7">
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'radial-gradient(500px 260px at 88% 0%, rgba(255,255,255,.5), transparent 60%), radial-gradient(420px 300px at 10% 100%, rgba(56,189,248,.5), transparent 60%)',
          }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white/70">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
              {greeting()}, {user.full_name.split(' ')[0]} 👋
            </h1>
            <p className="mt-1.5 max-w-lg text-sm text-white/75">
              {isDriver
                ? 'Share your live location so every student knows when to head to the stop.'
                : isAdmin
                  ? 'Your fleet is at a glance — manage buses, routes, stops and people below.'
                  : myBus
                    ? `Your bus ${myBus.bus_number} is being tracked live on the map.`
                    : 'No bus assigned yet — pick one from the Buses tab to start tracking.'}
            </p>
          </div>
          <div className="flex gap-2">
            {myBus && (
              <Button
                className="bg-white/15 text-white ring-1 ring-white/25 backdrop-blur hover:bg-white/25"
                onClick={() => navigate(`/map?bus=${myBus.id}`)}
              >
                <Navigation className="h-4 w-4" /> {myBus.bus_number}
              </Button>
            )}
            <Link to="/map">
              <Button className="bg-white text-brand-700 hover:bg-white/90">
                <MapPin className="h-4 w-4" /> Open live map
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile icon={Bus} label="Total buses" value={buses.length} tone="blue" sub={`${live} live right now`} />
        <StatTile icon={RouteIcon} label="Routes" value={data?.routes?.length || 0} tone="violet" />
        <StatTile icon={MapPin} label="Bus stops" value={data?.stops?.length || 0} tone="sky" />
        {isAdmin ? (
          <>
            <StatTile
              icon={Users}
              label="Students & drivers"
              value={(admin.data?.stats?.students || 0) + (admin.data?.stats?.drivers || 0)}
              tone="green"
              sub={`${admin.data?.stats?.active_buses || 0} buses in service`}
            />
          </>
        ) : (
          <StatTile
            icon={myStop ? CalendarClock : Users}
            label={myStop ? 'Your pickup stop' : 'Bus assignment'}
            value={myStop ? myStop.name : 'Not set'}
            tone="green"
            sub={myStop ? 'ETA shown on the map' : 'Choose one in Profile'}
          />
        )}
      </div>

      {/* my bus + map */}
      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 px-5 pt-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-ink">Live fleet</h2>
              <p className="text-[13px] text-ink-mute">Auto-refreshes every 10 seconds</p>
            </div>
            <Link to="/map" className="flex items-center gap-1 text-[13px] font-bold text-brand-600 hover:underline">
              Full map <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="p-3 pt-3">
            <LiveMap buses={buses} routes={data?.routes || []} myBusId={myBus?.id} height="h-[320px] sm:h-[380px]" />
          </div>
        </Card>

        <div className="space-y-5">
          {myBus ? (
            <Card className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-12 w-12 place-items-center rounded-2xl text-white shadow-soft"
                    style={{ background: myBus.route?.color || '#2547EB' }}
                  >
                    <Bus className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-extrabold tracking-tight text-ink">{myBus.bus_number}</p>
                    <p className="text-[13px] text-ink-mute">{myBus.name}</p>
                  </div>
                </div>
                <Badge tone={myBus.location ? 'green' : 'slate'}>
                  {myBus.location ? 'Tracking' : 'No signal'}
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11.5px] font-semibold text-ink-mute">Driver</p>
                  <p className="truncate text-sm font-bold text-ink">
                    {myBus.driver?.full_name || 'Not assigned'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11.5px] font-semibold text-ink-mute">Last update</p>
                  <p className="text-sm font-bold text-ink">
                    {myBus.location ? clockTime(myBus.location.updated_at) : '—'}
                  </p>
                </div>
              </div>

              {myStop && myBus.location ? (
                <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
                  <p className="text-[12px] font-semibold text-brand-600">
                    Arriving near {myStop.name}
                  </p>
                  <p className="mt-0.5 text-xl font-extrabold tracking-tight text-brand-800">
                    {etaLabel(myBus.location, myStop)}
                  </p>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-4 text-center">
                  <p className="text-[13px] text-ink-mute">
                    Set your pickup stop in <Link to="/profile" className="font-bold text-brand-600">Profile</Link> to
                    get arrival times.
                  </p>
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-5">
              <h3 className="text-base font-bold text-ink">No bus assigned yet</h3>
              <p className="mt-1.5 text-sm text-ink-soft">
                {isAdmin
                  ? 'Assign buses and stops to students and drivers from the Users page.'
                  : isDriver
                    ? 'Ask the admin to assign a bus to your driver account, then start sharing your location.'
                    : 'Ask the admin to assign you a bus and your pickup stop, or pick one yourself from the Buses and Stops pages.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/buses"><Button size="sm" variant="soft">Browse buses</Button></Link>
                <Link to="/stops"><Button size="sm" variant="outline">Find my stop</Button></Link>
              </div>
            </Card>
          )}

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">
                {isDriver ? 'Other buses' : 'All buses'}
              </h3>
              <Badge tone="slate">{buses.length}</Badge>
            </div>
            <div className="space-y-2">
              {buses.slice(0, 5).map((b) => (
                <LiveBusRow key={b.id} bus={b} myStop={myStop} onSelect={() => {}} />
              ))}
              {buses.length === 0 && <p className="py-4 text-center text-sm text-ink-mute">No buses yet.</p>}
            </div>
          </Card>

          {isDriver && events.data?.events?.length > 0 && (
            <Card className="p-5">
              <h3 className="text-base font-bold text-ink">Recent trip events</h3>
              <ul className="mt-3 space-y-2.5">
                {events.data.events.slice(0, 4).map((e) => (
                  <li key={e.id} className="flex items-start gap-2.5 text-[13px]">
                    <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-mute" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{e.note || e.event_type}</p>
                      <p className="text-[11.5px] text-ink-mute">{timeAgo(e.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Link to="/assistant" className="block">
            <Card className="flex items-center gap-3 p-4 card-hover">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-brand-600 text-white">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">Ask the AI assistant</p>
                <p className="truncate text-[12.5px] text-ink-mute">
                  {isAdmin ? 'Generate a daily fleet report' : isDriver ? 'Summarise your day’s trip' : 'Get help with your route'}
                </p>
              </div>
              <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-ink-mute" />
            </Card>
          </Link>

          {isAdmin && (
            <Link to="/users">
              <Card className="flex items-center gap-3 p-4 card-hover">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">Manage people</p>
                  <p className="truncate text-[12.5px] text-ink-mute">
                    {admin.data?.stats?.students || 0} students · {admin.data?.stats?.drivers || 0} drivers
                  </p>
                </div>
                <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-ink-mute" />
              </Card>
            </Link>
          )}
        </div>
      </div>

      {/* route shortcuts */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-ink">Routes in service</h2>
          <Link to="/routes" className="flex items-center gap-1 text-[13px] font-bold text-brand-600 hover:underline">
            All routes <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.routes || []).slice(0, 6).map((r) => (
            <Link key={r.id} to={`/routes?focus=${r.id}`}>
              <div className="h-full rounded-2xl border border-slate-200/80 bg-white p-4 transition hover:border-brand-200 hover:shadow-soft">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color || '#2547EB' }} />
                  <p className="truncate text-sm font-bold text-ink">{r.name}</p>
                </div>
                <p className="mt-1.5 line-clamp-2 text-[12.5px] text-ink-mute">{r.description}</p>
                <p className="mt-2.5 flex items-center gap-1 text-[12px] font-semibold text-ink-soft">
                  <MapPin className="h-3.5 w-3.5" /> {r.stops?.length || 0} stops
                </p>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
