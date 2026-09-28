/* eslint-disable no-console */
/** Restore the demo assignments after testing churned them. Idempotent. */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = ws;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const PLAN = {
  drivers: { ramesh: 'AP-16-AB-1234', suresh: 'AP-16-AB-2345' },
  students: { rahul123: ['AP-16-AB-1234', 'PD01'], lasya01: ['AP-16-AB-2345', 'SR01'] },
};

const { data: buses } = await supabase.from('buses').select('id, bus_number');
const busId = Object.fromEntries(buses.map((b) => [b.bus_number, b.id]));
const { data: stops } = await supabase.from('bus_stops').select('id, code');
const stopId = Object.fromEntries(stops.map((s) => [s.code, s.id]));
const { data: users } = await supabase.from('profiles').select('id, username');
const userId = Object.fromEntries(users.map((u) => [u.username, u.id]));

for (const [username, number] of Object.entries(PLAN.drivers)) {
  if (!userId[username] || !busId[number]) continue;
  await supabase.from('profiles').update({ bus_id: busId[number] }).eq('id', userId[username]);
  await supabase.from('buses').update({ driver_id: userId[username] }).eq('id', busId[number]);
  console.log(`  ${username} -> drives ${number}`);
}

for (const [username, [number, code]] of Object.entries(PLAN.students)) {
  if (!userId[username] || !busId[number]) continue;
  await supabase
    .from('profiles')
    .update({ bus_id: busId[number], stop_id: stopId[code] || null })
    .eq('id', userId[username]);
  console.log(`  ${username} -> rides ${number}, pickup ${code}`);
}

const { data: check } = await supabase
  .from('profiles')
  .select('username, role, bus_id, stop_id')
  .order('username');
console.log('\nfinal state:');
check.forEach((u) =>
  console.log(`  ${u.username.padEnd(12)} ${u.role.padEnd(8)} bus=${u.bus_id ? 'yes' : 'no'} stop=${u.stop_id ? 'yes' : 'no'}`)
);
