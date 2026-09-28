import express from 'express';
import { supabaseAdmin, q, HttpError, bad } from '../services/supabaseAdmin.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/error.js';
import { str, requireBody } from '../middleware/validate.js';

const router = express.Router();
router.use(requireAuth);

const num = (v, d = null) => (v === '' || v === undefined || v === null ? d : Number(v));
const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));

/* ====================== BUS STOPS ====================== */
const stopBody = (b, { partial = false } = {}) => {
  if (!partial) requireBody(b, ['name', 'lat', 'lng']);
  const out = {};
  if (!partial || b.name !== undefined) {
    if (!str(b.name)) throw bad('Stop name is required', { name: 'Required' });
    out.name = str(b.name);
  }
  if (b.lat !== undefined || b.lng !== undefined) {
    const lat = num(b.lat);
    const lng = num(b.lng);
    if (Number.isNaN(lat) || lat < -90 || lat > 90)
      throw bad('Latitude must be between -90 and 90', { lat: 'Invalid latitude' });
    if (Number.isNaN(lng) || lng < -180 || lng > 180)
      throw bad('Longitude must be between -180 and 180', { lng: 'Invalid longitude' });
    out.lat = lat;
    out.lng = lng;
  }
  if (b.code !== undefined) out.code = str(b.code) || null;
  if (b.landmark !== undefined) out.landmark = str(b.landmark) || null;
  return out;
};

router.get(
  '/stops',
  asyncRoute(async (_req, res) => {
    const stops = await q(supabaseAdmin.from('bus_stops').select('*').order('name'));
    const links = await q(
      supabaseAdmin.from('route_stops').select('route_id, stop_id, stop_order, time_offset_min')
    );
    const byStop = {};
    for (const l of links) {
      (byStop[l.stop_id] ||= []).push(l.route_id);
    }
    res.json({ stops: stops.map((s) => ({ ...s, route_ids: byStop[s.id] || [] })) });
  })
);

router.post(
  '/stops',
  allowRoles('admin'),
  asyncRoute(async (req, res) => {
    const { data, error } = await supabaseAdmin.from('bus_stops').insert(stopBody(req.body)).select('*').single();
    if (error) throw new HttpError(400, error.message);
    res.status(201).json({ stop: data });
  })
);

router.patch(
  '/stops/:id',
  allowRoles('admin'),
  asyncRoute(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('bus_stops')
      .update(stopBody(req.body, { partial: true }))
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw new HttpError(400, error.message);
    res.json({ stop: data });
  })
);

router.delete(
  '/stops/:id',
  allowRoles('admin'),
  asyncRoute(async (req, res) => {
    const { error } = await supabaseAdmin.from('bus_stops').delete().eq('id', req.params.id);
    if (error) throw new HttpError(400, error.message);
    res.json({ ok: true });
  })
);

/* ====================== ROUTES ====================== */
const routeBody = (b, { partial = false } = {}) => {
  if (!partial) requireBody(b, ['name']);
  const out = {};
  if (!partial || b.name !== undefined) {
    if (!str(b.name)) throw bad('Route name is required', { name: 'Required' });
    out.name = str(b.name);
  }
  if (b.code !== undefined) out.code = str(b.code) || null;
  if (b.description !== undefined) out.description = str(b.description) || null;
  if (b.start_point !== undefined) out.start_point = str(b.start_point) || null;
  if (b.end_point !== undefined) out.end_point = str(b.end_point) || null;
  if (b.color !== undefined) out.color = str(b.color) || '#2563eb';
  return out;
};

/** Attach ordered stops to each route (manual join — no FK-embedding surprises). */
export async function withRouteStops(routes) {
  if (!routes.length) return [];
  const ids = routes.map((r) => r.id);
  const links = await q(
    supabaseAdmin
      .from('route_stops')
      .select('*')
      .in('route_id', ids)
      .order('stop_order')
  );
  const stopIds = [...new Set(links.map((l) => l.stop_id))];
  const stops = stopIds.length
    ? await q(supabaseAdmin.from('bus_stops').select('*').in('id', stopIds))
    : [];
  const stopMap = Object.fromEntries(stops.map((s) => [s.id, s]));
  const byRoute = {};
  for (const l of links) (byRoute[l.route_id] ||= []).push({ ...l, stop: stopMap[l.stop_id] });
  return routes.map((r) => ({ ...r, stops: (byRoute[r.id] || []).filter((l) => l.stop) }));
}

router.get(
  '/routes',
  asyncRoute(async (req, res) => {
    const query = supabaseAdmin.from('routes').select('*').order('name');
    if (req.query.mine === '1' && req.user.role === 'driver' && req.user.bus_id) {
      const bus = await q(supabaseAdmin.from('buses').select('route_id').eq('id', req.user.bus_id).maybeSingle());
      if (!bus?.route_id) return res.json({ routes: [] });
      const route = await q(supabaseAdmin.from('routes').select('*').eq('id', bus.route_id).maybeSingle());
      return res.json({ routes: route ? await withRouteStops([route]) : [] });
    }
    const routes = await q(query);
    res.json({ routes: await withRouteStops(routes) });
  })
);

