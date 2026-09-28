import express from 'express';
import bcrypt from 'bcryptjs';
import { supabaseAdmin, q, HttpError, bad, notFound } from '../services/supabaseAdmin.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/error.js';
import { publicUser } from './auth.js';
import { assignBus } from '../services/assignment.js';
import { str, EMAIL_RE, USERNAME_RE, requireBody } from '../middleware/validate.js';

const router = express.Router();
router.use(requireAuth, allowRoles('admin'));

/** GET /api/admin/users — full list with bus + stop names resolved. */
router.get(
  '/users',
  asyncRoute(async (req, res) => {
    const role = ['student', 'driver', 'admin'].includes(req.query.role) ? req.query.role : null;
    let query = supabaseAdmin.from('profiles').select('*');
    if (role) query = query.eq('role', role);
    const users = await q(query.order('created_at', { ascending: false }));

    const [buses, stops] = await Promise.all([
      q(supabaseAdmin.from('buses').select('id, bus_number, name')),
      q(supabaseAdmin.from('bus_stops').select('id, name')),
    ]);
    const busMap = Object.fromEntries(buses.map((b) => [b.id, b]));
    const stopMap = Object.fromEntries(stops.map((s) => [s.id, s]));

    const term = str(req.query.q).toLowerCase();
    const filtered = term
      ? users.filter(
          (u) =>
            u.full_name?.toLowerCase().includes(term) ||
            u.email?.toLowerCase().includes(term) ||
            u.username?.toLowerCase().includes(term) ||
            u.roll_no?.toLowerCase().includes(term)
        )
      : users;

    res.json({
      users: filtered.map((u) => ({
        ...publicUser(u),
        bus: u.bus_id ? busMap[u.bus_id] || null : null,
        stop: u.stop_id ? stopMap[u.stop_id] || null : null,
      })),
    });
  })
);

/** POST /api/admin/users — admin creates any account type. */
router.post(
  '/users',
  asyncRoute(async (req, res) => {
    const { email, username, password, full_name, role, phone } = req.body;
    const errors = {};
    if (!EMAIL_RE.test(str(email))) errors.email = 'Enter a valid email address';
    if (!USERNAME_RE.test(str(username))) errors.username = '3–24 chars (letters, numbers, . _ -)';
    if (!password || String(password).length < 8) errors.password = 'At least 8 characters';
    if (!str(full_name)) errors.full_name = 'Required';
    if (!['student', 'driver', 'admin'].includes(role)) errors.role = 'Pick a valid role';
    if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields', errors);

    const clash = await q(
      supabaseAdmin
        .from('profiles')
        .select('id, email, username')
        .or(`email.eq.${str(email).toLowerCase()},username.eq.${str(username)}`)
        .limit(1)
    );
    if (clash?.length) {
      const field = clash[0].email === str(email).toLowerCase() ? 'email' : 'username';
      throw new HttpError(409, 'That account already exists', { [field]: 'Already taken' });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert({
        email: str(email).toLowerCase(),
        username: str(username),
        password_hash: await bcrypt.hash(password, 12),
        full_name: str(full_name),
        role,
        phone: str(phone) || null,
        active: true,
      })
      .select('*')
      .single();
    if (error) throw new HttpError(400, error.message);
    res.status(201).json({ user: publicUser(data) });
  })
);

/** PATCH /api/admin/users/:id — update role, assignment, or status. */
router.patch(
  '/users/:id',
  asyncRoute(async (req, res) => {
    const target = await q(supabaseAdmin.from('profiles').select('*').eq('id', req.params.id).maybeSingle());
    if (!target) throw notFound('User not found');

    const patch = { updated_at: new Date().toISOString() };
    const { full_name, phone, role, bus_id, stop_id, roll_no, department, year, license_no, active } = req.body;
    if (full_name !== undefined) patch.full_name = str(full_name);
    if (phone !== undefined) patch.phone = str(phone) || null;
    if (roll_no !== undefined) patch.roll_no = str(roll_no) || null;
    if (department !== undefined) patch.department = str(department) || null;
    if (year !== undefined) patch.year = str(year) || null;
    if (license_no !== undefined) patch.license_no = str(license_no) || null;
    if (bus_id !== undefined) patch.bus_id = str(bus_id) || null;
    if (stop_id !== undefined) patch.stop_id = str(stop_id) || null;
    if (active !== undefined) patch.active = Boolean(active);
    if (role !== undefined) {
      if (!['student', 'driver', 'admin'].includes(role)) throw bad('Pick a valid role', { role: 'Invalid' });
      if (target.id === req.user.id && role !== 'admin')
        throw bad('You cannot remove your own admin role', { role: 'Not allowed' });
      patch.role = role;
    }
    if (patch.active === false && target.id === req.user.id)
      throw bad('You cannot deactivate your own account', { active: 'Not allowed' });

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(patch)
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw new HttpError(400, error.message);

    // Keep the bus's driver slot in sync so the driver can actually push GPS.
    if (bus_id !== undefined && data.role === 'driver') {
      await assignBus(data.id, patch.bus_id);
    }
    res.json({ user: publicUser(data) });
  })
);

router.delete(
  '/users/:id',
  asyncRoute(async (req, res) => {
    if (req.params.id === req.user.id) throw bad('You cannot delete your own account');
    const { error } = await supabaseAdmin.from('profiles').delete().eq('id', req.params.id);
    if (error) throw new HttpError(400, error.message);
    res.json({ ok: true });
  })
);

/** POST /api/admin/users/:id/reset-password */
router.post(
  '/users/:id/reset-password',
  asyncRoute(async (req, res) => {
    const password = str(req.body.password);
    if (password.length < 8) throw bad('Password must be at least 8 characters', { password: 'Too short' });
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ password_hash: await bcrypt.hash(password, 12), updated_at: new Date().toISOString() })
      .eq('id', req.params.id);
    if (error) throw new HttpError(400, error.message);
    res.json({ ok: true });
  })
);

/** GET /api/admin/overview — dashboard numbers. */
router.get(
  '/overview',
  asyncRoute(async (_req, res) => {
    const [students, drivers, admins, buses, routes, stops, locations, eventCount] = await Promise.all([
      q(supabaseAdmin.from('profiles').select('id, active').eq('role', 'student')),
      q(supabaseAdmin.from('profiles').select('id, active').eq('role', 'driver')),
      q(supabaseAdmin.from('profiles').select('id').eq('role', 'admin')),
      q(supabaseAdmin.from('buses').select('id, status')),
      q(supabaseAdmin.from('routes').select('id')),
      q(supabaseAdmin.from('bus_stops').select('id')),
      q(supabaseAdmin.from('bus_locations').select('bus_id, updated_at')),
      // head:true returns no rows, so read the count off the response directly.
      supabaseAdmin.from('trip_events').select('id', { count: 'exact', head: true }),
    ]);
    res.json({
      stats: {
        students: students.length,
        drivers: drivers.length,
        admins: admins.length,
        buses: buses.length,
        active_buses: buses.filter((b) => b.status === 'active').length,
        routes: routes.length,
        stops: stops.length,
        live_buses: locations.length,
        trip_events: eventCount.count || 0,
      },
    });
  })
);

export default router;
