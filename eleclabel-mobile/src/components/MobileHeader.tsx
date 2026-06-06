// Header mobile compact — logo à gauche, titre centré optionnel, bouton retour optionnel.
// Respecte la safe-area iOS (notch).
import { useNavigate } from "react-router-dom";
import AccountMenu from "./AccountMenu";
import SyncStatus from "./SyncStatus";
import LogoMark from "./LogoMark";

interface MobileHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  /** Action custom à droite. Si non fourni, on affiche AccountMenu (sauf si hideAccount=true) */
  rightAction?: JSX.Element;
  /** Force à cacher le AccountMenu par défaut (ex: dans l'éditeur où l'on a undo/redo) */
  hideAccount?: boolean;
}

export default function MobileHeader({
  title,
  subtitle,
  showBack,
  onBack,
  rightAction,
  hideAccount,
}: MobileHeaderProps) {
  const navigate = useNavigate();
  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        background: "#FFFFFF",
        borderBottom: "1px solid #E5E7EB",
        paddingTop: "var(--safe-top)",
        paddingLeft: "var(--safe-left)",
        paddingRight: "var(--safe-right)",
      }}
    >
      <div
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          gap: 8,
        }}
      >
        {/* Gauche : retour OU logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
          {showBack ? (
            <button
              type="button"
              onClick={handleBack}
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                border: "none",
                background: "transparent",
                color: "#111827",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
              aria-label="Retour"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
          ) : (
            <LogoMark size={34} />
          )}
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#111827",
                letterSpacing: "-0.2px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {title ?? "ElecLabel"}
            </div>
            {subtitle ? (
              <div
                style={{
                  fontSize: 11,
                  color: "#9CA3AF",
                  marginTop: 1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {subtitle}
              </div>
            ) : null}
          </div>
        </div>

        {/* Droite : action custom + SyncStatus + AccountMenu par défaut (sauf si hideAccount) */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
          {rightAction}
          {!hideAccount && <SyncStatus />}
          {!hideAccount && <AccountMenu />}
        </div>
      </div>
    </header>
  );
}
