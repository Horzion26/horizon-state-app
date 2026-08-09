-- Run this once in your Supabase project's SQL Editor
-- (Supabase dashboard → SQL Editor → New query → paste this → Run)

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  service text not null,
  price numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  category text not null,
  cost numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists schedule_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  event_time text,
  notes text,
  created_at timestamptz not null default now()
);

-- Row Level Security: on, with permissive policies so the app (using the
-- public "anon" key) can read/write. There is no login screen in this app,
-- so anyone who has your app's link and Supabase keys can reach this data.
-- That's fine for a small trusted team, but see the README's "Security note"
-- if you want to lock this down further later (e.g. add Supabase Auth).

alter table clients enable row level security;
alter table expenses enable row level security;
alter table schedule_events enable row level security;

create policy "Allow all access to clients" on clients
  for all using (true) with check (true);

create policy "Allow all access to expenses" on expenses
  for all using (true) with check (true);

create policy "Allow all access to schedule_events" on schedule_events
  for all using (true) with check (true);

-- Enables live sync: lets connected devices receive real-time updates
alter publication supabase_realtime add table clients;
alter publication supabase_realtime add table expenses;
alter publication supabase_realtime add table schedule_events;
