import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

/**
 * Node 20 has no global WebSocket, which supabase-js wants for its (unused here)
 * realtime client. Shim it with `ws` so the client can be constructed.
 * On Node >= 22 the native implementation is used and this is skipped.
 */
if (typeof globalThis.WebSocket === 'undefined') {
  try {
    const { default: ws } = await import('ws');
    globalThis.WebSocket = ws;
  } catch {
    /* realtime is not used by this API */
  }
}

/**
 * Supabase access lives ONLY inside the server process.
 * The service role key bypasses RLS, so every query below is scoped by the
 * application's own authorisation middleware — never by a raw client id.
 */
export const supabaseAdmin = env.supabaseUrl
  ? createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

export const dbReady = () => Boolean(supabaseAdmin);

/** Throw a clean 400/404 style error that the error middleware understands. */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const bad = (msg, details) => new HttpError(400, msg, details);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);
export const forbidden = (msg = 'Not allowed') => new HttpError(403, msg);

/** Run a Supabase query and normalise its PostgREST error into an HttpError. */
export async function q(builder) {
  const { data, error } = await builder;
  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 400;
    throw new HttpError(status, error.message, error.details);
  }
  return data;
}
