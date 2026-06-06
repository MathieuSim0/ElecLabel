// AuthGate — bloque l'affichage des pages tant que l'utilisateur n'est pas connecté.
// Au login, déclenche :
//  1. Migration des données locales vers le cloud (1ʳᵉ fois uniquement)
//  2. Flush de la queue offline (modifs pendantes)
//  3. Pull complet depuis le cloud
//  4. Abonnement aux changements Realtime
// Au logout : désabonnement Realtime + clearQueue (évite de pousser sur le mauvais compte)
import { useEffect, useState } from "react";
import { get as idbGet, set as idbSet } from "idb-keyval";
import { useAuthStore } from "../store/authStore";
import { useInvoiceStore } from "../store/invoiceStore";
import { useHistoryStore } from "../store/historyStore";
import { pushInvoice, pushPanel, getCurrentUserId } from "../services/cloudSync";
import { flush, clearQueue } from "../services/syncQueue";
import { subscribeRealtime, unsubscribeRealtime } from "../services/realtime";
import Login from "../pages/Login";

interface AuthGateProps {
  children: React.ReactNode;
}

const MIGRATION_FLAG = "eleclabel-migration-v1-done";

export default function AuthGate({ children }: AuthGateProps) {
  const { user, loading, init } = useAuthStore();
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string>("");
  // IMPORTANT : dépend de user.id (string|null), PAS de user (objet).
  // Sans ça, Supabase qui rafraîchit le token au retour de la caméra Android crée un
  // nouveau objet user (même id !) et relance toute la sync → on perd la facture
  // en cours de vérification (pending state dans Invoices.tsx).
  const userId = user?.id ?? null;

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!userId) {
      // Logout : coupe Realtime + vide queue (évite push sur mauvais compte)
      unsubscribeRealtime();
      void clearQueue();
      return;
    }
    // Login OU changement d'utilisateur (pas juste token refresh)
    void runInitialSync(setSyncing, setSyncMessage).then(() => {
      subscribeRealtime(userId);
    });
    return () => {
      unsubscribeRealtime();
    };
  }, [userId]);

  if (loading) {
    return <FullscreenLoader message="Connexion…" />;
  }

  if (!user) {
    return <Login />;
  }

  if (syncing) {
    return <FullscreenLoader message={syncMessage} />;
  }

  return <>{children}</>;
}

async function runInitialSync(
  setSyncing: (v: boolean) => void,
  setMsg: (m: string) => void,
): Promise<void> {
  setSyncing(true);
  try {
    const userId = await getCurrentUserId();
    if (!userId) return;

    // ── Migration des données pré-Supabase (1ʳᵉ fois seulement) ──
    const migrated = await idbGet(MIGRATION_FLAG);
    if (!migrated) {
      const localInvoices = useInvoiceStore.getState().invoices;
      const localPanels = useHistoryStore.getState().entries;
      const total = localInvoices.length + localPanels.length;

      if (total > 0) {
        setMsg(`Migration de tes données locales (${total} éléments)…`);
        let count = 0;
        for (const inv of localInvoices) {
          // Re-génère un UUID propre puisque les anciens IDs ne sont pas au format uuid
          const newId = generateUuid();
          try {
            await pushInvoice({ ...inv, id: newId }, userId);
          } catch (err) {
            console.warn("Migration invoice failed:", err);
          }
          count++;
          setMsg(`Migration… ${count}/${total}`);
        }
        for (const entry of localPanels) {
          const newId = generateUuid();
          try {
            await pushPanel({ ...entry, id: newId }, userId);
          } catch (err) {
            console.warn("Migration panel failed:", err);
          }
          count++;
          setMsg(`Migration… ${count}/${total}`);
        }
        // Vide le cache local (sera rechargé depuis le cloud juste après)
        await useInvoiceStore.getState().clearLocal();
        useHistoryStore.getState().clearLocal();
      }
      await idbSet(MIGRATION_FLAG, true);
    }

    // ── Flush des modifs offline en attente (faites avant le login ou hors-ligne) ──
    setMsg("Envoi des modifications en attente…");
    try {
      await flush();
    } catch (err) {
      console.warn("[AuthGate] flush failed:", err);
    }

    // ── Pull complet depuis le cloud ──
    setMsg("Synchronisation depuis le cloud…");
    await Promise.all([
      useInvoiceStore.getState().load(),
      useHistoryStore.getState().refreshFromCloud(),
    ]);
  } catch (err) {
    console.warn("[AuthGate] initial sync failed:", err);
  } finally {
    setSyncing(false);
  }
}

function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function FullscreenLoader({ message }: { message: string }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0F172A, #1E293B)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 18,
        color: "#FFFFFF",
        fontFamily: "var(--font-sans)",
        padding: 20,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "3px solid rgba(255,255,255,0.15)",
          borderTopColor: "#E63946",
          animation: "authgateSpin 0.9s linear infinite",
        }}
      />
      <div style={{ fontSize: 13, opacity: 0.85, maxWidth: 300 }}>{message}</div>
      <style>{`@keyframes authgateSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
