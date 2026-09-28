import express from 'express';
import bcrypt from 'bcryptjs';
import { supabaseAdmin, q, HttpError, notFound } from '../services/supabaseAdmin.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/error.js';
import { publicUser } from './auth.js';
import { assignBus } from '../services/assignment.js';
import { str, USERNAME_RE } from '../middleware/validate.js';

const router = express.Router();
router.use(requireAuth);

const EDITABLE = [
  'full_name',
  'phone',
  'roll_no',
  'department',
  'year',
  'license_no',
  'bus_id',
  'stop_id',
];

router.get(
  '/',
  asyncRoute(async (req, res) => {
    const user = publicUser(req.user);
    const [bus, stop, stats] = await Promise.all([
      user.bus_id ? q(supabaseAdmin.from('buses').select('*').eq('id', user.bus_id).maybeSingle()) : null,
      user.stop_id ? q(supabaseAdmin.from('bus_stops').select('*').eq('id', user.stop_id).maybeSingle()) : null,
      supabaseAdmin.from('items').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ]);
    res.json({ user, bus: bus || null, stop: stop || null, notes: stats.count || 0 });
  })
);

router.patch(
  '/',
  asyncRoute(async (req, res) => {
    const patch = {};
    for (const field of EDITABLE) {
      if (req.body[field] !== undefined) {
        const v = str(req.body[field]);
        patch[field] = v === '' ? null : v;
      }
    }
    if (patch.full_name !== undefined && (!patch.full_name || patch.full_name.length < 2))
      throw new HttpError(400, 'Please fix the highlighted fields', { full_name: 'Enter your full name' });
    if (patch.bus_id) await assertExists('buses', patch.bus_id, 'bus_id', 'Bus not found');
    if (patch.stop_id) await assertExists('bus_stops', patch.stop_id, 'stop_id', 'Bus stop not found');

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', req.user.id)
      .select('*')
      .single();
    if (error) throw new HttpError(400, error.message);

    // A driver who picks a bus claims it, so their GPS updates are accepted.
    if (patch.bus_id !== undefined && data.role === 'driver') {
      await assignBus(data.id, patch.bus_id);
    }
    res.json({ user: publicUser(data) });
  })
);

router.patch(
  '/username',
  asyncRoute(async (req, res) => {
    const username = str(req.body.username);
    if (!USERNAME_RE.test(username))
      throw new HttpError(400, 'Please fix the highlighted fields', {
        username: 'Username must be 3–24 characters (letters, numbers, . _ -)',
      });
    const clash = await q(
      supabaseAdmin.from('profiles').select('id').eq('username', username).maybeSingle()
    );
    if (clash) throw new HttpError(409, 'That username is already taken', { username: 'Already taken' });

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ username, updated_at: new Date().toISOString() })
      .eq('id', req.user.id)
      .select('*')
      .single();
    if (error) throw new HttpError(400, error.message);
    res.json({ user: publicUser(data) });
  })
);

router.post(
  '/password',
  asyncRoute(async (req, res) => {
    const current = req.body.currentPassword;
    const next = req.body.newPassword;
    if (!next || next.length < 8) throw new HttpError(400, 'New password must be at least 8 characters');
    if (!/[a-zA-Z]/.test(next) || !/[0-9]/.test(next))
      throw new HttpError(400, 'New password must contain both letters and numbers');

    const ok = await bcrypt.compare(current || '', req.user.password_hash);
    if (!ok) throw new HttpError(401, 'Your current password is incorrect');

    const password_hash = await bcrypt.hash(next, 12);
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ password_hash, updated_at: new Date().toISOString() })
      .eq('id', req.user.id);
    if (error) throw new HttpError(400, error.message);
    res.json({ ok: true, message: 'Password updated' });
  })
);

/** Who is on my bus / which bus am I driving — powers the student & driver dashboards. */
router.get(
  '/directory',
  asyncRoute(async (req, res) => {
    const { role } = req.query;
    let query = supabaseAdmin.from('profiles').select('id, full_name, username, role, bus_id, stop_id, roll_no, phone, active');
    if (role) query = query.eq('role', role);
    const people = await q(query.order('full_name'));
    res.json({ people });
  })
);

async function assertExists(table, id, field, message) {
  const row = await q(supabaseAdmin.from(table).select('id').eq('id', id).maybeSingle());
  if (!row) throw new HttpError(400, 'Please fix the highlighted fields', { [field]: message });
}

export default router;
