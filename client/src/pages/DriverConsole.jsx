import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Navigation,
  Play,
  Square,
  MapPin,
  Radio,
  Clock,
  Gauge,
  Bus as BusIcon,
  Route as RouteIcon,
  Send,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  RotateCcw,
  Crosshair,
  Loader2,
} from 'lucide-react';
import { useApi, useAction, useInterval } from '../lib/hooks.js';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../lib/api.js';
import LiveMap from '../components/LiveMap.jsx';
import { Card, Button, Badge, Spinner, Field, Input, Textarea, Select, EmptyState } from '../components/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { cx, timeAgo, clockTime, isFresh } from '../lib/utils.js';

const STATUSES = [
  { id: 'on_time', label: 'On time', icon: CheckCircle2, tone: 'green' },
  { id: 'delayed', label: 'Delayed', icon: Clock, tone: 'amber' },
  { id: 'breakdown', label: 'Breakdown', icon: Wrench, tone: 'rose' },
  { id: 'returning', label: 'Returning', icon: RotateCcw, tone: 'slate' },
];

const PING_MS = 15000;

export default function DriverConsole() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useApi('/api/live/map', { poll: 10000 });
  const profile = useApi('/api/profile', { poll: 0 });

  const [sharing, setSharing] = useState(false);
  const [gpsState, setGpsState] = useState('idle'); // idle | locating | live | denied | unsupported
  const [pos, setPos] = useState(null);
  const [status, setStatus] = useState('on_time');
  const [manual, setManual] = useState(null);
  const [event, setEvent] = useState({ event_type: 'note', note: '', passengers: '' });
  const [sending, setSending] = useState(false);
  const { run, busy } = useAction();
  const watchId = useRef(null);
  const lastPing = useRef(null);

  const bus = data?.my_bus;
  const route = data?.routes?.find((r) => r.id === bus?.route_id) || null;
  const location = bus?.location;

  // Pick the bus this driver is assigned to (or driving).
  const [busId, setBusId] = useState(user.bus_id || '');
  useEffect(() => {
    if (bus?.id) setBusId(bus.id);
  }, [bus?.id]);

  const sendPing = useCallback(
    async (lat, lng, extra = {}) => {
      if (!busId) throw new Error('No bus assigned to your account');
      await api.live.shareLocation({ bus_id: busId, lat, lng, status, ...extra });
      lastPing.current = { lat, lng, at: Date.now() };
      await reload();
    },
    [busId, status, reload]
  );

  const shareOnce = useCallback(async () => {
    if (!busId) return toast.error('No bus is assigned to you yet. Ask the admin.');
    try {
      let coords = manual;
      if (!coords && navigator.geolocation) {
        coords = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, speed: p.coords.speed || 0, heading: p.coords.heading || 0 }),
            () => reject(new Error('Location permission denied')),
            { enableHighAccuracy: true, timeout: 12000 }
          );
        });
      }
      if (!coords) return toast.error('Tap your position on the map first');
      setSending(true);
      await sendPing(coords.lat, coords.lng, { speed: coords.speed, heading: coords.heading });
      toast.success('Location shared with all students');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  }, [busId, manual, sendPing, toast]);

  // Auto-share while tracking.
  useInterval(
    () => {
      if (sharing && lastPing.current) {
        sendPing(lastPing.current.lat, lastPing.current.lng).catch(() => {});
      }
    },
    sharing ? PING_MS : null
  );

  const startSharing = () => {
    if (!busId) return toast.error('No bus assigned to you yet');
    if (!navigator.geolocation) {
      setGpsState('unsupported');
      return toast.error('This device has no GPS. Tap your position on the map to share manually.');
    }
    setGpsState('locating');
    watchId.current = navigator.geolocation.watchPosition(
      async (p) => {
        const coords = { lat: p.coords.latitude, lng: p.coords.longitude, speed: p.coords.speed || 0, heading: p.coords.heading || 0 };
        setPos(coords);
        setGpsState('live');
        try {
          await sendPing(coords.lat, coords.lng, { speed: coords.speed, heading: coords.heading });
        } catch (e) {
          console.error(e);
        }
      },
      () => {
        setGpsState('denied');
        setSharing(false);
        toast.error('Location permission denied — you can still tap the map to share manually.');
      },
      { enableHighAccuracy: true, maximumAge: 8000, timeout: 20000 }
    );
    setSharing(true);
    toast.info('Live sharing started — students can now see your bus');
  };

  const stopSharing = () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setSharing(false);
    setGpsState('idle');
  };

  useEffect(() => () => stopSharing(), []);

  const claimBus = async (id) => {
    try {
      const res = await run(() => api.profile.update({ bus_id: id || null }));
      setUser({ ...user, ...res.user });
      setBusId(id || '');
      await reload();
      toast.success(id ? 'Bus assigned to your account' : 'Bus unassigned');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const addEvent = async () => {
    if (!event.note.trim()) return toast.error('Write a short note first');
    try {
      await run(() => api.live.addEvent({ bus_id: busId || null, ...event, passengers: Number(event.passengers || 0) }));
      setEvent({ event_type: 'note', note: '', passengers: '' });
      await reload();
      toast.success('Trip event added');
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loading) return <Spinner label="Loading your bus" />;
  if (error)
    return <EmptyState icon={Radio} title="Cannot load" message={error.message} action={<Button onClick={reload}>Retry</Button>} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">My bus</h1>
          <p className="text-[13px] text-ink-mute">Share your live position so students can find you.</p>
        </div>
        {sharing ? (
          <Button variant="danger" onClick={stopSharing}>
            <Square className="h-4 w-4" /> Stop sharing
          </Button>
        ) : (
          <Button onClick={startSharing}>
            <Play className="h-4 w-4" /> Start live sharing
          </Button>
        )}
      </div>

      {gpsState === 'denied' && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-[13px] leading-relaxed text-amber-900">
            Location access was blocked. Tap anywhere on the map below to set your position manually, then press
            “Share once”.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* map */}
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-2 px-4 pt-4">
            <p className="text-[13px] font-bold text-ink-soft">Tap the map to set your position</p>
            {pos && (
              <Badge tone="green">
                <Crosshair className="h-3 w-3" /> {pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}
              </Badge>
            )}
          </div>
          <div className="p-3">
            <LiveMap
              buses={data?.buses || []}
              stops={data?.stops || []}
              routes={data?.routes || []}
              selectedRouteId={route?.id}
              myBusId={bus?.id}
              onMapClick={(latlng) => {
                setManual({ lat: latlng.lat, lng: latlng.lng });
                setPos({ lat: latlng.lat, lng: latlng.lng });
              }}
              focus={route ? 'route' : 'all'}
              height="h-[320px] sm:h-[420px] lg:h-[calc(100vh-20rem)] lg:min-h-[420px]"
            />
          </div>
          <div className="flex flex-wrap gap-2 px-3 pb-3">
            <Button className="flex-1" onClick={shareOnce} loading={sending} disabled={!busId}>
              <Navigation className="h-4 w-4" /> Share location once
            </Button>
            {(manual || pos) && (
              <Button variant="outline" onClick={() => { setManual(null); setPos(null); }}>
                Clear
              </Button>
            )}
          </div>
        </Card>

        {/* side panel */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-soft"
                  style={{ background: route?.color || '#2547EB' }}
                >
                  <BusIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-extrabold tracking-tight text-ink">
                    {bus ? bus.bus_number : 'No bus assigned'}
                  </p>
                  <p className="truncate text-[12.5px] text-ink-mute">{bus?.name || 'Ask the admin to assign one'}</p>
                </div>
              </div>
              <Badge tone={isFresh(location?.updated_at) ? 'green' : 'slate'}>
                {sharing ? 'Sharing' : location ? timeAgo(location.updated_at) : 'Idle'}
              </Badge>
            </div>

            {location && (
              <div className="mt-4 grid grid-cols-3 gap-2.5 text-center text-[12.5px]">
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <Gauge className="mx-auto h-4 w-4 text-ink-mute" />
                  <p className="mt-1 font-bold text-ink">{Math.round(location.speed || 0)} km/h</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <Clock className="mx-auto h-4 w-4 text-ink-mute" />
                  <p className="mt-1 font-bold text-ink">{clockTime(location.updated_at)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <Radio className="mx-auto h-4 w-4 text-ink-mute" />
                  <p className="mt-1 font-bold capitalize text-ink">
                    {(location.status || '').replace('_', ' ')}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4">
              <p className="text-[12.5px] font-bold text-ink-soft">Bus status</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStatus(s.id)}
                    className={cx(
                      'flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-[12.5px] font-bold transition',
                      status === s.id
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-slate-200 text-ink-soft hover:border-slate-300'
                    )}
                  >
                    <s.icon className="h-3.5 w-3.5" /> {s.label}
                  </button>
                ))}
              </div>
              {location && status !== location.status && (
                <Button
                  size="sm"
                  variant="soft"
                  className="mt-2.5 w-full"
                  loading={busy}
                  onClick={async () => {
                    try {
                      await run(() => api.live.shareLocation({ bus_id: busId, lat: location.lat, lng: location.lng, status }));
                      await reload();
                      toast.success('Status updated');
                    } catch (e) {
                      toast.error(e.message);
                    }
                  }}
                >
                  Publish this status
                </Button>
              )}
            </div>
          </Card>

          {/* bus picker */}
          <Card className="p-5">
            <p className="text-[12.5px] font-bold text-ink-soft">Bus assigned to me</p>
            <Field label="" className="mt-2">
              <Select value={busId} onChange={(e) => setBusId(e.target.value)}>
                <option value="">Select a bus…</option>
                {(data?.buses || []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bus_number} — {b.route?.name || b.name}
                  </option>
                ))}
              </Select>
            </Field>
            {busId !== (user.bus_id || '') && (
              <Button size="sm" variant="soft" className="mt-2.5 w-full" onClick={() => claimBus(busId)} loading={busy}>
                Save assignment
              </Button>
            )}
          </Card>

          {/* route */}
          {route && (
            <Card className="p-5">
              <p className="flex items-center gap-2 text-[12.5px] font-bold text-ink-soft">
                <RouteIcon className="h-4 w-4" /> Today&apos;s route
              </p>
              <p className="mt-1 text-base font-extrabold text-ink">{route.name}</p>
              <p className="text-[12.5px] text-ink-mute">
                {route.start_point} → {route.end_point}
              </p>
              <ol className="mt-3 space-y-1.5">
                {(route.stops || []).map((s, i) => (
                  <li key={s.id} className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2">
                    <span
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10.5px] font-bold text-white"
                      style={{ background: route.color || '#2547EB' }}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{s.stop.name}</span>
                    {s.time_offset_min > 0 && <span className="text-[11.5px] font-bold text-ink-mute">+{s.time_offset_min}m</span>}
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {/* trip log */}
          <Card className="p-5">
            <p className="text-[12.5px] font-bold text-ink-soft">Add a trip update</p>
            <div className="mt-3 space-y-3">
              <Select value={event.event_type} onChange={(e) => setEvent((v) => ({ ...v, event_type: e.target.value }))}>
                <option value="note">General note</option>
                <option value="delay">Delay</option>
                <option value="breakdown">Breakdown</option>
                <option value="boarded">Boarded / dropped</option>
                <option value="return">Returning to depot</option>
              </Select>
              <Textarea
                rows={3}
                placeholder="e.g. Running 8 minutes late due to traffic at Benz Circle"
                value={event.note}
                onChange={(e) => setEvent((v) => ({ ...v, note: e.target.value }))}
              />
              <Input
                type="number"
                min="0"
                placeholder="Passengers on board (optional)"
                value={event.passengers}
                onChange={(e) => setEvent((v) => ({ ...v, passengers: e.target.value }))}
              />
              <Button className="w-full" onClick={addEvent} loading={busy}>
                <Send className="h-4 w-4" /> Add update
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
