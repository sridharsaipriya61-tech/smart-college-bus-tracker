import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Route as RouteIcon, MapPin, Clock, Bus, Radio, ArrowRight } from 'lucide-react';
import { useApi } from '../lib/hooks.js';
import { Card, Button, Badge, EmptyState, Spinner } from '../components/ui.jsx';
import LiveMap from '../components/LiveMap.jsx';
import { cx } from '../lib/utils.js';

export default function RoutesPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const focusId = params.get('focus');
  const { data, loading, error, reload } = useApi('/api/live/map', { poll: 20000 });
  const [selectedId, setSelectedId] = useState(focusId);

  useEffect(() => {
    if (focusId) setSelectedId(focusId);
  }, [focusId]);

  if (loading) return <Spinner label="Loading routes" />;
  if (error)
    return <EmptyState icon={Radio} title="Cannot load routes" message={error.message} action={<Button onClick={reload}>Retry</Button>} />;

  const routes = data?.routes || [];
  const stops = data?.stops || [];
  const buses = data?.buses || [];
  const selected = routes.find((r) => r.id === selectedId) || null;
  const selectedBuses = selected ? buses.filter((b) => b.route_id === selected.id) : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">Routes</h1>
        <p className="text-[13px] text-ink-mute">
          {routes.length} route{routes.length === 1 ? '' : 's'} · pick one to view the full path and stops
        </p>
      </div>

      {routes.length === 0 ? (
        <Card>
          <EmptyState icon={RouteIcon} title="No routes yet" message="Routes will appear here once the admin creates them." />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-3 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto lg:pr-1 scrollbar-thin">
            {routes.map((r) => {
              const active = r.id === selectedId;
              const busCount = buses.filter((b) => b.route_id === r.id).length;
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    setSelectedId(active ? null : r.id);
                    setParams(active ? {} : { focus: r.id }, { replace: true });
                  }}
                  className={cx(
                    'w-full rounded-2xl border-2 bg-white p-4 text-left transition',
                    active
                      ? 'border-brand-400 shadow-card'
                      : 'border-slate-200/80 hover:border-brand-200 hover:shadow-soft'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: r.color || '#2547EB' }} />
                    <p className="min-w-0 flex-1 truncate text-[15px] font-extrabold tracking-tight text-ink">
                      {r.name}
                    </p>
                    {r.code && <Badge tone="slate">{r.code}</Badge>}
                  </div>
                  {r.description && <p className="mt-1.5 line-clamp-2 text-[12.5px] text-ink-mute">{r.description}</p>}
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-semibold text-ink-soft">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {r.stops?.length || 0} stops
                    </span>
                    <span className="flex items-center gap-1">
                      <Bus className="h-3.5 w-3.5" /> {busCount} bus{busCount === 1 ? '' : 'es'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
            <Card className="overflow-hidden p-0">
              <LiveMap
                buses={buses}
                stops={selected ? selected.stops.map((s) => s.stop) : stops}
                routes={routes}
                selectedRouteId={selected?.id}
                focus={selected ? 'route' : 'all'}
                height="h-[300px] sm:h-[380px]"
              />
            </Card>

            {selected ? (
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-extrabold tracking-tight text-ink">{selected.name}</h2>
                    {selected.description && <p className="mt-0.5 text-[13px] text-ink-mute">{selected.description}</p>}
                  </div>
                  {selectedBuses.length > 0 && (
                    <Button size="sm" variant="soft" onClick={() => navigate(`/map?bus=${selectedBuses[0].id}`)}>
                      Track bus <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[13px] font-semibold text-ink-soft">
                  <MapPin className="h-4 w-4 text-emerald-500" />
                  {selected.start_point || selected.stops[0]?.stop.name}
                  <ArrowRight className="h-4 w-4 text-ink-mute" />
                  {selected.end_point || selected.stops[selected.stops.length - 1]?.stop.name}
                </div>

                <ol className="mt-4 space-y-2">
                  {selected.stops.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-200/70 p-3">
                      <span
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white"
                        style={{ background: selected.color || '#2547EB' }}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-bold text-ink">{s.stop.name}</p>
                        {s.stop.landmark && <p className="truncate text-[11.5px] text-ink-mute">{s.stop.landmark}</p>}
                      </div>
                      {s.time_offset_min > 0 && (
                        <Badge tone="slate">
                          <Clock className="h-3 w-3" /> +{s.time_offset_min}m
                        </Badge>
                      )}
                    </li>
                  ))}
                </ol>
              </Card>
            ) : (
              <Card className="p-5">
                <p className="text-sm text-ink-mute">
                  Select a route on the left to see its path, stop order and the buses running on it.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
