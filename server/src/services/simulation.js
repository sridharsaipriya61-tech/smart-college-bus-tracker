import { supabaseAdmin, q } from '../services/supabaseAdmin.js';
import { env } from '../config/env.js';

/**
 * Demo movement engine.
 * Buses that nobody is actively driving (no fresh GPS ping from a driver) glide
 * along their route so the map always looks alive. A real driver ping always wins.
 */

const STATE = new Map(); // bus_id -> { t }
const STALE_AFTER_MS = 30_000;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function alongPath(points, t) {
  // t in [0, 1] over the whole polyline, weighted by segment length
  const segs = [];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const d = Math.hypot(points[i].lat - points[i - 1].lat, points[i].lng - points[i - 1].lng);
    segs.push(d);
    total += d;
  }
  if (!total) return { ...points[0], heading: 0 };
  let target = t * total;
  for (let i = 0; i < segs.length; i += 1) {
    if (target <= segs[i] || i === segs.length - 1) {
      const f = segs[i] ? target / segs[i] : 0;
      const a = points[i];
      const b = points[i + 1];
      const heading =
        (Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180) / Math.PI;
      return {
        lat: lerp(a.lat, b.lat, f),
        lng: lerp(a.lng, b.lng, f),
        heading: (heading + 360) % 360,
      };
    }
    target -= segs[i];
  }
  return { ...points[points.length - 1], heading: 0 };
}

export async function tickSimulation() {
  if (!supabaseAdmin) return;
  try {
    const buses = await q(
      supabaseAdmin.from('buses').select('id, route_id, status').eq('status', 'active')
    );
    if (!buses.length) return;

    const locations = await q(supabaseAdmin.from('bus_locations').select('bus_id, updated_at'));
    const locMap = Object.fromEntries(locations.map((l) => [l.bus_id, l.updated_at]));

    const withRoutes = buses.filter((b) => b.route_id);
    if (!withRoutes.length) return;

    const routeIds = [...new Set(withRoutes.map((b) => b.route_id))];
    const links = await q(
      supabaseAdmin
        .from('route_stops')
        .select('route_id, stop_id, stop_order')
        .in('route_id', routeIds)
        .order('stop_order')
    );
    const stopIds = [...new Set(links.map((l) => l.stop_id))];
    const stops = stopIds.length ? await q(supabaseAdmin.from('bus_stops').select('*').in('id', stopIds)) : [];
    const stopMap = Object.fromEntries(stops.map((s) => [s.id, s]));

    const pathByRoute = {};
    for (const routeId of routeIds) {
      pathByRoute[routeId] = links
        .filter((l) => l.route_id === routeId)
        .map((l) => stopMap[l.stop_id])
        .filter((s) => s && s.lat != null && s.lng != null);
    }

    const rows = [];
    for (const bus of withRoutes) {
      const path = pathByRoute[bus.route_id];
      if (!path || path.length < 2) continue;

      // A fresh ping from a real driver means the bus is already being tracked.
      const last = locMap[bus.id];
      if (last && Date.now() - new Date(last).getTime() < STALE_AFTER_MS) continue;

      const state = STATE.get(bus.id) || { t: Math.random() };
      state.t = (state.t + 0.0022 + Math.random() * 0.0015) % 1;
      STATE.set(bus.id, state);

      const pos = alongPath(path, state.t);
      rows.push({
        bus_id: bus.id,
        lat: pos.lat,
        lng: pos.lng,
        heading: Math.round(pos.heading),
        speed: 18 + Math.round(Math.random() * 22),
        status: 'on_time',
        updated_at: new Date().toISOString(),
      });
    }

    if (rows.length) await supabaseAdmin.from('bus_locations').upsert(rows, { onConflict: 'bus_id' });
  } catch (e) {
    console.error('[sim] tick failed:', e.message);
  }
}

export function startSimulation() {
  if (!env.simulateBuses || !supabaseAdmin) {
    console.log('[sim] demo movement disabled');
    return;
  }
  tickSimulation();
  setInterval(tickSimulation, env.simulationIntervalMs).unref?.();
  console.log(`[sim] demo movement on, every ${env.simulationIntervalMs}ms`);
}
