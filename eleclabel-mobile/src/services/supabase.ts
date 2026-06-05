// Client Supabase — singleton. Lit l'URL et la clé anon depuis .env.
// La clé anon est destinée à être publique ; c'est la RLS côté Supabase qui sécurise les données.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY manquant dans .env — l'auth et la sync ne fonctionneront pas.",
  );
}

export const supabase: SupabaseClient = createClient(
  // || (pas ??) pour aussi remplacer une chaîne vide → évite "supabaseUrl is required"
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key",
  {
    auth: {
      // Persiste la session en localStorage → l'utilisateur reste connecté entre redémarrages
      persistSession: true,
      autoRefreshToken: true,
      // Pas de redirection OAuth pour l'instant (email+mdp uniquement)
      detectSessionInUrl: false,
    },
  },
);

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}
