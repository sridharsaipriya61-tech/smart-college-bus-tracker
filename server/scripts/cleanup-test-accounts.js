/* eslint-disable no-console */
/** One-off tidy-up: delete the throwaway accounts created by test runs. */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = ws;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const KEEP = new Set(['admin', 'ramesh', 'suresh', 'rahul123', 'lasya01']);

const { data: users } = await supabase.from('profiles').select('id, username, role').order('created_at');
const junk = (users || []).filter((u) => !KEEP.has(u.username));

if (junk.length) {
  await supabase.from('items').delete().in('user_id', junk.map((u) => u.id));
  await supabase.from('profiles').delete().in('id', junk.map((u) => u.id));
}

const { data: events } = await supabase.from('trip_events').select('id, driver_id, note');
const orphan = (events || []).filter((e) => e.driver_id && junk.some((u) => u.id === e.driver_id));
if (orphan.length) await supabase.from('trip_events').delete().in('id', orphan.map((e) => e.id));

const { data: left } = await supabase.from('profiles').select('username, role').order('created_at');
console.log(`removed ${junk.length} test account(s)`);
console.log('remaining:', left.map((u) => `${u.username} (${u.role})`).join(', '));
