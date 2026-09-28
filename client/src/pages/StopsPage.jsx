import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Search, Navigation, Check, Radio } from 'lucide-react';
import { useApi, useAction } from '../lib/hooks.js';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../lib/api.js';
import { Card, Button, Badge, EmptyState, Spinner, Input, Field } from '../components/ui.jsx';
import LiveMap from '../components/LiveMap.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { cx, distanceKm } from '../lib/utils.js';

export default function StopsPage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const map = useApi('/api/live/map', { poll: 15000 });
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const { run, busy } = useAction();

  if (map.loading) return <Spinner label="Loading bus stops" />;
  if (map.error)
    return <EmptyState icon={Radio} title="Cannot load stops" message={map.error.message} action={<Button onClick={map.reload}>Retry</Button>} />;

  const stops = map.data?.stops || [];
  const myStop = map.data?.my_stop;
  const origin = map.data?.buses?.find((b) => b.location)?.location;

  const filtered = stops
    .filter((s) => !q || `${s.name} ${s.landmark || ''} ${s.code || ''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      if (origin) return (distanceKm(origin, a) ?? 1e9) - (distanceKm(origin, b) ?? 1e9);
      return a.name.localeCompare(b.name);
    });

  const selected = stops.find((s) => s.id === selectedId) || null;
  const routesUsing = selected ? (map.data?.routes || []).filter((r) => r.stops?.some((s) => s.stop_id === selected.id)) : [];

  const setMyStop = async (stopId) => {
    try {
      const res = await run(() => api.profile.update({ stop_id: stopId }));
      setUser({ ...user, ...res.user });
      await map.reload();
      toast.success('Your pickup stop has been saved');
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">Bus stops</h1>
          <p className="text-[13px] text-ink-mute">
            {stops.length} stops · select one to see it on the map and which buses serve it
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stops…" className="pl-9" />
        </div>
      </div>

      {myStop && (
        <Card className="flex flex-wrap items-center gap-3 border-brand-200 bg-brand-50/60 p-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700">
            <Navigation className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-violet-700">Your pickup stop</p>
            <p className="truncate text-base font-extrabold text-ink">{myStop.name}</p>
          </div>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setSelectedId(myStop.id)}>
            Show on map
          </Button>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden p-0">
          <LiveMap
            buses={map.data?.buses || []}
            stops={stops}
            routes={map.data?.routes || []}
            selectedStopId={selectedId}
            myStopId={myStop?.id}
            onSelectStop={(s) => setSelectedId(s.id === selectedId ? null : s.id)}
            focus={selectedId ? 'stop' : 'all'}
            height="h-[320px] sm:h-[440px] lg:h-[calc(100vh-16rem)] lg:min-h-[440px]"
          />
        </Card>

        <div className="space-y-4">
          {selected && (
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-extrabold tracking-tight text-ink">{selected.name}</p>
                  {selected.landmark && <p className="text-[12.5px] text-ink-mute">{selected.landmark}</p>}
                  <p className="mt-1 text-[11.5px] font-semibold text-ink-mute">
                    {selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}
                  </p>
                </div>
                {myStop?.id === selected.id && <Badge tone="violet">Yours</Badge>}
              </div>

              {routesUsing.length > 0 && (
                <div className="mt-4">
                  <p className="text-[12.5px] font-bold text-ink-soft">Routes that stop here</p>
                  <div className="mt-2 space-y-1.5">
                    {routesUsing.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => navigate(`/routes?focus=${r.id}`)}
                        className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200/80 px-3 py-2 text-left transition hover:border-brand-200 hover:bg-brand-50/40"
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{r.name}</span>
                        <span className="shrink-0 text-[11.5px] font-bold text-ink-mute">
                          {r.stops.length} stops
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" className="flex-1" onClick={() => navigate(`/map?stop=${selected.id}`)}>
                  Track buses here
                </Button>
                {myStop?.id !== selected.id && (
                  <Button size="sm" variant="soft" onClick={() => setMyStop(selected.id)} loading={busy}>
                    <Check className="h-3.5 w-3.5" /> Set as my stop
                  </Button>
                )}
              </div>
            </Card>
          )}

          <Card className="p-4">
            <p className="mb-3 text-[12.5px] font-bold text-ink-soft">
              {origin ? 'Nearest to a live bus' : 'All stops'}
            </p>
            <div className="max-h-[52vh] space-y-1.5 overflow-y-auto scrollbar-thin pr-1">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                  className={cx(
                    'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                    s.id === selectedId
                      ? 'border-sky-300 bg-sky-50'
                      : 'border-slate-200/80 hover:border-sky-200 hover:bg-slate-50'
                  )}
                >
                  <MapPin className={cx('h-4 w-4 shrink-0', myStop?.id === s.id ? 'text-violet-500' : 'text-sky-500')} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-ink">{s.name}</p>
                    <p className="truncate text-[11.5px] text-ink-mute">{s.landmark || s.code || 'Bus stop'}</p>
                  </div>
                  {origin && (
                    <span className="shrink-0 text-[11.5px] font-bold text-ink-mute">
                      {distanceKm(origin, s)?.toFixed(1)} km
                    </span>
                  )}
                </button>
              ))}
              {filtered.length === 0 && <p className="py-6 text-center text-sm text-ink-mute">No stops match your search.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