router.get(
  '/routes/:id',
  asyncRoute(async (req, res) => {
    const route = await q(supabaseAdmin.from('routes').select('*').eq('id', req.params.id).maybeSingle());
    if (!route) throw new HttpError(404, 'Route not found');
    const [full] = await withRouteStops([route]);
    const buses = await q(supabaseAdmin.from('buses').select('*').eq('route_id', route.id));
    res.json({ route: full, buses });
  })
);

router.post(
  '/routes',
  allowRoles('admin'),
  asyncRoute(async (req, res) => {
    const { data, error } = await supabaseAdmin.from('routes').insert(routeBody(req.body)).select('*').single();
    if (error) throw new HttpError(400, error.message);
    res.status(201).json({ route: data });
  })
);

router.patch(
  '/routes/:id',
  allowRoles('admin'),
  asyncRoute(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('routes')
      .update(routeBody(req.body, { partial: true }))
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw new HttpError(400, error.message);
    res.json({ route: data });
  })
);

router.delete(
  '/routes/:id',
  allowRoles('admin'),
  asyncRoute(async (req, res) => {
    const { error } = await supabaseAdmin.from('routes').delete().eq('id', req.params.id);
    if (error) throw new HttpError(400, error.message);
    res.json({ ok: true });
  })
);

/** Replace the ordered stop list of a route in one call. */
router.put(
  '/routes/:id/stops',
  allowRoles('admin'),
  asyncRoute(async (req, res) => {
    const stops = Array.isArray(req.body.stops) ? req.body.stops : [];
    for (const s of stops) {
      if (!isUuid(s.stop_id)) throw bad('Each stop entry needs a valid stop_id');
    }
    await q(supabaseAdmin.from('route_stops').delete().eq('route_id', req.params.id));
    if (stops.length) {
      const rows = stops.map((s, i) => ({
        route_id: req.params.id,
        stop_id: s.stop_id,
        stop_order: i + 1,
        time_offset_min: Number(s.time_offset_min || 0),
      }));
      const { error } = await supabaseAdmin.from('route_stops').insert(rows);
      if (error) throw new HttpError(400, error.message);
    }
    const route = await q(supabaseAdmin.from('routes').select('*').eq('id', req.params.id).maybeSingle());
    const [full] = await withRouteStops([route]);
    res.json({ route: full });
  })
);

/* ====================== BUSES ====================== */
const busBody = (b, { partial = false } = {}) => {
  if (!partial) requireBody(b, ['bus_number', 'name']);
  const out = {};
  if (!partial || b.bus_number !== undefined) {
    if (!str(b.bus_number)) throw bad('Bus number is required', { bus_number: 'Required' });
    out.bus_number = str(b.bus_number);
  }
  if (!partial || b.name !== undefined) {
    if (!str(b.name)) throw bad('Bus name is required', { name: 'Required' });
    out.name = str(b.name);
  }
  if (b.route_id !== undefined) out.route_id = isUuid(b.route_id) ? b.route_id : null;
  if (b.driver_id !== undefined) out.driver_id = isUuid(b.driver_id) ? b.driver_id : null;
  if (b.capacity !== undefined) out.capacity = num(b.capacity, 40) ?? 40;
  if (b.status !== undefined)
    out.status = ['active', 'maintenance', 'inactive'].includes(b.status) ? b.status : 'active';
  return out;
};

router.get(
  '/buses',
  asyncRoute(async (req, res) => {
    let query = supabaseAdmin.from('buses').select('*').order('bus_number');
    if (req.query.mine === '1' && req.user.bus_id) query = query.eq('id', req.user.bus_id);
    const buses = await q(query);
    const [locations, routes, drivers] = await Promise.all([
      q(supabaseAdmin.from('bus_locations').select('*')),
      q(supabaseAdmin.from('routes').select('id, name, code, color, start_point, end_point')),
      q(supabaseAdmin.from('profiles').select('id, full_name, phone, username').eq('role', 'driver')),
    ]);
    const locMap = Object.fromEntries(locations.map((l) => [l.bus_id, l]));
    const routeMap = Object.fromEntries(routes.map((r) => [r.id, r]));
    const driverMap = Object.fromEntries(drivers.map((d) => [d.id, d]));
    res.json({
      buses: buses.map((b) => ({
        ...b,
        location: locMap[b.id] || null,
        route: routeMap[b.route_id] || null,
        driver: driverMap[b.driver_id] || null,
      })),
    });
  })
);

router.post(
  '/buses',
  allowRoles('admin'),
  asyncRoute(async (req, res) => {
    const { data, error } = await supabaseAdmin.from('buses').insert(busBody(req.body)).select('*').single();
    if (error) throw new HttpError(400, error.message);
    res.status(201).json({ bus: data });
  })
);

router.patch(
  '/buses/:id',
  allowRoles('admin'),
  asyncRoute(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('buses')
      .update(busBody(req.body, { partial: true }))
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw new HttpError(400, error.message);
    res.json({ bus: data });
  })
);

router.delete(
  '/buses/:id',
  allowRoles('admin'),
  asyncRoute(async (req, res) => {
    const { error } = await supabaseAdmin.from('buses').delete().eq('id', req.params.id);
    if (error) throw new HttpError(400, error.message);
    res.json({ ok: true });
  })
);

export default router;
