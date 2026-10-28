-- Tugas 2.3: Arena dan peringkat
-- Arena snapshots for matchmaking and leaderboard.
-- RLS stays closed to clients; only edge functions (service role) access them.

create table public.arena_snapshots (
  player_id uuid primary key references public.players (id) on delete cascade,
  name text not null,
  level int not null,
  power int not null,
  points int not null default 1000,
  tier text not null default 'Perunggu',
  team jsonb not null,
  updated_at timestamptz not null default now()
);

create index arena_snapshots_points_idx on public.arena_snapshots (points desc);
create index arena_snapshots_updated_idx on public.arena_snapshots (updated_at desc);

alter table public.arena_snapshots enable row level security;
