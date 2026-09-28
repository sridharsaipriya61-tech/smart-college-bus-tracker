import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Bus, Navigation, MapPin } from 'lucide-react';
import { VJ, cx, clockTime, timeAgo, isFresh } from '../lib/utils.js';

const TILE = 'https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png';
const ATTRIB =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const ROUTE_COLORS = ['#2547EB', '#0EA5E9', '#7C3AED', '#0D9488', '#F59E0B', '#DB2777', '#16A34A'];

/** Bus pin: a rounded tile with a live pulse when the ping is fresh. */
const busIcon = (color, live, selected) =>
  L.divIcon({
    className: 'map-pin',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -20],
    html: `
      <div style="position:relative;display:grid;place-items:center;width:38px;height:38px">
        ${
          live
            ? `<span style="position:absolute;inset:2px;border-radius:14px;background:${color};opacity:.45;animation:pulse-ring 2s cubic-bezier(.4,0,.6,1) infinite"></span>`
            : ''
        }
        <div class="pin-bus" style="background:${color};${
          selected ? `transform:scale(1.12);box-shadow:0 0 0 5px ${color}33, 0 10px 20px -6px rgb(15 23 42/.5);` : ''
        }">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 17V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v11"/><path d="M4 17h16"/><path d="M6 17v2"/><path d="M18 17v2"/><path d="M8 9h8"/><path d="M8 13h5"/>
          </svg>
        </div>
      </div>`,
  });

const stopIcon = (selected) =>
  L.divIcon({
    className: 'map-pin',
    iconSize: selected ? [24, 24] : [20, 20],
    iconAnchor: selected ? [12, 12] : [10, 10],
    popupAnchor: [0, -12],
    html: `<div class="pin-stop${selected ? ' pin-selected' : ''}"></div>`,
  });

/** Keeps the viewport in sync with whatever the page is focused on. */
function Focus({ points, trigger }) {
  const map = useMap();
  const last = useRef(null);
  useEffect(() => {
    const key = JSON.stringify(points);
    if (!key || last.current === key) return;
    last.current = key;
    if (points.length === 1) {
      map.flyTo(points[0], Math.max(map.getZoom(), 14), { duration: 0.8 });
    } else if (points.length > 1) {
      map.flyToBounds(L.latLngBounds(points), { padding: [56, 56], duration: 0.8, maxZoom: 15 });
    }
  }, [map, points, trigger]);
  return null;
}

function Recenter({ center, zoom = 13, trigger }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom, { duration: 0.8 });
  }, [map, center, zoom, trigger]);
  return null;
}

