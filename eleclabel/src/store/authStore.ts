// Store d'authentification — wrapper zustand autour des appels Supabase Auth.
// Persiste session en localStorage automatiquement (config dans services/supabase.ts).
import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../services/supabase";

interface AuthResult {
  error?: string;
}

interface AuthStore {
  session: Session | null;
  user: User | null;
  /** true tant qu'on n'a pas encore récupéré la session initiale au démarrage */
  loading: boolean;
  /** Email actuellement connecté, helper UI */
  email: string | null;
  /** À appeler une fois au montage de l'app : récupère la session existante + s'abonne aux changements */
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, displayName?: string) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

let initialized = false;

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  user: null,
  loading: true,
  email: null,

  init: async () => {
    if (initialized) return;
    initialized = true;
    try {
      const { data } = await supabase.auth.getSession();
      set({
        session: data.session,
        user: data.session?.user ?? null,
        email: data.session?.user?.email ?? null,
        loading: false,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[auth] getSession failed:", err);
      set({ loading: false });
    }
    // Écoute les changements (login/logout sur un autre onglet, refresh token, etc.)
    supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        email: session?.user?.email ?? null,
      });
    });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) return { error: friendlyAuthError(error.message) };
    return {};
  },

  signUp: async (email, password, displayName) => {
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: displayName ? { display_name: displayName.trim() } : undefined,
      },
    });
    if (error) return { error: friendlyAuthError(error.message) };
    return {};
  },

  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    if (error) return { error: friendlyAuthError(error.message) };
    return {};
  },

  signOut: async () => {
    await supabase.auth.signOut();
  },
}));

// Traduit les erreurs Supabase en messages français lisibles.
function friendlyAuthError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("invalid login credentials")) return "Email ou mot de passe incorrect.";
  if (lower.includes("user already registered")) return "Cet email est déjà utilisé. Connecte-toi.";
  if (lower.includes("password should be at least")) return "Le mot de passe doit faire au moins 6 caractères.";
  if (lower.includes("email rate limit")) return "Trop de tentatives. Réessaie dans quelques minutes.";
  if (lower.includes("email not confirmed")) return "Confirme d'abord ton email (regarde tes spams).";
  if (lower.includes("network")) return "Problème de connexion internet. Réessaie.";
  return msg;
}
