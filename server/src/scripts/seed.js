/* eslint-disable no-console */
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../services/supabaseAdmin.js';

const STOPS = [
  { name: 'Guntur Bus Stand',        code: 'GT01', lat: 16.3067, lng: 80.4365, landmark: 'Main bus terminal, Guntur' },
  { name: 'Guntur Central Depot',    code: 'GT02', lat: 16.3150, lng: 80.4270, landmark: 'Central bus depot gate' },
  { name: 'Pedanandipadu Junction',  code: 'PD01', lat: 16.4900, lng: 80.5600, landmark: 'NH16 signal' },
  { name: 'Mylavaram',               code: 'MY01', lat: 16.4727, lng: 80.6217, landmark: 'Mylavaram bridge' },
  { name: 'Kanaparthi',              code: 'KN01', lat: 16.4899, lng: 80.6204, landmark: 'Kanaparthi junction' },
  { name: 'Benz Circle',             code: 'BZ01', lat: 16.5089, lng: 80.6359, landmark: 'Benz Circle, Vijayawada' },
  { name: 'Vijayawada Bus Stand',    code: 'VJ01', lat: 16.5062, lng: 80.6480, landmark: 'PSRTC bus station' },
  { name: 'SR College Gate',         code: 'SR01', lat: 16.5121, lng: 80.6433, landmark: 'SR College main gate' },
  { name: 'Loyola College',          code: 'LY01', lat: 16.4977, lng: 80.6652, landmark: 'Andhra Loyola College' },
  { name: 'NTR Health University',   code: 'NT01', lat: 16.5040, lng: 80.6712, landmark: 'University main gate' },
  { name: 'Kankipadu',               code: 'KK01', lat: 16.5012, lng: 80.6905, landmark: 'Kankipadu bus point' },
  { name: 'Kakumanu',                code: 'KK02', lat: 16.5340, lng: 80.6620, landmark: 'Kakumanu junction' },
];

const ROUTES = [
  {
    name: 'Guntur → College Highway', code: 'RT-A', color: '#2563eb',
    description: 'Direct NH16 service from Guntur to the college campus.',
    start_point: 'Guntur Bus Stand', end_point: 'Loyola College',
    stops: ['GT01', 'PD01', 'MY01', 'KN01', 'BZ01', 'LY01'],
    offsets: [0, 14, 26, 32, 42, 55],
  },
  {
    name: 'Vijayawada City Loop', code: 'RT-B', color: '#0ea5e9',
    description: 'City circular covering major colleges and the main bus stand.',
    start_point: 'Vijayawada Bus Stand', end_point: 'NTR Health University',
    stops: ['VJ01', 'SR01', 'BZ01', 'MY01', 'KN01', 'LY01', 'NT01', 'KK01'],
    offsets: [0, 5, 10, 18, 22, 30, 38, 46],
  },
  {
    name: 'Guntur Express', code: 'RT-C', color: '#7c3aed',
    description: 'Limited-stop express for morning lectures.',
    start_point: 'Guntur Central Depot', end_point: 'NTR Health University',
    stops: ['GT02', 'PD01', 'BZ01', 'SR01', 'NT01'],
    offsets: [0, 16, 34, 40, 48],
  },
];

const BUSES = [
  { bus_number: 'AP-16-AB-1234', name: 'Surya',   route: 'RT-A', capacity: 52 },
  { bus_number: 'AP-16-AB-2345', name: 'Pragathi', route: 'RT-B', capacity: 45 },
  { bus_number: 'AP-16-AB-3456', name: 'Vidya',   route: 'RT-C', capacity: 40 },
  { bus_number: 'AP-16-AB-4567', name: 'Tejas',   route: 'RT-B', capacity: 48 },
];

const DEMO_USERS = [
  { username: 'admin',    email: env.adminEmail.toLowerCase(), password: env.adminPassword, full_name: env.adminName, role: 'admin' },
  { username: 'ramesh',   email: 'ramesh@bustracker.dev',  password: 'Driver@123',  full_name: 'Ramesh Kumar',  role: 'driver',  phone: '9848012345', license_no: 'AP-DL-2021-778812' },
  { username: 'suresh',   email: 'suresh@bustracker.dev',  password: 'Driver@123',  full_name: 'Suresh Naidu',  role: 'driver',  phone: '9848056789', license_no: 'AP-DL-2020-554433' },
  { username: 'rahul123', email: 'rahul123@bustracker.dev', password: 'Student@123', full_name: 'Rahul Sharma', role: 'student', roll_no: '21CS045', department: 'CSE', year: '3rd Year', phone: '9876543210' },
  { username: 'lasya01', email: 'lasya01@bustracker.dev', password: 'Student@123', full_name: 'Lasya Reddy',  role: 'student', roll_no: '22EC118', department: 'ECE', year: '2nd Year', phone: '9876500001' },
];

