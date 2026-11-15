-- Run after supabase-schema.sql. This migration removes the permissive write
-- policies from the prototype schema, adds secure admin authorization, and
-- creates public image/preview buckets. Do not expose service-role keys in browser code.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- A signed-in user may check whether their own UID is an admin; they cannot add themselves.
drop policy if exists "Users can read own admin status" on public.admin_users;
create policy "Users can read own admin status" on public.admin_users
for select to authenticated using (user_id = auth.uid());

-- Drop prototype policies that allowed every visitor to modify catalog data.
drop policy if exists "Admins can update products" on public.products;
drop policy if exists "Admins can insert products" on public.products;
drop policy if exists "Admins can update licenses" on public.licenses;
drop policy if exists "Admins can insert licenses" on public.licenses;

-- RLS checks the admin allow-list for all catalog writes.
create policy "Admins can insert products" on public.products
for insert to authenticated
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

create policy "Admins can update products" on public.products
for update to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

create policy "Admins can delete products" on public.products
for delete to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

create policy "Admins can manage licenses" on public.licenses
for all to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

alter table public.products add column if not exists art_url text;
alter table public.products add column if not exists preview_url text;

-- Public read access for listing only active beats.
drop policy if exists "Public can read products" on public.products;
create policy "Public can read active products" on public.products
for select to anon, authenticated using (status = 'active');

-- Create public buckets for cover art and short/watermarked previews. Never put paid master files here.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('beat-art', 'beat-art', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('beat-previews', 'beat-previews', true, 20971520, array['audio/mpeg','audio/wav','audio/ogg','audio/mp4'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can read beat art" on storage.objects
for select to anon, authenticated using (bucket_id = 'beat-art');

create policy "Public can read short previews" on storage.objects
for select to anon, authenticated using (bucket_id = 'beat-previews');

create policy "Admins can upload beat art" on storage.objects
for insert to authenticated
with check (bucket_id = 'beat-art' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

create policy "Admins can update beat art" on storage.objects
for update to authenticated
using (bucket_id = 'beat-art' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (bucket_id = 'beat-art' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

create policy "Admins can delete beat art" on storage.objects
for delete to authenticated
using (bucket_id = 'beat-art' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

create policy "Admins can upload previews" on storage.objects
for insert to authenticated
with check (bucket_id = 'beat-previews' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

create policy "Admins can update previews" on storage.objects
for update to authenticated
using (bucket_id = 'beat-previews' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (bucket_id = 'beat-previews' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

create policy "Admins can delete previews" on storage.objects
for delete to authenticated
using (bucket_id = 'beat-previews' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- Do not allow direct browser writes to order records as proof of payment.
-- Payment checkout + fulfillment must be implemented in a trusted Edge Function
-- with Stripe/Midtrans webhook verification before granting download access.
drop policy if exists "Public can insert orders" on public.orders;
