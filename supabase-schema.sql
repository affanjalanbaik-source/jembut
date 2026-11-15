-- 1) Products catalog
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  genre text,
  bpm int,
  key text,
  price numeric(10,2) not null default 0,
  colors jsonb not null default '[]'::jsonb,
  art text default 'night',
  description text,
  tags jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) License tiers
create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) default 0,
  files jsonb not null default '[]'::jsonb,
  summary text,
  created_at timestamptz not null default now()
);

-- 3) Customer orders / checkout transactions
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_email text,
  buyer_name text,
  buyer_phone text,
  product_id text,
  product_title text,
  license_id text,
  license_name text,
  amount numeric(10,2) not null default 0,
  status text not null default 'pending',
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Optional admin/analytics table
create table if not exists public.inventory_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  product_id text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Row level security
alter table public.products enable row level security;
alter table public.licenses enable row level security;
alter table public.orders enable row level security;
alter table public.inventory_events enable row level security;

-- Read access for everyone (public storefront)
create policy if not exists "Public can read products" on public.products
for select using (true);

create policy if not exists "Public can read licenses" on public.licenses
for select using (true);

create policy if not exists "Public can insert orders" on public.orders
for insert with check (true);

-- If using authenticated admin, replace the following with service-role only in production.
create policy if not exists "Admins can update products" on public.products
for update using (true) with check (true);

create policy if not exists "Admins can insert products" on public.products
for insert with check (true);

create policy if not exists "Admins can update licenses" on public.licenses
for update using (true) with check (true);

create policy if not exists "Admins can insert licenses" on public.licenses
for insert with check (true);

-- Seed demo product rows
insert into public.products (slug, title, genre, bpm, key, price, colors, art, description, tags, status)
values
  ('nightshift', 'NIGHTSHIFT', 'R&B / Trap', 142, 'F#m', 19.99, '[]'::jsonb, 'night', 'Late-night melodic trap texture built for dusty hooks and silky vocals.', '[]'::jsonb, 'active'),
  ('no-signal', 'NO SIGNAL', 'Jerk', 160, 'C#m', 16.99, '[]'::jsonb, 'signal', 'Compressed drums and heavy 808 texture with sharp rhythmic energy.', '[]'::jsonb, 'active'),
  ('after-hours', 'AFTER HOURS', 'Melodic Trap', 136, 'G#m', 19.99, '[]'::jsonb, 'hours', 'Warm atmosphere and melodic piano layers for late-night releases.', '[]'::jsonb, 'active'),
  ('cold-heart', 'COLD HEART', 'R&B', 118, 'Am', 24.99, '[]'::jsonb, 'cold', 'Dreamy and emotional heat with delicate vocal-friendly movement.', '[]'::jsonb, 'active'),
  ('offline', 'OFFLINE', 'Rage', 154, 'Dm', 16.99, '[]'::jsonb, 'offline', 'Hard-hitting drums with dark synth tension for aggressive performance.', '[]'::jsonb, 'active'),
  ('2am-again', '2AM AGAIN', 'Ambient Trap', 130, 'Em', 19.99, '[]'::jsonb, 'again', 'Moody, spacious, nocturnal instrumentals with wide cinematic movement.', '[]'::jsonb, 'active')
on conflict (slug) do nothing;

insert into public.licenses (name, price, files, summary)
values
  ('Basic', 19.99, '[]'::jsonb, 'Basic license for non-exclusive use with MP3 delivery and personal distribution rights.'),
  ('Premium', 39.99, '[]'::jsonb, 'Extended usage rights for content creators and release projects.'),
  ('Exclusive', 149.99, '[]'::jsonb, 'Full exclusive rights, producer approval, and commercial usage inclusion.')
on conflict do nothing;
