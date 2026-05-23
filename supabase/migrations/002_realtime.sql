-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  ElecLabel — Migration 002 : active Realtime sur invoices/panels  ║
-- ║                                                                    ║
-- ║  À copier-coller dans Supabase → SQL Editor → New query → Run.    ║
-- ║  Sans ça, les modifs faites sur un device ne se propagent pas      ║
-- ║  en live vers les autres devices.                                  ║
-- ║                                                                    ║
-- ║  Idempotent : peut être ré-exécuté sans casser quoi que ce soit.   ║
-- ╚══════════════════════════════════════════════════════════════════╝

do $$
begin
  -- Ajoute la table invoices à la publication realtime de Supabase
  begin
    alter publication supabase_realtime add table public.invoices;
    raise notice 'Realtime activé sur invoices';
  exception when duplicate_object then
    raise notice 'invoices déjà dans supabase_realtime';
  end;

  -- Ajoute la table panels
  begin
    alter publication supabase_realtime add table public.panels;
    raise notice 'Realtime activé sur panels';
  exception when duplicate_object then
    raise notice 'panels déjà dans supabase_realtime';
  end;
end$$;

-- ═══════════════════════════════════════════════════════════════════
-- ✓ Vérification : Database → Replication → tu dois voir
--   invoices et panels avec un toggle bleu (ON)
-- ═══════════════════════════════════════════════════════════════════
