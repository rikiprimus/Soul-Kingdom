-- Tugas 1.6: one row per player with the whole PlayerState (serializeState format:
-- { schemaVersion, state }). Only the `action` edge function writes it (service role);
-- players may read their own row.
create table public.players (
  id uuid primary key references auth.users (id) on delete cascade,
  save jsonb not null,
  -- Bumped on every write; a write against an older revision is refused (two tabs, retries).
  revision integer not null default 0,
  -- Server time (s) of the last accepted play-time beat.
  beat_at bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.players enable row level security;

create policy "Players read their own save"
  on public.players for select
  using ((select auth.uid()) = id);
