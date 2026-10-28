-- Tugas 2.2: Serbu markas pemain lain (PvP)
-- Defense snapshots for matchmaking, and battle logs for defense replays.
-- RLS stays closed to clients; only edge functions (service role) access them.

create table public.pvp_snapshots (
  player_id uuid primary key references public.players (id) on delete cascade,
  name text not null,
  town_hall int not null,
  level int not null,
  power int not null,
  trophies int not null default 1000,
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

create index pvp_snapshots_power_idx on public.pvp_snapshots (power);
create index pvp_snapshots_trophies_idx on public.pvp_snapshots (trophies);

create table public.pvp_battles (
  id uuid primary key default gen_random_uuid(),
  defender_id uuid not null references public.players (id) on delete cascade,
  attacker_id uuid not null references public.players (id) on delete cascade,
  attacker_name text not null,
  attacker_level int not null,
  attacker_power int not null,
  won boolean not null,
  trophy_change int not null,
  stolen jsonb not null,
  replay jsonb not null,
  created_at timestamptz not null default now()
);

create index pvp_battles_defender_idx on public.pvp_battles (defender_id, created_at desc);

alter table public.pvp_snapshots enable row level security;
alter table public.pvp_battles enable row level security;
