import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bus, MapPin, Radio, Clock, Navigation, Route as RouteIcon, X, Gauge } from 'lucide-react';
import { useApi } from '../lib/hooks.js';
import { useAuth } from '../context/AuthContext.jsx';
import LiveMap from '../components/LiveMap.jsx';
import { Card, Button, Badge, EmptyState, Spinner, Tabs } from '../components/ui.jsx';
import { cx, etaLabel, timeAgo, isFresh, clockTime, distanceKm } from '../lib/utils.js';

export default function LiveMapPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi('/api/live/map', { poll: 8000 });
  const [params, setParams] = useSearchParams();
  const [selectedBusId, setSelectedBusId] = useState(params.get('bus') || null);
  const [selectedStopId, setSelectedStopId] = useState(params.get('stop') || null);
  const [tab, setTab] = useState('buses');

  const buses = data?.buses || [];
  const stops = data?.stops || [];
  const routes = data?.routes || [];
  const myStop = data?.my_stop;
  const myBus = data?.my_bus;

  const selectedBus = useMemo(() => buses.find((b) => b.id === selectedBusId) || null, [buses, selectedBusId]);
  const selectedStop = useMemo(() => stops.find((s) => s.id === selectedStopId) || null, [stops, selectedStopId]);
  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === params.get('route')) || null,
    [routes, params]
  );

  // Nearest stops to a selected bus, with rough ETA.
  const nearby = useMemo(() => {
    if (!selectedBus?.location) return [];
    return stops
      .map((s) => ({ ...s, dist: distanceKm(selectedBus.location, s) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5);
  }, [selectedBus, stops]);

  const nearMe = useMemo(() => {
    const origin = selectedBus?.location || buses.find((b) => b.location)?.location;
    if (!origin) return [];
    return stops
      .map((s) => ({ ...s, dist: distanceKm(origin, s) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 6);
  }, [buses, selectedBus, stops]);

  useEffect(() => {
    const next = {};
    if (selectedBusId) next.bus = selectedBusId;
    if (selectedStopId) next.stop = selectedStopId;
    if (params.get('route')) next.route = params.get('route');
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBusId, selectedStopId]);

  if (loading) return <Spinner label="Loading live map" />;
  if (error)
    return (
      <EmptyState
        icon={Radio}
        title="Map unavailable"
        message={error.message}
        action={<Button onClick={() => reload()}>Try again</Button>}
      />
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-extrabold tracking-tight text-ink sm:text-2xl">Live map</h1>
        {myBus && (
          <Button size="sm" variant="soft" onClick={() => setSelectedBusId(myBus.id)}>
            <Bus className="h-3.5 w-3.5" /> My bus
          </Button>
        )}
        {myStop && (
          <Button size="sm" variant="outline" onClick={() => setSelectedStopId(myStop.id)}>
            <MapPin className="h-3.5 w-3.5" /> My stop
          </Button>
        )}
        {(selectedBusId || selectedStopId || params.get('route')) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelectedBusId(null);
              setSelectedStopId(null);
              setParams({}, { replace: true });
            }}
          >
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden p-0">
          <LiveMap
            buses={buses}
            stops={stops}
            routes={routes}
            selectedBusId={selectedBusId}
            selectedStopId={selectedStopId}
            selectedRouteId={params.get('route')}
            myStopId={myStop?.id}
            myBusId={myBus?.id}
            onSelectBus={(b) => setSelectedBusId(b.id === selectedBusId ? null : b.id)}
            onSelectStop={(s) => setSelectedStopId(s.id === selectedStopId ? null : s.id)}
            focus={selectedBusId ? 'bus' : selectedStopId ? 'stop' : params.get('route') ? 'route' : 'all'}
            height="h-[340px] sm:h-[460px] lg:h-[calc(100vh-13rem)] lg:min-h-[480px]"
          />
        </Card>

        <div className="space-y-4">
          {/* selected bus */}
          {selectedBus && (
            <Card className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-11 w-11 place-items-center rounded-xl text-white"
                    style={{ background: selectedBus.route?.color || '#2547EB' }}
                  >
                    <Bus className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-base font-extrabold tracking-tight text-ink">{selectedBus.bus_number}</p>
                    <p className="text-[12.5px] text-ink-mute">{selectedBus.route?.name || 'No route'}</p>
                  </div>
                </div>
                <Badge tone={isFresh(selectedBus.location?.updated_at) ? 'green' : 'slate'}>
                  {selectedBus.location ? timeAgo(selectedBus.location.updated_at) : 'No signal'}
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5 text-[12.5px]">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="font-semibold text-ink-mute">Driver</p>
                  <p className="truncate font-bold text-ink">{selectedBus.driver?.full_name || '—'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="font-semibold text-ink-mute">Speed</p>
                  <p className="font-bold text-ink">
                    {selectedBus.location ? `${Math.round(selectedBus.location.speed || 0)} km/h` : '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="font-semibold text-ink-mute">Status</p>
                  <p className="truncate font-bold capitalize text-ink">
                    {selectedBus.location?.status?.replace('_', ' ') || '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="font-semibold text-ink-mute">Last ping</p>
                  <p className="font-bold text-ink">{clockTime(selectedBus.location?.updated_at)}</p>
                </div>
              </div>

              {myStop && selectedBus.location && (
                <div className="mt-3 rounded-2xl bg-brand-50 p-3.5">
                  <p className="text-[12px] font-semibold text-brand-600">To your stop ({myStop.name})</p>
                  <p className="text-lg font-extrabold tracking-tight text-brand-800">
                    {etaLabel(selectedBus.location, myStop)}
                  </p>
                </div>
              )}

              {nearby.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-[12.5px] font-bold text-ink-soft">Closest stops ahead</p>
                  <div className="space-y-1.5">
                    {nearby.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedStopId(s.id)}
                        className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200/80 px-3 py-2 text-left transition hover:border-brand-200 hover:bg-brand-50/40"
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{s.name}</span>
                        <span className="shrink-0 text-[12px] font-bold text-ink-mute">
                          {s.dist != null ? `${s.dist.toFixed(1)} km` : '—'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* selected stop */}
          {selectedStop && (
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-extrabold tracking-tight text-ink">{selectedStop.name}</p>
                  {selectedStop.landmark && <p className="text-[12.5px] text-ink-mute">{selectedStop.landmark}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {selectedStop.code && <Badge tone="slate">{selectedStop.code}</Badge>}
                    {myStop?.id === selectedStop.id && <Badge tone="violet">Your stop</Badge>}
                  </div>
                </div>
              </div>

              <p className="mt-4 text-[12.5px] font-bold text-ink-soft">Buses near this stop</p>
              <div className="mt-2 space-y-1.5">
                {buses
                  .filter((b) => b.location)
                  .map((b) => ({ ...b, dist: distanceKm(b.location, selectedStop) }))
                  .sort((a, b) => a.dist - b.dist)
                  .slice(0, 4)
                  .map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBusId(b.id)}
                      className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200/80 px-3 py-2 text-left transition hover:border-brand-200 hover:bg-brand-50/40"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: b.route?.color || '#2547EB' }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{b.bus_number}</span>
                      <span className="shrink-0 text-[12px] font-bold text-ink-mute">{etaLabel(b.location, selectedStop)}</span>
                    </button>
                  ))}
                {buses.filter((b) => b.location).length === 0 && (
                  <p className="rounded-xl bg-slate-50 p-3 text-center text-[13px] text-ink-mute">
                    No buses are reporting a location yet.
                  </p>
                )}
              </div>

              <Button
                className="mt-3 w-full"
                size="sm"
                variant="soft"
                onClick={() => {
                  navigator.clipboard?.writeText(`${selectedStop.lat},${selectedStop.lng}`);
                }}
              >
                <Navigation className="h-3.5 w-3.5" /> Copy coordinates
              </Button>
            </Card>
          )}

          {/* browser / selector panel */}
          <Card className="p-4">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'buses', label: 'Buses', icon: Bus, count: buses.length },
                { value: 'stops', label: 'Stops', icon: MapPin, count: stops.length },
                { value: 'routes', label: 'Routes', icon: RouteIcon, count: routes.length },
              ]}
            />

            <div className="mt-3 max-h-[46vh] space-y-1.5 overflow-y-auto scrollbar-thin pr-1">
              {tab === 'buses' &&
                buses.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBusId(b.id === selectedBusId ? null : b.id)}
                    className={cx(
                      'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                      b.id === selectedBusId
                        ? 'border-brand-300 bg-brand-50'
                        : 'border-slate-200/80 hover:border-brand-200 hover:bg-slate-50'
                    )}
                  >
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white"
                      style={{ background: b.route?.color || '#2547EB' }}
                    >
                      <Bus className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-ink">{b.bus_number}</p>
                      <p className="truncate text-[11.5px] text-ink-mute">
                        {b.route?.name || 'No route'} · {timeAgo(b.location?.updated_at)}
                      </p>
                    </div>
                    {b.id === myBus?.id && <Badge tone="blue">Yours</Badge>}
                  </button>
                ))}

              {tab === 'stops' &&
                nearMe.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStopId(s.id === selectedStopId ? null : s.id)}
                    className={cx(
                      'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                      s.id === selectedStopId
                        ? 'border-sky-300 bg-sky-50'
                        : 'border-slate-200/80 hover:border-sky-200 hover:bg-slate-50'
                    )}
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-sky-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-ink">{s.name}</p>
                      <p className="truncate text-[11.5px] text-ink-mute">{s.landmark || 'Bus stop'}</p>
                    </div>
                    {myStop?.id === s.id && <Badge tone="violet">Yours</Badge>}
                  </button>
                ))}

              {tab === 'routes' &&
                routes.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setParams({ route: params.get('route') === r.id ? '' : r.id }, { replace: true })}
                    className={cx(
                      'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                      params.get('route') === r.id
                        ? 'border-brand-300 bg-brand-50'
                        : 'border-slate-200/80 hover:border-brand-200 hover:bg-slate-50'
                    )}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color || '#2547EB' }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-ink">{r.name}</p>
                      <p className="truncate text-[11.5px] text-ink-mute">
                        {r.start_point} → {r.end_point}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11.5px] font-bold text-ink-mute">{r.stops?.length || 0}</span>
                  </button>
                ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