const upsertStop = async (s) => {
  const { data: found } = await supabaseAdmin.from('bus_stops').select('*').eq('code', s.code).maybeSingle();
  if (found) return found;
  const { data, error } = await supabaseAdmin.from('bus_stops').insert(s).select('*').single();
  if (error) throw new Error(`stop ${s.name}: ${error.message}`);
  return data;
};

const upsertRoute = async (r) => {
  const { data: found } = await supabaseAdmin.from('routes').select('*').eq('code', r.code).maybeSingle();
  let route = found;
  if (!route) {
    const { data, error } = await supabaseAdmin
      .from('routes')
      .insert({
        name: r.name, code: r.code, color: r.color, description: r.description,
        start_point: r.start_point, end_point: r.end_point,
      })
      .select('*')
      .single();
    if (error) throw new Error(`route ${r.name}: ${error.message}`);
    route = data;
  }
  const { data: existing } = await supabaseAdmin.from('route_stops').select('id').eq('route_id', route.id);
  if (!existing?.length) {
    const rows = r.stops.map((code, i) => ({
      route_id: route.id, stop_id: stopMap[code].id, stop_order: i + 1, time_offset_min: r.offsets[i] ?? i * 8,
    }));
    const { error } = await supabaseAdmin.from('route_stops').insert(rows);
    if (error) throw new Error(`route stops ${r.name}: ${error.message}`);
  }
  return route;
};

const upsertUser = async (u) => {
  const { password, ...clean } = u;
  const { data: found } = await supabaseAdmin
    .from('profiles').select('*').eq('username', u.username).maybeSingle();
  if (found) return found;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .insert({ ...clean, email: u.email, password_hash: await bcrypt.hash(password, 12), active: true })
    .select('*')
    .single();
  if (error) throw new Error(`user ${u.username}: ${error.message}`);
  return data;
};

let stopMap = {};

export async function seed() {
  console.log('▸ Seeding demo fleet (Vijayawada / Guntur)…');
  stopMap = Object.fromEntries((await Promise.all(STOPS.map(upsertStop))).map((s) => [s.code, s]));
  console.log(`   ✓ ${STOPS.length} bus stops`);

  const routeMap = Object.fromEntries((await Promise.all(ROUTES.map(upsertRoute))).map((r) => [r.code, r]));
  console.log(`   ✓ ${ROUTES.length} routes`);

  const users = Object.fromEntries((await Promise.all(DEMO_USERS.map(upsertUser))).map((u) => [u.username, u]));
  console.log(`   ✓ ${Object.keys(users).length} accounts`);

  // Link drivers to their buses and buses to routes.
  for (const [i, b] of BUSES.entries()) {
    const { data: existing } = await supabaseAdmin.from('buses').select('*').eq('bus_number', b.bus_number).maybeSingle();
    if (existing) {
      if (!existing.route_id) {
        await supabaseAdmin.from('buses').update({ route_id: routeMap[b.route].id }).eq('id', existing.id);
      }
      continue;
    }
    const driver = i === 0 ? users.ramesh : i === 1 ? users.suresh : null;
    const { error } = await supabaseAdmin.from('buses').insert({
      bus_number: b.bus_number, name: b.name, route_id: routeMap[b.route].id,
      driver_id: driver?.id || null, capacity: b.capacity, status: 'active',
    });
    if (error) throw new Error(`bus ${b.bus_number}: ${error.message}`);
  }
  console.log(`   ✓ ${BUSES.length} buses`);

  // Assign drivers and students to buses / pickup stops.
  const buses = (await supabaseAdmin.from('buses').select('*')).data || [];
  for (const [i, username] of ['ramesh', 'suresh'].entries()) {
    const bus = buses[i];
    if (!bus) continue;
    await supabaseAdmin.from('profiles').update({ bus_id: bus.id }).eq('id', users[username].id);
    await supabaseAdmin.from('buses').update({ driver_id: users[username].id }).eq('id', bus.id);
  }
  const studentBuses = [buses[0], buses[1], buses[2], buses[1]];
  const studentStops = [stopMap.PD01, stopMap.SR01, stopMap.KN01, stopMap.MY01];
  for (const [i, username] of ['rahul123', 'lasya01'].entries()) {
    await supabaseAdmin
      .from('profiles')
      .update({ bus_id: studentBuses[i]?.id || null, stop_id: studentStops[i]?.id || null })
      .eq('id', users[username].id);
  }
  console.log('   ✓ Assignments done\n');
}
