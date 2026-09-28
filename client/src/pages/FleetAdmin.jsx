import { useEffect, useState } from 'react';
import {
  Bus,
  Route as RouteIcon,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  X,
  Save,
  Radio,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useApi, useAction } from '../lib/hooks.js';
import api from '../lib/api.js';
import {
  Card,
  Button,
  Badge,
  EmptyState,
  Spinner,
  Modal,
  Field,
  Input,
  Select,
  Textarea,
  ConfirmDialog,
  Tabs,
} from '../components/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { cx } from '../lib/utils.js';

const TABS = [
  { value: 'buses', label: 'Buses', icon: Bus },
  { value: 'routes', label: 'Routes', icon: RouteIcon },
  { value: 'stops', label: 'Stops', icon: MapPin },
];

/** tab id -> the entity type it creates. */
const NEW_FOR_TAB = { buses: 'bus', routes: 'route', stops: 'stop' };

/* ----------------------------- Forms ----------------------------- */
const emptyBus = { bus_number: '', name: '', route_id: '', driver_id: '', capacity: 40, status: 'active' };
const emptyRoute = { name: '', code: '', description: '', start_point: '', end_point: '', color: '#2547EB' };
const emptyStop = { name: '', code: '', lat: 16.5062, lng: 80.648, landmark: '' };

