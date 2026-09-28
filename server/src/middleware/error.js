import { HttpError } from '../services/supabaseAdmin.js';

export function notFoundHandler(_req, _res, next) {
  next(new HttpError(404, 'Endpoint not found'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error('[api] error:', err);
  res.status(status).json({
    error: err.message || 'Something went wrong',
    details: err.details || undefined,
  });
}

export const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
