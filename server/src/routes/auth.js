import express from 'express';
import bcrypt from 'bcryptjs';
import { supabaseAdmin, q, bad, HttpError } from '../services/supabaseAdmin.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/error.js';
import { validateSignup, str } from '../middleware/validate.js';

const router = express.Router();

export const publicUser = (u) => {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return rest;
};

const findByIdentity = (identity) =>
  q(
    supabaseAdmin
      .from('profiles')
      .select('*')
      .or(`email.eq.${identity},username.eq.${identity}`)
      .limit(1)
  ).then((rows) => rows?.[0] || null);

/* ------------------------------------------------------------------ *
 *  POST /api/auth/signup  — anyone can create their own account       *
 * ------------------------------------------------------------------ */
router.post(
  '/signup',
  asyncRoute(async (req, res) => {
    if (!supabaseAdmin) throw new HttpError(503, 'Database not configured. Add Supabase keys to server/.env');

    const { email, username, password, confirmPassword, full_name } = validateSignup({
      email: str(req.body.email),
      username: str(req.body.username),
      password: req.body.password,
      confirmPassword: req.body.confirmPassword,
      full_name: req.body.full_name,
    });

    // Self signup may only ever create a student or a driver — never an admin.
    const safeRole = str(req.body.role) === 'driver' ? 'driver' : 'student';
    const phone = str(req.body.phone) || null;

    const existing = await findByIdentity(email) || (await findByIdentity(username));
    if (existing) {
      const which = existing.email === email ? 'email' : 'username';
      throw new HttpError(409, `That ${which} is already registered. Try logging in instead.`, {
        [which]: 'Already taken',
      });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .insert({
        email,
        username,
        password_hash,
        full_name,
        role: safeRole,
        phone,
        active: true,
      })
      .select('*')
      .single();
    if (error) throw new HttpError(400, error.message);

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  })
);

/* ------------------------------------------------------------------ *
 *  POST /api/auth/login — email OR username + password                *
 * ------------------------------------------------------------------ */
router.post(
  '/login',
  asyncRoute(async (req, res) => {
    if (!supabaseAdmin) throw new HttpError(503, 'Database not configured. Add Supabase keys to server/.env');

    const identity = str(req.body.emailOrUsername) || str(req.body.email) || str(req.body.username);
    const password = req.body.password;
    if (!identity || !password) throw new HttpError(400, 'Enter your username/email and password');

    const user = await findByIdentity(identity);
    // Always run a bcrypt compare so timing does not reveal whether the account exists.
    const hash = user?.password_hash || '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const ok = await bcrypt.compare(password, hash);

    if (!user || !ok) throw new HttpError(401, 'Invalid username/email or password');
    if (user.active === false) throw new HttpError(403, 'This account has been deactivated by the admin');

    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

/* ------------------------------------------------------------------ *
 *  GET /api/auth/me — session restore (works on any device)          *
 * ------------------------------------------------------------------ */
router.get(
  '/me',
  requireAuth,
  asyncRoute(async (req, res) => {
    res.json({ user: publicUser(req.user) });
  })
);

/** Cheap connectivity probe used by the client's connection banner. */
router.get('/config', (_req, res) => {
  res.json({ ok: !!supabaseAdmin, gemini: !!process.env.GEMINI_API_KEY });
});

export default router;