export default function FleetAdmin() {
  const toast = useToast();
  const [tab, setTab] = useState('buses');
  const map = useApi('/api/live/map', { poll: 0 });
  const people = useApi('/api/admin/users?role=driver', { poll: 0 });
  const { run, busy } = useAction();

  const [editing, setEditing] = useState(null); // { type, item }
  const [form, setForm] = useState({});
  const [routeStops, setRouteStops] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [errors, setErrors] = useState({});

  const buses = map.data?.buses || [];
  const routes = map.data?.routes || [];
  const stops = map.data?.stops || [];
  const drivers = people.data?.users || [];

  const open = (type, item) => {
    setErrors({});
    setEditing({ type, item });
    if (type === 'bus') setForm(item ? { ...item, route_id: item.route_id || '', driver_id: item.driver_id || '' } : emptyBus);
    if (type === 'route') setForm(item ? { ...item } : emptyRoute);
    if (type === 'stop') setForm(item ? { ...item } : emptyStop);
    if (type === 'route') {
      setRouteStops(item ? (item.stops || []).map((s) => ({ stop_id: s.stop_id, time_offset_min: s.time_offset_min || 0 })) : []);
    }
  };

  const setF = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((p) => (p[k] ? { ...p, [k]: undefined } : p));
  };

  const close = () => {
    setEditing(null);
    setErrors({});
  };

  const save = async () => {
    if (!editing) return;
    const { type, item } = editing;
    try {
      if (type === 'bus') {
        const payload = { ...form, capacity: Number(form.capacity) || 40 };
        if (item) await run(() => api.fleet.updateBus(item.id, payload));
        else await run(() => api.fleet.createBus(payload));
      }
      if (type === 'route') {
        const saved = item
          ? (await run(() => api.fleet.updateRoute(item.id, form))).route
          : (await run(() => api.fleet.createRoute(form))).route;
        if (routeStops.length) {
          await run(() => api.fleet.setRouteStops(saved.id, routeStops));
        }
      }
      if (type === 'stop') {
        const payload = { ...form, lat: Number(form.lat), lng: Number(form.lng) };
        if (item) await run(() => api.fleet.updateStop(item.id, payload));
        else await run(() => api.fleet.createStop(payload));
      }
      toast.success(`${type[0].toUpperCase() + type.slice(1)} ${item ? 'updated' : 'created'}`);
      close();
      map.reload();
    } catch (e) {
      setErrors(e.fieldErrors || {});
      toast.error(e.message);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await run(() => {
        if (deleting.type === 'bus') return api.fleet.deleteBus(deleting.item.id);
        if (deleting.type === 'route') return api.fleet.deleteRoute(deleting.item.id);
        return api.fleet.deleteStop(deleting.item.id);
      });
      toast.success('Deleted');
      setDeleting(null);
      map.reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const moveStop = (i, dir) => {
    const next = [...routeStops];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setRouteStops(next);
  };

  const addStop = (stopId) => {
    if (!stopId || routeStops.some((s) => s.stop_id === stopId)) return;
    setRouteStops((r) => [...r, { stop_id: stopId, time_offset_min: r.length * 8 }]);
  };

  if (map.loading) return <Spinner label="Loading fleet" />;
  if (map.error)
    return <EmptyState icon={Radio} title="Cannot load fleet" message={map.error.message} action={<Button onClick={map.reload}>Retry</Button>} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-extrabold tracking-tight text-ink sm:text-2xl">Manage fleet</h1>
          <p className="text-[13px] text-ink-mute">Buses, routes and bus stops · everything is saved instantly</p>
        </div>
        <Button onClick={() => open(NEW_FOR_TAB[tab])}>
          <Plus className="h-4 w-4" /> New {NEW_FOR_TAB[tab]}
        </Button>
      </div>

      <Tabs value={tab} onChange={setTab} tabs={TABS.map((t) => ({ ...t, count: t.value === 'buses' ? buses.length : t.value === 'routes' ? routes.length : stops.length }))} />

      {/* ---------------------- BUSES ---------------------- */}
      {tab === 'buses' && (
        <Card className="overflow-hidden p-0">
          {buses.length === 0 ? (
            <EmptyState icon={Bus} title="No buses yet" message="Add your first bus to start tracking." action={<Button onClick={() => open('bus')}>Add bus</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="border-b border-slate-100 bg-slate-50/60">
                  <tr>
                    {['Bus', 'Name', 'Route', 'Driver', 'Capacity', 'Status', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[12px] font-bold uppercase tracking-wide text-ink-mute">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {buses.map((b) => (
                    <tr key={b.id} className="transition hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white"
                            style={{ background: b.route?.color || '#2547EB' }}
                          >
                            <Bus className="h-4 w-4" />
                          </span>
                          <span className="text-sm font-bold text-ink">{b.bus_number}</span>
                        </div>
                      </td>
                      <td className="table-cell">{b.name}</td>
                      <td className="table-cell">{b.route?.name || '—'}</td>
                      <td className="table-cell">{b.driver?.full_name || '—'}</td>
                      <td className="table-cell">{b.capacity}</td>
                      <td className="table-cell">
                        <Badge tone={b.status === 'active' ? 'green' : b.status === 'maintenance' ? 'amber' : 'slate'}>
                          {b.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => open('bus', b)} className="rounded-lg p-2 text-ink-mute transition hover:bg-brand-50 hover:text-brand-600" aria-label="Edit bus">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => setDeleting({ type: 'bus', item: b })} className="rounded-lg p-2 text-ink-mute transition hover:bg-rose-50 hover:text-rose-600" aria-label="Delete bus">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ---------------------- ROUTES ---------------------- */}
      {tab === 'routes' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {routes.length === 0 && (
            <Card className="sm:col-span-2 lg:col-span-3">
              <EmptyState icon={RouteIcon} title="No routes yet" message="Create a route and attach its stops." action={<Button onClick={() => open('route')}>Add route</Button>} />
            </Card>
          )}
          {routes.map((r) => (
            <Card key={r.id} className="p-5 card-hover">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: r.color }} />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-extrabold tracking-tight text-ink">{r.name}</p>
                    {r.code && <p className="text-[12px] font-semibold text-ink-mute">{r.code}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => open('route', r)} className="rounded-lg p-1.5 text-ink-mute transition hover:bg-brand-50 hover:text-brand-600" aria-label="Edit route">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setDeleting({ type: 'route', item: r })} className="rounded-lg p-1.5 text-ink-mute transition hover:bg-rose-50 hover:text-rose-600" aria-label="Delete route">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {r.description && <p className="mt-2 line-clamp-2 text-[12.5px] text-ink-mute">{r.description}</p>}
              <p className="mt-2 text-[12.5px] font-semibold text-ink-soft">
                {r.start_point} → {r.end_point}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone="blue">{r.stops?.length || 0} stops</Badge>
                <Badge tone="slate">{buses.filter((b) => b.route_id === r.id).length} buses</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ---------------------- STOPS ---------------------- */}
      {tab === 'stops' && (
        <Card className="overflow-hidden p-0">
          {stops.length === 0 ? (
            <EmptyState icon={MapPin} title="No stops yet" message="Add the stops your buses stop at." action={<Button onClick={() => open('stop')}>Add stop</Button>} />
          ) : (
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {stops.map((s) => (
                <div key={s.id} className="rounded-2xl border border-slate-200/80 p-4 transition hover:border-brand-200 hover:shadow-soft">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-600">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink">{s.name}</p>
                        {s.code && <p className="text-[11.5px] font-semibold text-ink-mute">{s.code}</p>}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => open('stop', s)} className="rounded-lg p-1.5 text-ink-mute transition hover:bg-brand-50 hover:text-brand-600" aria-label="Edit stop">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setDeleting({ type: 'stop', item: s })} className="rounded-lg p-1.5 text-ink-mute transition hover:bg-rose-50 hover:text-rose-600" aria-label="Delete stop">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {s.landmark && <p className="mt-2 truncate text-[12px] text-ink-mute">{s.landmark}</p>}
                  <p className="mt-1.5 text-[11.5px] font-semibold text-ink-mute">
                    {Number(s.lat).toFixed(4)}, {Number(s.lng).toFixed(4)}
                  </p>
                  <p className="mt-2 text-[11.5px] font-bold text-brand-600">
                    Used by {s.route_ids?.length || 0} route{(s.route_ids?.length || 0) === 1 ? '' : 's'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ---------------------- EDIT MODAL ---------------------- */}
      <Modal
        open={!!editing}
        onClose={close}
        size={editing?.type === 'route' ? 'lg' : 'md'}
        title={
          editing
            ? `${editing.item ? 'Edit' : 'New'} ${editing.type === 'bus' ? 'bus' : editing.type === 'route' ? 'route' : 'stop'}`
            : ''
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close}>
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button onClick={save} loading={busy}>
              <Save className="h-4 w-4" /> Save
            </Button>
          </div>
        }
      >
        {editing?.type === 'bus' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bus number" error={errors.bus_number}>
              <Input value={form.bus_number} onChange={setF('bus_number')} placeholder="AP-16-AB-1234" />
            </Field>
            <Field label="Display name" error={errors.name}>
              <Input value={form.name} onChange={setF('name')} placeholder="Surya" />
            </Field>
            <Field label="Route">
              <Select value={form.route_id} onChange={setF('route_id')}>
                <option value="">No route</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Driver">
              <Select value={form.driver_id} onChange={setF('driver_id')}>
                <option value="">Unassigned</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.full_name} (@{d.username})</option>
                ))}
              </Select>
            </Field>
            <Field label="Capacity">
              <Input type="number" min="1" value={form.capacity} onChange={setF('capacity')} />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={setF('status')}>
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="inactive">Inactive</option>
              </Select>
            </Field>
          </div>
        )}

        {editing?.type === 'route' && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Route name" error={errors.name}>
                <Input value={form.name} onChange={setF('name')} placeholder="Guntur → College Highway" />
              </Field>
              <Field label="Code" error={errors.code}>
                <Input value={form.code} onChange={setF('code')} placeholder="RT-A" />
              </Field>
              <Field label="Start point">
                <Input value={form.start_point} onChange={setF('start_point')} placeholder="Guntur Bus Stand" />
              </Field>
              <Field label="End point">
                <Input value={form.end_point} onChange={setF('end_point')} placeholder="Loyola College" />
              </Field>
            </div>
            <Field label="Description">
              <Textarea rows={2} value={form.description} onChange={setF('description')} placeholder="Direct NH16 service…" />
            </Field>
            <Field label="Colour">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.color}
                  onChange={setF('color')}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white"
                />
                <Input value={form.color} onChange={setF('color')} className="max-w-[160px]" />
              </div>
            </Field>

            <div>
              <p className="label">Stops in order</p>
              {routeStops.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-3 text-[13px] text-ink-mute">
                  No stops yet. Add them below — the order here is the order on the map.
                </p>
              ) : (
                <ol className="space-y-1.5">
                  {routeStops.map((s, i) => {
                    const stop = stops.find((x) => x.id === s.stop_id);
                    return (
                      <li key={s.stop_id} className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-2.5 py-2">
                        <GripVertical className="h-4 w-4 shrink-0 text-ink-mute" />
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
                          {stop?.name || 'Unknown stop'}
                        </span>
                        <Input
                          type="number"
                          value={s.time_offset_min}
                          onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            setRouteStops((r) => r.map((x, j) => (j === i ? { ...x, time_offset_min: v } : x)));
                          }}
                          className="w-20 px-2 py-1.5 text-center text-[12.5px]"
                          title="Minutes from route start"
                        />
                        <button onClick={() => moveStop(i, -1)} className="rounded-lg p-1.5 text-ink-mute hover:bg-slate-100" aria-label="Move up">
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => moveStop(i, 1)} className="rounded-lg p-1.5 text-ink-mute hover:bg-slate-100" aria-label="Move down">
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setRouteStops((r) => r.filter((_, j) => j !== i))}
                          className="rounded-lg p-1.5 text-ink-mute hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Remove stop"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
              <Select
                className="mt-2.5"
                value=""
                onChange={(e) => {
                  addStop(e.target.value);
                  e.target.value = '';
                }}
              >
                <option value="">+ Add a stop to this route…</option>
                {stops
                  .filter((s) => !routeStops.some((r) => r.stop_id === s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
              </Select>
            </div>
          </div>
        )}

        {editing?.type === 'stop' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Stop name" error={errors.name} className="sm:col-span-2">
              <Input value={form.name} onChange={setF('name')} placeholder="Benz Circle" />
            </Field>
            <Field label="Code">
              <Input value={form.code || ''} onChange={setF('code')} placeholder="BZ01" />
            </Field>
            <Field label="Landmark">
              <Input value={form.landmark || ''} onChange={setF('landmark')} placeholder="Near the petrol pump" />
            </Field>
            <Field label="Latitude" error={errors.lat} hint="Open Google Maps → right-click the spot → copy the number">
              <Input type="number" step="0.0001" value={form.lat} onChange={setF('lat')} />
            </Field>
            <Field label="Longitude" error={errors.lng}>
              <Input type="number" step="0.0001" value={form.lng} onChange={setF('lng')} />
            </Field>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        busy={busy}
        title={`Delete this ${deleting?.type}?`}
        message={`"${deleting?.item?.bus_number || deleting?.item?.name || ''}" will be removed permanently. Related route links will be cleared too.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
