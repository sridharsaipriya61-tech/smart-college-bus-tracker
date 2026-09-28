# 🚌 Smart College Bus Tracker

A production-ready full-stack college bus tracking app. Students see their bus live on a map,
drivers share their GPS, admins manage the fleet, and Google Gemini summarises everything.

**Stack:** React 18 + Vite + Tailwind CSS · Node.js + Express · Supabase (Postgres) · Google Gemini

```
smart-college-bus-tracker/
├── client/     # everything the browser sees  (no secrets, ever)
├── server/     # the brain: API, auth, DB, AI   (all keys live in server/.env)
├── render.yaml # Render blueprint for the backend
└── .gitignore  # ignores .env, node_modules, dist
```

---

## ✨ Features

| Area | What it does |
| --- | --- |
| **Auth** | Real sign-up + login. Anyone can create their own account with any username. Passwords hashed with **bcrypt**, sessions are signed JWTs saved in the browser → works on any device. No `student / 1234`. |
| **Roles** | `student`, `driver`, `admin` — enforced on the server, not just hidden in the UI. |
| **Student** | Live map of every bus, their own bus with ETA, all other buses (for when they miss theirs), browse routes, pick a pickup stop, get arrival times. |
| **Driver** | Profile, live GPS sharing (auto-refresh every 15 s, or tap the map manually), set bus status, view the route stop order, log trip events. |
| **Admin** | Full CRUD for buses, routes, bus stops and users; assign buses/stops; activate/deactivate accounts; reset passwords; fleet overview + AI reports. |
| **Maps** | Leaflet + OpenStreetMap/CARTO tiles. Bus pins, stop pins, route polylines, distance & ETA. Fully responsive. |
| **AI** | `POST /api/ai/generate` plus note summarising, trip digests and fleet reports — the Gemini key lives only in the server. |
| **CRUD** | Personal notes: create, read, edit, delete — saved in Supabase, scoped to the logged-in user. |

---

## ⚙️ Local setup

```bash
# 1. install
npm run install:all

# 2. server secrets
cp server/.env.example server/.env      # then paste your keys in

# 3. create the tables + seed demo data (automatic, no manual SQL)
npm run init-db

# 4. run both
npm run dev:server      # http://localhost:8080
npm run dev:client      # http://localhost:5173
```

The Vite dev server proxies `/api` to Express, so there is nothing to configure locally.

### `npm run init-db` needs one extra credential

Tables are created through the Supabase SQL API, which is *not* reachable with the anon or
service-role key. Provide **one** of these in `server/.env`:

| Option | Where to get it |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Personal Access Tokens → generate (`sbp_…`) |
| `SUPABASE_DB_URL` | Project Settings → Database → Connection string (needs the DB password) |

The script applies the schema, seeds the Vijayawada/Guntur demo fleet, then verifies every table.

---

## 🔐 Security

- **All secrets live in `server/.env` only.** `.gitignore` blocks `.env`, `node_modules`, `dist`.
- The client only ever receives `VITE_API_BASE_URL` (the public API address). It talks to the
  Express API — never to Supabase or Google directly.
- The Gemini key and the Supabase service-role key are read from `process.env` on the server.
- Passwords: bcrypt, cost 12. Timing-safe login (a dummy hash is compared when the user is unknown).
- `helmet`, CORS restricted to the configured client origin, and rate limits on the API and on
  `/api/auth/login` + `/api/auth/signup`.
- Row Level Security is enabled on every table: users can only read/update their own profile and
  CRUD their own items.

---

## 🗄️ Database

| Table | Purpose |
| --- | --- |
| `profiles` | every account — email, username, bcrypt hash, role, bus/stop assignment |
| `buses` | bus number, name, route, driver, capacity, status |
| `routes` | name, code, colour, start/end, description |
| `bus_stops` | name, code, lat/lng, landmark |
| `route_stops` | ordered stops per route with minute offsets |
| `bus_locations` | one live row per bus — lat, lng, heading, speed, status |
| `trip_events` | driver journal — feeds the AI trip report |
| `items` | personal notes with the AI summary |

---

## 🔌 API

| Method | Endpoint | Notes |
| --- | --- | --- |
| POST | `/api/auth/signup` | create an account (student or driver) |
| POST | `/api/auth/login` | email **or** username + password |
| GET | `/api/auth/me` | restore the session |
| GET/PATCH | `/api/profile` | read/update own profile, bus + stop assignment |
| PATCH | `/api/profile/username` · POST `/api/profile/password` | account security |
| GET | `/api/live/map` | one call → buses + locations + stops + routes + ETA |
| GET | `/api/live/buses/:id` | next stops with distances and ETAs |
| POST | `/api/live/location` | driver shares/updates GPS |
| POST/GET | `/api/live/events` | trip log |
| GET/POST/PATCH/DELETE | `/api/fleet/buses` `/routes` `/stops` | read for all, write for admin |
| PUT | `/api/fleet/routes/:id/stops` | replace a route's ordered stops |
| GET/POST/PATCH/DELETE | `/api/admin/users` | admin only |
| GET | `/api/admin/overview` | dashboard counters |
| GET/POST/PATCH/DELETE | `/api/items` | per-user note CRUD |
| POST | `/api/ai/generate` | `{ prompt }` → `{ reply }` |
| POST | `/api/ai/summarize-note` · `/api/ai/trip-summary` · `/api/ai/ask-about-route` | grounded helpers |
| GET | `/health` | uptime probe used by Render |

All protected routes need `Authorization: Bearer <token>`.

---

## 🚀 Deploy

The app is **live**:

| | URL |
| --- | --- |
| **Frontend** | https://smart-college-bus-tracker.vercel.app |
| **Backend API** | https://smart-college-bus-tracker-api.vercel.app |
| **GitHub** | https://github.com/sridharsaipriya61-tech/smart-college-bus-tracker |

### Backend — Vercel (currently live) or Render

The Express app is exported twice from the same code:

- `server/api/index.js` → **serverless function** (Vercel) — no `listen()` call
- `server/src/index.js` → **long-running server** (Render, local) — calls `listen()`

**Vercel (live):** root directory `server`, no build command, env vars set in the dashboard.
**Render (optional):** the repo contains `render.yaml`, a ready-to-use blueprint —
Project Settings → Database are not needed; just set `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `JWT_SECRET` and `CLIENT_URL` (your Vercel URL).
Deploying to Render later only means changing `VITE_API_BASE_URL` on the frontend.

**Frontend — Vercel:** root directory `client`, build `npm run build`, output `dist`.
The only variable is `VITE_API_BASE_URL` = the backend URL. `client/vercel.json` handles SPA rewrites.

> On a serverless host there is no background timer, so the demo bus movement is triggered
> by incoming map requests instead (`server/src/app.js`). Real driver GPS is unaffected.

**Database** — `npm run init-db` creates every table, the RLS policies and the demo data.

---

## Demo accounts (created by the seed, change the passwords!)

| Role | Username | Password |
| --- | --- | --- |
| Admin | `admin` | see `ADMIN_PASSWORD` in `server/.env` |
| Driver | `ramesh` | `Driver@123` |
| Driver | `suresh` | `Driver@123` |
| Student | `rahul123` | `Student@123` |
| Student | `lasya01` | `Student@123` |

Every visitor can also just tap **Sign up** and create their own account in seconds.
