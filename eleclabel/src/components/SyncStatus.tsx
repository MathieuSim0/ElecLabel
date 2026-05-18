// Badge discret affichant l'état de la sync cloud.
// État dérivé : online + queue length → 'synced' | 'pending' | 'offline'
import { useEffect, useState } from "react";
import { getQueueLength, subscribeQueue, flush } from "../services/syncQueue";

type Status = "synced" | "pending" | "offline" | "syncing";

export default function SyncStatus() {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const refresh = async () => setPending(await getQueueLength());
    refresh();
    const unsub = subscribeQueue(refresh);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      unsub();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const status: Status = !online
    ? "offline"
    : syncing
    ? "syncing"
    : pending > 0
    ? "pending"
    : "synced";

  const handleClick = async () => {
    if (status === "offline" || status === "syncing") return;
    setSyncing(true);
    try {
      await flush();
    } finally {
      setSyncing(false);
    }
  };

  const config = STATUS_CONFIG[status];

  return (
    <button
      type="button"
      onClick={handleClick}
      title={config.tooltip(pending)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 9px",
        fontSize: 11,
        fontWeight: 600,
        borderRadius: 999,
        border: `1px solid ${config.border}`,
        background: config.bg,
        color: config.fg,
        cursor: status === "pending" || status === "synced" ? "pointer" : "default",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: config.dot,
          animation: status === "syncing" ? "syncPulse 1s infinite" : "none",
        }}
      />
      {config.label(pending)}
      <style>{`@keyframes syncPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </button>
  );
}

const STATUS_CONFIG: Record<
  Status,
  {
    label: (n: number) => string;
    tooltip: (n: number) => string;
    bg: string;
    fg: string;
    border: string;
    dot: string;
  }
> = {
  synced: {
    label: () => "Synchronisé",
    tooltip: () => "Toutes tes données sont à jour dans le cloud",
    bg: "#ECFDF5",
    fg: "#065F46",
    border: "#A7F3D0",
    dot: "#10B981",
  },
  pending: {
    label: (n) => `${n} en attente`,
    tooltip: (n) => `${n} modification${n > 1 ? "s" : ""} à pousser — clique pour forcer la sync`,
    bg: "#FFFBEB",
    fg: "#92400E",
    border: "#FDE68A",
    dot: "#F59E0B",
  },
  syncing: {
    label: () => "Sync…",
    tooltip: () => "Envoi en cours…",
    bg: "#EEF2FF",
    fg: "#3730A3",
    border: "#C7D2FE",
    dot: "#6366F1",
  },
  offline: {
    label: () => "Hors ligne",
    tooltip: () =>
      "Pas de réseau. Tes modifs sont sauvegardées localement et seront poussées dès que tu seras à nouveau en ligne.",
    bg: "#F3F4F6",
    fg: "#4B5563",
    border: "#E5E7EB",
    dot: "#9CA3AF",
  },
};
