-- Tugas 2C.2: Web portal news and administration
-- News articles table for game portal and announcements
create table public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null default '',
  content text not null,
  category text not null check (category in ('update', 'event', 'maintenance', 'community')),
  status text not null default 'draft' check (status in ('draft', 'published', 'hidden')),
  cover_url text,
  author text not null default 'Admin',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index news_slug_idx on public.news (slug);
create index news_published_idx on public.news (status, published_at desc);

-- Admins authorization table
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'editor')) default 'admin',
  created_at timestamptz not null default now()
);

-- Public storage bucket for article cover images
insert into storage.buckets (id, name, public)
values ('news-covers', 'news-covers', true)
on conflict (id) do nothing;

-- RLS for news table
alter table public.news enable row level security;

create policy "Public can read published news"
  on public.news for select
  using (status = 'published' and published_at is not null and published_at <= now());

create policy "Admins can manage all news"
  on public.news for all
  using ((select auth.uid()) in (select user_id from public.admins));

-- RLS for admins table
alter table public.admins enable row level security;

create policy "Admins can view their own role"
  on public.admins for select
  using ((select auth.uid()) = user_id);

-- Storage bucket policies for news-covers
create policy "Public can view news cover images"
  on storage.objects for select
  using (bucket_id = 'news-covers');

create policy "Admins can upload news cover images"
  on storage.objects for insert
  with check (
    bucket_id = 'news-covers'
    and (select auth.uid()) in (select user_id from public.admins)
  );

create policy "Admins can update news cover images"
  on storage.objects for update
  using (
    bucket_id = 'news-covers'
    and (select auth.uid()) in (select user_id from public.admins)
  );

create policy "Admins can delete news cover images"
  on storage.objects for delete
  using (
    bucket_id = 'news-covers'
    and (select auth.uid()) in (select user_id from public.admins)
  );