/** Enables tap-to-pick mode (used by drivers who cannot share device GPS). */
function ClickCapture({ onPick }) {
  const map = useMap();
  useEffect(() => {
    if (!onPick) return undefined;
    const handler = (e) => onPick(e.latlng);
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [map, onPick]);
  return null;
}

export default function LiveMap({
  buses = [],
  stops = [],
  routes = [],
  selectedBusId,
  selectedStopId,
  selectedRouteId,
  myStopId,
  myBusId,
  onSelectBus,
  onSelectStop,
  onMapClick,
  focus = 'all',
  height = 'h-[420px]',
  className,
}) {
  const colorFor = (bus, i) => {
    const route = routes.find((r) => r.id === bus.route_id);
    if (route?.color) return route.color;
    return ROUTE_COLORS[i % ROUTE_COLORS.length];
  };

  const activeRoute = routes.find((r) => r.id === selectedRouteId) || null;

  const visibleRoutes = useMemo(() => {
    if (activeRoute) return [activeRoute];
    if (selectedBusId) {
      const b = buses.find((x) => x.id === selectedBusId);
      if (b) {
        const r = routes.find((x) => x.id === b.route_id);
        if (r) return [r];
      }
    }
    return [];
  }, [activeRoute, selectedBusId, buses, routes]);

  const focusPoints = useMemo(() => {
    if (focus === 'all') {
      const pts = buses.filter((b) => b.location).map((b) => [b.location.lat, b.location.lng]);
      if (pts.length) return pts;
      return stops.length ? stops.map((s) => [s.lat, s.lng]) : [];
    }
    if (focus === 'bus' && selectedBusId) {
      const b = buses.find((x) => x.id === selectedBusId);
      return b?.location ? [[b.location.lat, b.location.lng]] : [];
    }
    if (focus === 'stop' && selectedStopId) {
      const s = stops.find((x) => x.id === selectedStopId);
      return s ? [[s.lat, s.lng]] : [];
    }
    if (focus === 'route' && activeRoute) return activeRoute.stops.map((s) => [s.stop.lat, s.stop.lng]);
    return [];
  }, [focus, selectedBusId, selectedStopId, selectedStopId, activeRoute, buses, stops]);

  const initialCenter = focusPoints.length === 1 ? focusPoints[0] : [VJ.lat, VJ.lng];

  return (
    <div className={cx('relative overflow-hidden rounded-2xl border border-slate-200/70 shadow-soft', height, className)}>
      <MapContainer
        center={initialCenter}
        zoom={focusPoints.length === 1 ? 14 : 12}
        scrollWheelZoom
        zoomControl
        className="h-full w-full"
        attributionControl
      >
        <TileLayer url={TILE} attribution={ATTRIB} maxZoom={19} detectRetina />
        <Focus points={focusPoints} trigger={focus} />
        <Recenter center={null} trigger={focus} />
        <ClickCapture onPick={onMapClick} />

        {/* route line for the selected bus / route */}
        {visibleRoutes.map((r) => {
          const line = r.stops.filter((s) => s.stop).map((s) => [s.stop.lat, s.stop.lng]);
          if (line.length < 2) return null;
          return (
            <Polyline
              key={r.id}
              positions={line}
              pathOptions={{ color: r.color || '#2547EB', weight: 5, opacity: 0.9, lineJoin: 'round' }}
            />
          );
        })}

        {/* stops */}
        {stops.map((s) => {
          const isSelected = s.id === selectedStopId;
          const isMine = s.id === myStopId;
          return (
            <Marker
              key={s.id}
              position={[s.lat, s.lng]}
              icon={stopIcon(isSelected)}
              eventHandlers={{ click: () => onSelectStop?.(s) }}
              zIndexOffset={isSelected ? 700 : 100}
            >
              <Popup closeButton={false} minWidth={210}>
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5 text-[13px] font-bold text-slate-900">
                    <MapPin className="h-3.5 w-3.5 text-sky-500" />
                    {s.name}
                  </p>
                  {s.landmark && <p className="text-[12px] text-slate-500">{s.landmark}</p>}
                  {s.code && <p className="text-[11px] font-semibold text-slate-400">{s.code}</p>}
                  {isMine && (
                    <p className="mt-1 inline-block rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] font-bold text-violet-700">
                      Your pickup stop
                    </p>
                  )}
                  {onSelectStop && (
                    <button
                      onClick={() => onSelectStop(s)}
                      className="mt-1.5 w-full rounded-lg bg-blue-600 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-700"
                    >
                      View this stop
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* live buses */}
        {buses.map((b, i) => {
          if (!b.location) return null;
          const live = isFresh(b.location.updated_at);
          const color = colorFor(b, i);
          const isMine = b.id === myBusId;
          const isSelected = b.id === selectedBusId;
          return (
            <Marker
              key={b.id}
              position={[b.location.lat, b.location.lng]}
              icon={busIcon(color, live, isSelected || isMine)}
              zIndexOffset={isSelected || isMine ? 900 : 400}
              eventHandlers={{ click: () => onSelectBus?.(b) }}
            >
              <Popup closeButton={false} minWidth={230}>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="grid h-7 w-7 place-items-center rounded-lg text-white"
                      style={{ background: color }}
                    >
                      <Bus className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-[13px] font-bold leading-tight text-slate-900">{b.bus_number}</p>
                      <p className="text-[11px] text-slate-500">{b.name}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cx(
                        'rounded-md px-1.5 py-0.5 text-[11px] font-bold',
                        live ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {live ? 'LIVE' : timeAgo(b.location.updated_at)}
                    </span>
                    {b.route && (
                      <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">
                        {b.route.name}
                      </span>
                    )}
                    {b.eta && (
                      <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
                        ETA {b.eta.minutes} min
                      </span>
                    )}
                  </div>
                  {b.driver && <p className="text-[12px] text-slate-600">Driver: {b.driver.full_name}</p>}
                  <p className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Navigation className="h-3 w-3" />
                    Updated {clockTime(b.location.updated_at)}
                  </p>
                  {onSelectBus && (
                    <button
                      onClick={() => onSelectBus(b)}
                      className="mt-1 w-full rounded-lg bg-blue-600 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-700"
                    >
                      Track this bus
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* accuracy ring for the driver's own fresh ping */}
        {myBusId &&
          buses
            .filter((b) => b.id === myBusId && b.location)
            .map((b) => (
              <Circle
                key={`ring-${b.id}`}
                center={[b.location.lat, b.location.lng]}
                radius={220}
                pathOptions={{ color: b.location.status === 'breakdown' ? '#E11D48' : '#10B981', weight: 1, fillOpacity: 0.08 }}
              />
            ))}
      </MapContainer>

      {/* legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex flex-col gap-1.5 rounded-xl bg-white/90 px-2.5 py-2 text-[11px] font-semibold text-ink-soft shadow-soft backdrop-blur">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /> Live bus
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-sky-500 bg-white" /> Bus stop
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-violet-500 bg-violet-500" /> Your stop
        </span>
      </div>
    </div>
  );
}
