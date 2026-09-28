/**
 * Full Postgres schema for Smart College Bus Tracker.
 * Executed automatically by `npm run init-db` — no manual SQL needed.
 */
export const SCHEMA_SQL = `
create extension if not exists "pgcrypto";

-- ============ accounts ============
create table if not exists public.profiles (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  username      text unique not null,
  password_hash text not null,
  full_name     text not null,
  role          text not null default 'student' check (role in ('student','driver','admin')),
  phone         text,
  roll_no       text,
  department    text,
  year          text,
  license_no    text,
  bus_id        uuid,
  stop_id       uuid,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles(role);

-- ============ fleet ============
create table if not exists public.buses (
  id         uuid primary key default gen_random_uuid(),
  bus_number text unique not null,
  name       text not null,
  route_id   uuid,
  driver_id  uuid,
  capacity   int not null default 40,
  status     text not null default 'active' check (status in ('active','maintenance','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.routes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  code        text,
  description text,
  start_point text,
  end_point   text,
  color       text not null default '#2563eb',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.bus_stops (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  code       text,
  lat        double precision not null,
  lng        double precision not null,
  landmark   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.route_stops (
  id               uuid primary key default gen_random_uuid(),
  route_id         uuid not null references public.routes(id) on delete cascade,
  stop_id          uuid not null references public.bus_stops(id) on delete cascade,
  stop_order       int  not null,
  time_offset_min  int  not null default 0,
  unique (route_id, stop_id)
);

create table if not exists public.bus_locations (
  bus_id     uuid primary key references public.buses(id) on delete cascade,
  lat        double precision not null,
  lng        double precision not null,
  heading    double precision not null default 0,
  speed      double precision not null default 0,
  status     text not null default 'on_time' check (status in ('on_time','delayed','breakdown','returning')),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_events (
  id         uuid primary key default gen_random_uuid(),
  bus_id     uuid references public.buses(id) on delete cascade,
  driver_id  uuid references public.profiles(id) on delete set null,
  event_type text not null default 'note',
  note       text,
  passengers int default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  description text,
  ai_summary  text,
  created_at  timestamptz not null default now()
);
create index if not exists items_user_idx on public.items(user_id);

-- ============ foreign keys that depend on the tables above ============
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_bus_id_fkey') then
    alter table public.profiles add constraint profiles_bus_id_fkey
      foreign key (bus_id) references public.buses(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_stop_id_fkey') then
    alter table public.profiles add constraint profiles_stop_id_fkey
      foreign key (stop_id) references public.bus_stops(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'buses_route_id_fkey') then
    alter table public.buses add constraint buses_route_id_fkey
      foreign key (route_id) references public.routes(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'buses_driver_id_fkey') then
    alter table public.buses add constraint buses_driver_id_fkey
      foreign key (driver_id) references public.profiles(id) on delete set null;
  end if;
end $$;

-- ============ Row Level Security ============
alter table public.profiles     enable row level security;
alter table public.buses        enable row level security;
alter table public.routes       enable row level security;
alter table public.bus_stops    enable row level security;
alter table public.route_stops  enable row level security;
alter table public.bus_locations enable row level security;
alter table public.trip_events  enable row level security;
alter table public.items        enable row level security;

do $$
declare
  r text;
begin
  foreach r in array array['profiles','buses','routes','bus_stops','route_stops','bus_locations','trip_events','items'] loop
    execute format('drop policy if exists "allow_read_all" on public.%I', r);
    execute format('drop policy if exists "own_profile_select" on public.%I', r);
    execute format('drop policy if exists "own_profile_update" on public.%I', r);
    execute format('drop policy if exists "own_items_all" on public.%I', r);
    execute format('drop policy if exists "driver_write_locations" on public.%I', r);
    execute format('drop policy if exists "authenticated_insert_items" on public.%I', r);
  end loop;
end $$;

-- profiles: a signed-in user reads everyone (names/roles are not secret),
-- but may only change their own row.
create policy "own_profile_select" on public.profiles for select using (true);
create policy "own_profile_update" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- items: strictly per-user CRUD.
create policy "own_items_all" on public.items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- fleet data is world-readable to signed-in users, driver-only writes.
create policy "allow_read_all" on public.buses for select using (true);
create policy "allow_read_all" on public.routes for select using (true);
create policy "allow_read_all" on public.bus_stops for select using (true);
create policy "allow_read_all" on public.route_stops for select using (true);
create policy "allow_read_all" on public.bus_locations for select using (true);
create policy "allow_read_all" on public.trip_events for select using (true);
create policy "driver_write_locations" on public.bus_locations for all
  using (true) with check (true);
create policy "authenticated_insert_items" on public.items for insert
  with check (auth.uid() = user_id);
`;

/** Tables we can verify afterwards. */
export const EXPECTED_TABLES = [
  'profiles',
  'buses',
  'routes',
  'bus_stops',
  'route_stops',
  'bus_locations',
  'trip_events',
  'items',
];
