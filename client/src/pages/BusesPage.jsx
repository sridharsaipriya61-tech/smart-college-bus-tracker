import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, MapPin, User, Radio, Clock, Gauge, Navigation, ArrowRight } from 'lucide-react';
import { useApi, useAction } from '../lib/hooks.js';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../lib/api.js';
import { Card, Button, Badge, EmptyState, Spinner, Tabs, Modal, Field, Select } from '../components/ui.jsx';
import LiveMap from '../components/LiveMap.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { cx, etaLabel, timeAgo, isFresh, clockTime } from '../lib/utils.js';

export default function BusesPage() {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi('/api/live/map', { poll: 8000 });
  const [selected, setSelected] = useState(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const { run, busy } = useAction();

  if (loading) return <Spinner label="Loading buses" />;
  if (error)
    return <EmptyState icon={Radio} title="Cannot load buses" message={error.message} action={<Button onClick={reload}>Retry</Button>} />;

  const buses = data?.buses || [];
  const stops = data?.stops || [];
  const routes = data?.routes || [];
  const myStop = data?.my_stop;
  const myBusId = data?.my_bus?.id;

  const assign = async (busId) => {
    try {
      await run(() => api.profile.update({ bus_id: busId || null }));
      await reload();
      setAssignOpen(false);
      toast.success(busId ? 'Bus assigned to your account' : 'Bus assignment removed');
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">Buses</h1>
          <p className="text-[13px] text-ink-mute">
            {buses.length} bus{buses.length === 1 ? '' : 'es'} · pick one to track it live
          </p>
        </div>
        {!isAdmin && (
          <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
            <Bus className="h-3.5 w-3.5" /> {user.bus_id ? 'Change my bus' : 'Choose my bus'}
          </Button>
        )}
      </div>

      {buses.length === 0 ? (
        <Card>
          <EmptyState
            icon={Bus}
            title="No buses yet"
            message={isAdmin ? 'Add buses from the Manage Fleet page to get started.' : 'The admin has not added any buses yet.'}
            action={isAdmin ? <Button onClick={() => navigate('/fleet')}>Go to Manage Fleet</Button> : null}
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {buses.map((b) => {
            const live = isFresh(b.location?.updated_at);
            const isMine = b.id === myBusId;
            return (
              <Card key={b.id} className={cx('p-5 card-hover', isMine && 'ring-2 ring-brand-200')}>
                <div className="flex items-start gap-3.5">
                  <div
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-soft"
                    style={{ background: b.route?.color || '#2547EB' }}
                  >
                    <Bus className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-extrabold tracking-tight text-ink">{b.bus_number}</p>
                      {isMine && <Badge tone="blue">Your bus</Badge>}
                      {b.status !== 'active' && <Badge tone="amber">{b.status}</Badge>}
                    </div>
                    <p className="truncate text-[13px] text-ink-mute">{b.name}</p>
                  </div>
                  <Badge tone={live ? 'green' : 'slate'}>
                    {live ? 'Live' : b.location ? timeAgo(b.location.updated_at) : 'Offline'}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2.5 text-[12.5px] sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="flex items-center gap-1 font-semibold text-ink-mute">
                      <Navigation className="h-3 w-3" /> Route
                    </p>
                    <p className="truncate font-bold text-ink">{b.route?.name || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="flex items-center gap-1 font-semibold text-ink-mute">
                      <User className="h-3 w-3" /> Driver
                    </p>
                    <p className="truncate font-bold text-ink">{b.driver?.full_name || 'Unassigned'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5">
                    <p className="flex items-center gap-1 font-semibold text-ink-mute">
                      <Gauge className="h-3 w-3" /> Speed
                    </p>
                    <p className="font-bold text-ink">
                      {b.location ? `${Math.round(b.location.speed || 0)} km/h` : '—'}
                    </p>
                  </div>
                </div>

                {myStop && b.location && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5">
                    <Clock className="h-4 w-4 shrink-0 text-brand-600" />
                    <p className="text-[13px] font-semibold text-brand-800">
                      {etaLabel(b.location, myStop)} to {myStop.name}
                    </p>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => navigate(`/map?bus=${b.id}`)}
                    className="flex-1"
                  >
                    Track live <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSelected(b)}>
                    <MapPin className="h-3.5 w-3.5" /> Stops
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* stop order modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.bus_number} — route stops` : ''}
        subtitle={selected?.route?.name}
      >
        {selected?.route?.stops?.length ? (
          <ol className="relative space-y-3 border-l-2 border-dashed border-slate-200 pl-6">
            {selected.route.stops.map((s, i) => (
              <li key={s.id} className="relative">
                <span
                  className="absolute -left-[31px] grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: selected.route.color || '#2547EB' }}
                >
                  {i + 1}
                </span>
                <div className="rounded-xl border border-slate-200/70 bg-white p-3">
                  <p className="text-sm font-bold text-ink">{s.stop.name}</p>
                  {s.stop.landmark && <p className="text-[12px] text-ink-mute">{s.stop.landmark}</p>}
                  {s.time_offset_min > 0 && (
                    <p className="mt-1 text-[12px] font-semibold text-brand-600">+{s.time_offset_min} min from start</p>
                  )}
                  {myStop?.id === s.stop_id && <Badge tone="violet" className="mt-1.5">Your stop</Badge>}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="py-6 text-center text-sm text-ink-mute">This bus has no route stops configured yet.</p>
        )}
      </Modal>

      {/* assign modal */}
      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Choose your bus"
        subtitle="You can change this any time from your profile."
      >
        <div className="space-y-2">
          {buses.map((b) => (
            <button
              key={b.id}
              onClick={() => assign(b.id)}
              disabled={busy}
              className={cx(
                'flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition disabled:opacity-60',
                user.bus_id === b.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-brand-300'
              )}
            >
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white"
                style={{ background: b.route?.color || '#2547EB' }}
              >
                <Bus className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">{b.bus_number}</p>
                <p className="truncate text-[12px] text-ink-mute">{b.route?.name || 'No route'}</p>
              </div>
              {user.bus_id === b.id && <Badge tone="blue">Selected</Badge>}
            </button>
          ))}
          {user.bus_id && (
            <Button variant="ghost" className="w-full" onClick={() => assign('')} loading={busy}>
              Remove my bus assignment
            </Button>
          )}
        </div>
      </Modal>
    </div>
  );
}
