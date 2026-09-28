import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { env, allowedOrigins, isProd } from './config/env.js';
import { supabaseAdmin } from './services/supabaseAdmin.js';
import { tickSimulation } from './services/simulation.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';
import { optionalAuth } from './middleware/auth.js';
import { HttpError } from './services/supabaseAdmin.js';

import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import fleetRoutes from './routes/fleet.js';
import liveRoutes from './routes/live.js';
import adminRoutes from './routes/admin.js';
import itemRoutes from './routes/items.js';
import aiRoutes from './routes/ai.js';

export const app = express();

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

/* --- CORS: only the configured frontend origins, credentials allowed --- */
const allow = new Set(allowedOrigins());
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // curl / server-to-server
      if (allow.has(origin.replace(/\/$/, '')) || !isProd) return cb(null, true);
      return cb(new HttpError(403, `Origin ${origin} is not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

if (!isProd) app.use(morgan('dev'));

/* --- Rate limits: auth endpoints get a tighter bucket --- */
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, standardHeaders: true, legacyHeaders: false }));
app.use(
  ['/api/auth/login', '/api/auth/signup'],
  rateLimit({ windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false })
);

app.use(optionalAuth);

/* --- Health --- */
app.get('/health', (_req, res) =>
  res.json({ ok: true, service: 'smart-college-bus-tracker', db: !!supabaseAdmin, time: new Date().toISOString() })
);
app.get('/api/health', (_req, res) => res.json({ ok: true, db: !!supabaseAdmin }));

/* ------------------------------------------------------------------ *
 * Demo buses glide along their route whenever someone is looking at   *
 * the map. On a long-running server a timer does this; on serverless   *
 * an incoming request triggers it instead.                             *
 * ------------------------------------------------------------------ */
let lastTick = 0;
app.use('/api', (_req, _res, next) => {
  if (env.simulateBuses && Date.now() - lastTick > env.simulationIntervalMs) {
    lastTick = Date.now();
    tickSimulation().catch(() => {});
  }
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/fleet', fleetRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/ai', aiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
