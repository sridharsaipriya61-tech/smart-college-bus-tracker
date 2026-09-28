import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { supabaseAdmin, HttpError } from '../services/supabaseAdmin.js';

export const signToken = (user) =>
  jwt.sign(
    { sub: user.id, role: user.role, email: user.email, username: user.username },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/** Attaches req.user when a valid token is present. Never throws. */
export async function optionalAuth(req, _res, next) {
  const token = readToken(req);
  if (!token || !supabaseAdmin) return next();
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', payload.sub)
      .maybeSingle();
    if (data && data.active !== false) req.user = data;
  } catch {
    /* anonymous */
  }
  next();
}

/** Hard gate: valid, non-revoked account required. */
export async function requireAuth(req, _res, next) {
  const token = readToken(req);
  if (!token) return next(new HttpError(401, 'Please log in to continue'));
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', payload.sub)
      .maybeSingle();
    if (error) throw new HttpError(401, error.message);
    if (!data) return next(new HttpError(401, 'Account no longer exists'));
    if (data.active === false) return next(new HttpError(403, 'This account has been deactivated by the admin'));
    req.user = data;
    next();
  } catch (e) {
    if (e instanceof HttpError) return next(e);
    return next(new HttpError(401, 'Your session expired. Please log in again.'));
  }
}

export const allowRoles =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Please log in to continue'));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have access to this area'));
    next();
  };
