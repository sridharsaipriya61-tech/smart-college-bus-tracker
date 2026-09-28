import { env } from './config/env.js';
import { supabaseAdmin } from './services/supabaseAdmin.js';
import { startSimulation } from './services/simulation.js';
import app from './app.js';

/* Long-running server entry point (Render, local development).
   On serverless, `api/index.js` exports the same app without listening. */

const server = app.listen(env.port, '0.0.0.0', () => {
  console.log(`\n  Smart College Bus Tracker API`);
  console.log(`  ▸ http://localhost:${env.port}/health`);
  console.log(`  ▸ env: ${env.nodeEnv}  db: ${supabaseAdmin ? 'connected' : 'NOT CONFIGURED'}`);
  console.log(`  ▸ allowed origins: ${env.clientUrl}\n`);
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
