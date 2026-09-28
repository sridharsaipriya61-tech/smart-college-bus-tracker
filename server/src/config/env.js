import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const bool = (v, d = false) =>
  v === undefined ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());

export const env = {
  port: Number(process.env.PORT || 8080),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseDbUrl: process.env.SUPABASE_DB_URL || '',
  supabaseAccessToken: process.env.SUPABASE_ACCESS_TOKEN || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@bustracker.dev',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin@12345',
  adminName: process.env.ADMIN_NAME || 'System Admin',
  simulateBuses: bool(process.env.SIMULATE_BUSES, true),
  simulationIntervalMs: Number(process.env.SIMULATION_INTERVAL_MS || 5000),
};

export const isProd = env.nodeEnv === 'production';

/** Every origin allowed to call this API. */
export const allowedOrigins = () =>
  env.clientUrl
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

export const assertCoreEnv = () => {
  const missing = [];
  if (!env.supabaseUrl) missing.push('SUPABASE_URL');
  if (!env.supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!env.geminiApiKey) missing.push('GEMINI_API_KEY');
  return missing;
};
