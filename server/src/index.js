import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { env, allowedOrigins, isProd } from './config/env.js';
import { supabaseAdmin } from './services/supabaseAdmin.js';
import { startSimulation } from './services/simulation.js';
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

const app = express();

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
      if (allow.has(origin.replace(/\/$/, '')) || env.nodeEnv !== 'production') return cb(null, true);
      return cb(new HttpError(403, `Origin ${origin} is not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

if (!isProd) app.use(morgan('dev'));

/* --- Rate limits: auth endpoints get a tighter bucket --- */
const limiter = { windowMs: 15 * 60 * 1000, max: 1000, standardHeaders: true, legacyHeaders: false };
app.use('/api', rateLimit(limiter));
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

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/fleet', fleetRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/ai', aiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(env.port, '0.0.0.0', () => {
  console.log(`\n  Smart College Bus Tracker API`);
  console.log(`  ▸ http://localhost:${env.port}/health`);
  console.log(`  ▸ env: ${env.nodeEnv}  db: ${supabaseAdmin ? 'connected' : 'NOT CONFIGURED'}`);
  console.log(`  ▸ allowed origins: ${[...allow].join(', ') || 'none set'}\n`);
  startSimulation();
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

/* A single stray promise must never take the whole API down. */
process.on('unhandledRejection', (reason) => {
  console.error('[api] unhandled rejection (ignored):', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('[api] uncaught exception (ignored):', err?.message || err);
});

export default app;
