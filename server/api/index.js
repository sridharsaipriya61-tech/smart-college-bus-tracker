/**
 * Vercel serverless entry point.
 *
 * The same Express app that runs on Render, exported as a serverless
 * function. Nothing here calls `listen()` — the platform handles that.
 */
import app from '../src/app.js';

export default app;
