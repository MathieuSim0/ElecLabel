-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  ElecLabel — Migration initiale Supabase                          ║
-- ║                                                                    ║
-- ║  À copier-coller dans Supabase → SQL Editor → New query → Run.    ║
-- ║  Idempotent : peut être ré-exécuté sans casser quoi que ce soit.   ║
-- ║                                                                    ║
-- ║  Crée :                                                            ║
-- ║   • Table profiles  (1 ligne par utilisateur, prolonge auth.users) ║
-- ║   • Table panels    (tableaux électriques + étiquettes)            ║
-- ║   • Table invoices  (factures avec metadata OCR)                   ║
-- ║   • Bucket Storage  'invoices' (privé, pour les photos)            ║
-- ║   • RLS policies    (chaque user ne voit que ses données)          ║
-- ║   • Triggers        (updated_at auto, profile auto à l'inscription)║
-- ╚══════════════════════════════════════════════════════════════════╝


-- ═══════════════════════════════════════════════════════════════════
-- 1. PROFILES — étend auth.users avec préférences (tél ASE, nom…)
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own"   on public.profiles;
drop policy if exists "profiles_insert_own"   on public.profiles;
drop policy if exists "profiles_update_own"   on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);


-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ═══════════════════════════════════════════════════════════════════
-- 2. PANELS — tableaux électriques (analyse photo, modèles, manuels)
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.panels (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null default 'Tableau sans nom',
  source        text not null default 'manual' check (source in ('photo','template','manual')),
  panel_data    jsonb not null,
  thumbnail     text,
  breaker_count int  not null default 0,
  row_count     int  not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists panels_user_updated_idx on public.panels(user_id, updated_at desc);

alter table public.panels enable row level security;

drop policy if exists "panels_select_own" on public.panels;
drop policy if exists "panels_insert_own" on public.panels;
drop policy if exists "panels_update_own" on public.panels;
drop policy if exists "panels_delete_own" on public.panels;

create policy "panels_select_own" on public.panels
  for select using (auth.uid() = user_id);
create policy "panels_insert_own" on public.panels
  for insert with check (auth.uid() = user_id);
create policy "panels_update_own" on public.panels
  for update using (auth.uid() = user_id);
create policy "panels_delete_own" on public.panels
  for delete using (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════════
-- 3. INVOICES — factures (photo dans Storage, méta + OCR ici)
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.invoices (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  supplier            text,
  invoice_date        date,
  reference           text,
  amount_cents        int,
  notes               text,
  ocr_raw_text        text,
  reviewed            boolean not null default false,
  thumbnail           text,
  image_storage_path  text,
  image_mime_type     text not null default 'image/jpeg',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists invoices_user_created_idx on public.invoices(user_id, created_at desc);
create index if not exists invoices_user_date_idx    on public.invoices(user_id, invoice_date desc);

alter table public.invoices enable row level security;

drop policy if exists "invoices_select_own" on public.invoices;
drop policy if exists "invoices_insert_own" on public.invoices;
drop policy if exists "invoices_update_own" on public.invoices;
drop policy if exists "invoices_delete_own" on public.invoices;

create policy "invoices_select_own" on public.invoices
  for select using (auth.uid() = user_id);
create policy "invoices_insert_own" on public.invoices
  for insert with check (auth.uid() = user_id);
create policy "invoices_update_own" on public.invoices
  for update using (auth.uid() = user_id);
create policy "invoices_delete_own" on public.invoices
  for delete using (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════════
-- 4. updated_at automatique
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists panels_updated_at on public.panels;
create trigger panels_updated_at before update on public.panels
  for each row execute procedure public.set_updated_at();

drop trigger if exists invoices_updated_at on public.invoices;
create trigger invoices_updated_at before update on public.invoices
  for each row execute procedure public.set_updated_at();


-- ═══════════════════════════════════════════════════════════════════
-- 5. STORAGE — bucket privé pour les photos de factures
--    Chemin : invoices/{user_id}/{invoice_id}.jpg
-- ═══════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

-- Policies Storage : un utilisateur ne voit / écrit / supprime que ses propres fichiers,
-- identifiés par le 1er segment du chemin = son user_id.
drop policy if exists "invoices_storage_select_own" on storage.objects;
drop policy if exists "invoices_storage_insert_own" on storage.objects;
drop policy if exists "invoices_storage_update_own" on storage.objects;
drop policy if exists "invoices_storage_delete_own" on storage.objects;

create policy "invoices_storage_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "invoices_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "invoices_storage_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "invoices_storage_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);


-- ═══════════════════════════════════════════════════════════════════
-- ✓ FIN — schéma prêt
--   Vérifications utiles dans le dashboard Supabase :
--    • Database → Tables : tu dois voir profiles, panels, invoices
--    • Storage → Buckets : tu dois voir 'invoices' (privé)
--    • Authentication → Policies (RLS) : tout en vert
-- ═══════════════════════════════════════════════════════════════════
