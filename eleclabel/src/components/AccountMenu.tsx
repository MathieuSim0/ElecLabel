// Petit menu rond avec initiale de l'email — clique pour ouvrir dropdown avec déconnexion.
// À placer dans le coin droit des headers Home / Templates / History / Invoices.
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/authStore";

export default function AccountMenu() {
  const { email, signOut } = useAuthStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!email) return null;
  const initial = email[0]?.toUpperCase() ?? "?";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={email}
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: "1.5px solid #E5E7EB",
          background: open ? "#111827" : "#FFFFFF",
          color: open ? "#FFFFFF" : "#111827",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.12s ease",
        }}
        aria-label="Mon compte"
      >
        {initial}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            minWidth: 220,
            background: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: 10,
            boxShadow: "0 10px 32px rgba(0,0,0,0.12)",
            zIndex: 60,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", letterSpacing: 0.4, textTransform: "uppercase" }}>
              Connecté
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#111827",
                marginTop: 2,
                wordBreak: "break-all",
              }}
            >
              {email}
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              setOpen(false);
              await signOut();
            }}
            style={{
              width: "100%",
              padding: "11px 14px",
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              background: "#FFFFFF",
              color: "#DC2626",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#FEF2F2")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
