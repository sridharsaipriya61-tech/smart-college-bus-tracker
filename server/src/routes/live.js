import express from 'express';
import { supabaseAdmin, q, HttpError, bad, forbidden } from '../services/supabaseAdmin.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/error.js';
import { withRouteStops } from './fleet.js';
import { str } from '../middleware/validate.js';

const router = express.Router();
router.use(requireAuth);

const EARTH_R = 6371; // km

export function haversineKm(a, b) {
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

const bearing = (a, b) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

/* ------------------------------------------------------------------ *
 *  GET /api/live/map — one call powers the whole live map              *
 * ------------------------------------------------------------------ */
router.get(
  '/map',
  asyncRoute(async (req, res) => {
    const [buses, locations, routes, stops, drivers] = await Promise.all([
      q(supabaseAdmin.from('buses').select('*').order('bus_number')),
      q(supabaseAdmin.from('bus_locations').select('*')),
      withRouteStops(await q(supabaseAdmin.from('routes').select('*').order('name'))),
      q(supabaseAdmin.from('bus_stops').select('*').order('name')),
      q(supabaseAdmin.from('profiles').select('id, full_name, phone, username').eq('role', 'driver')),
    ]);

    const locMap = Object.fromEntries(locations.map((l) => [l.bus_id, l]));
    const routeMap = Object.fromEntries(routes.map((r) => [r.id, r]));
    const driverMap = Object.fromEntries(drivers.map((d) => [d.id, d]));

    // ETA for a student: which stop is their pickup point on their bus's route?
    const myStopId = req.user?.stop_id;
    let myBus = null;
    if (req.user?.bus_id) {
      myBus = buses.find((b) => b.id === req.user.bus_id) || null;
    } else if (req.user?.role === 'driver') {
      myBus = buses.find((b) => b.driver_id === req.user.id) || null;
    }

    const decorate = (b) => {
      const loc = locMap[b.id] || null;
      const route = routeMap[b.route_id] || null;
      let eta = null;
      if (loc && route && myStopId) {
        const link = route.stops.find((s) => s.stop_id === myStopId);
        if (link) eta = etaInfo(loc, route.stops, link.stop_id, link.time_offset_min || 0);
      }
      return { ...b, location: loc, route, driver: driverMap[b.driver_id] || null, eta };
    };

    res.json({
      buses: buses.map(decorate),
      stops,
      routes,
      my_bus: myBus ? decorate(myBus) : null,
      my_stop: myStopId ? stops.find((s) => s.id === myStopId) || null : null,
      server_time: new Date().toISOString(),
    });
  })
);

/** Walk the ordered stops from the bus's current position and estimate arrival. */
export function etaInfo(loc, routeStops, targetStopId, targetOffset) {
  const known = routeStops.filter((s) => s.stop && s.stop.lat != null);
  if (!known.length) return null;
  let remaining = 0;
  let found = false;
  for (const s of known) {
    if (s.stop_id === targetStopId) {
      found = true;
      remaining += Math.max(0, (targetOffset - (s.time_offset_min || 0)) * 0);
      break;
    }
    const prev = known[known.indexOf(s) - 1];
    if (prev) remaining += haversineKm(prev.stop, s.stop);
  }
  if (!found) return null;
  const toNearest = Math.min(...known.map((s) => haversineKm(loc, s.stop)));
  const km = toNearest + remaining;
  const minutes = Math.max(1, Math.round((km / 28) * 60)); // ~28 km/h average city speed
  return { km: Number(km.toFixed(2)), minutes, stop_id: targetStopId };
}

/* ------------------------------------------------------------------ *
 *  GET /api/live/buses/:id — nearest-stop ETA list for one bus        *
 * ------------------------------------------------------------------ */
router.get(
  '/buses/:id',
  asyncRoute(async (req, res) => {
    const bus = await q(supabaseAdmin.from('buses').select('*').eq('id', req.params.id).maybeSingle());
    if (!bus) throw new HttpError(404, 'Bus not found');
    const loc = await q(supabaseAdmin.from('bus_locations').select('*').eq('bus_id', bus.id).maybeSingle());
    let route = null;
    if (bus.route_id) {
      const [r] = await withRouteStops(
        await q(supabaseAdmin.from('routes').select('*').eq('id', bus.route_id).limit(1))
      );
      route = r || null;
    }
    const nextStops = (route?.stops || [])
      .filter((s) => s.stop)
      .map((s, i, arr) => {
        const dist = loc ? haversineKm(loc, s.stop) : null;
        return {
          ...s,
          index: i + 1,
          distance_km: dist == null ? null : Number(dist.toFixed(2)),
          eta_minutes: dist == null ? null : Math.max(1, Math.round((dist / 28) * 60)),
        };
      })
      .sort((a, b) => (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9));
    res.json({ bus, location: loc || null, route, next_stops: nextStops });
  })
);

/* ------------------------------------------------------------------ *
 *  POST /api/live/location — driver shares / updates GPS              *
 * ------------------------------------------------------------------ */
router.post(
  '/location',
  allowRoles('driver', 'admin'),
  asyncRoute(async (req, res) => {
    const { lat, lng, heading, speed, status } = req.body;
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (Number.isNaN(latitude) || latitude < -90 || latitude > 90)
      throw bad('Latitude must be between -90 and 90', { lat: 'Invalid latitude' });
    if (Number.isNaN(longitude) || longitude < -180 || longitude > 180)
      throw bad('Longitude must be between -180 and 180', { lng: 'Invalid longitude' });

    const busId = str(req.body.bus_id) || req.user.bus_id;
    if (!busId) throw bad('No bus assigned to your account yet. Ask the admin to assign one.');

    const bus = await q(supabaseAdmin.from('buses').select('*').eq('id', busId).maybeSingle());
    if (!bus) throw bad('Bus not found');
    if (req.user.role === 'driver' && bus.driver_id && bus.driver_id !== req.user.id)
      throw forbidden('You can only update the location of the bus assigned to you');

    const row = {
      bus_id: busId,
      lat: latitude,
      lng: longitude,
      heading: Number.isFinite(Number(heading)) ? Number(heading) : 0,
      speed: Number.isFinite(Number(speed)) ? Math.max(0, Math.round(Number(speed))) : 0,
      status: ['on_time', 'delayed', 'breakdown', 'returning'].includes(status) ? status : 'on_time',
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin.from('bus_locations').upsert(row, { onConflict: 'bus_id' });
    if (error) throw new HttpError(400, error.message);

    await supabaseAdmin.from('trip_events').insert({
      bus_id: busId,
      driver_id: req.user.id,
      event_type: 'location_ping',
      note: `Ping at ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    });

    res.json({ ok: true, location: row });
  })
);

/** Driver/admin trip journal — also feeds the AI daily summary. */
router.post(
  '/events',
  asyncRoute(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('trip_events')
      .insert({
        bus_id: str(req.body.bus_id) || req.user.bus_id || null,
        driver_id: req.user.id,
        event_type: str(req.body.event_type) || 'note',
        note: str(req.body.note) || null,
        passengers: Number(req.body.passengers || 0) || 0,
      })
      .select('*')
      .single();
    if (error) throw new HttpError(400, error.message);
    res.status(201).json({ event: data });
  })
);

router.get(
  '/events',
  asyncRoute(async (req, res) => {
    let query = supabaseAdmin.from('trip_events').select('*').order('created_at', { ascending: false }).limit(60);
    if (req.user.role !== 'admin') query = query.eq('driver_id', req.user.id);
    if (req.query.bus_id) query = query.eq('bus_id', req.query.bus_id);
    const events = await q(query);
    res.json({ events });
  })
);

export default router;
