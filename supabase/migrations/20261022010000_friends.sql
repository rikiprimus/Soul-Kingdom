-- Tugas 2.1: friend codes, player names, friend requests and friendships.
-- Only edge functions (service role) read or write these; RLS stays closed to clients.
alter table public.players
  add column friend_code text unique,
  add column display_name text;

-- Players from before this migration get a code from their id.
update public.players
  set friend_code = upper(substr(replace(id::text, '-', ''), 1, 8))
  where friend_code is null;

alter table public.players alter column friend_code set not null;

create table public.friend_requests (
  from_id uuid not null references public.players (id) on delete cascade,
  to_id uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);

-- One row per pair, smaller id first.
create table public.friendships (
  a uuid not null references public.players (id) on delete cascade,
  b uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);

alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
