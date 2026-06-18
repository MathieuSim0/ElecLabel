-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  ElecLabel — Migration 003 : Gestion de stock matériel            ║
-- ║                                                                    ║
-- ║  À copier-coller dans Supabase → SQL Editor → New query → Run.    ║
-- ║  Idempotent : peut être ré-exécuté sans casser quoi que ce soit.   ║
-- ║                                                                    ║
-- ║  Crée :                                                            ║
-- ║   • Table stock_articles   (inventaire matériel)                   ║
-- ║   • Table stock_movements  (journal entrée/sortie/ajustement)      ║
-- ║   • RLS (chaque user ne voit que son stock)                        ║
-- ║   • Realtime sur les 2 tables                                      ║
-- ║  (réutilise la fonction set_updated_at() de la migration 001)      ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════
-- 1. STOCK_ARTICLES — inventaire
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.stock_articles (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  nom              text not null default 'Article',
  categorie        text not null default 'autre'
                     check (categorie in ('protection','cable','appareillage',
                       'conduit_goulotte','boite_coffret','accessoire','consommable','autre')),
  reference        text,
  code_barres      text,
  unite            text not null default 'piece'
                     check (unite in ('piece','metre','rouleau','boite','sachet')),
  quantite_stock   numeric not null default 0,
  seuil_alerte     numeric,
  emplacement      text check (emplacement in ('camion','depot')),
  prix_unitaire_ht numeric,
  fournisseur      text,
  photo            text,
  archived         boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists stock_articles_user_idx       on public.stock_articles(user_id, updated_at desc);
create index if not exists stock_articles_barcode_idx     on public.stock_articles(user_id, code_barres);

alter table public.stock_articles enable row level security;

drop policy if exists "stock_articles_select_own" on public.stock_articles;
drop policy if exists "stock_articles_insert_own" on public.stock_articles;
drop policy if exists "stock_articles_update_own" on public.stock_articles;
drop policy if exists "stock_articles_delete_own" on public.stock_articles;

create policy "stock_articles_select_own" on public.stock_articles
  for select using (auth.uid() = user_id);
create policy "stock_articles_insert_own" on public.stock_articles
  for insert with check (auth.uid() = user_id);
create policy "stock_articles_update_own" on public.stock_articles
  for update using (auth.uid() = user_id);
create policy "stock_articles_delete_own" on public.stock_articles
  for delete using (auth.uid() = user_id);

drop trigger if exists stock_articles_updated_at on public.stock_articles;
create trigger stock_articles_updated_at before update on public.stock_articles
  for each row execute procedure public.set_updated_at();


-- ═══════════════════════════════════════════════════════════════════
-- 2. STOCK_MOVEMENTS — journal (append-only ; source de vérité du stock)
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.stock_movements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  article_id  uuid not null references public.stock_articles(id) on delete cascade,
  type        text not null check (type in ('entree','sortie','ajustement')),
  quantite    numeric not null,
  moved_at    timestamptz not null default now(),
  note        text,
  source      text not null default 'manuel' check (source in ('manuel','scan')),
  created_at  timestamptz not null default now()
);

create index if not exists stock_movements_article_idx on public.stock_movements(article_id, moved_at desc);
create index if not exists stock_movements_user_idx     on public.stock_movements(user_id, moved_at desc);

alter table public.stock_movements enable row level security;

drop policy if exists "stock_movements_select_own" on public.stock_movements;
drop policy if exists "stock_movements_insert_own" on public.stock_movements;
drop policy if exists "stock_movements_delete_own" on public.stock_movements;

create policy "stock_movements_select_own" on public.stock_movements
  for select using (auth.uid() = user_id);
create policy "stock_movements_insert_own" on public.stock_movements
  for insert with check (auth.uid() = user_id);
create policy "stock_movements_delete_own" on public.stock_movements
  for delete using (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════════
-- 3. REALTIME
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  begin
    alter publication supabase_realtime add table public.stock_articles;
    raise notice 'Realtime activé sur stock_articles';
  exception when duplicate_object then
    raise notice 'stock_articles déjà dans supabase_realtime';
  end;

  begin
    alter publication supabase_realtime add table public.stock_movements;
    raise notice 'Realtime activé sur stock_movements';
  exception when duplicate_object then
    raise notice 'stock_movements déjà dans supabase_realtime';
  end;
end$$;

-- ═══════════════════════════════════════════════════════════════════
-- ✓ FIN — Database → Tables : stock_articles, stock_movements
-- ═══════════════════════════════════════════════════════════════════
