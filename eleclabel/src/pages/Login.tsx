// Écran d'authentification — bascule entre Connexion, Inscription, Mot de passe oublié.
// Affiché tant que l'utilisateur n'est pas connecté (via AuthGate).
import { useState } from "react";
import { useAuthStore } from "../store/authStore";
import LogoMark from "../components/LogoMark";

type Mode = "signin" | "signup" | "forgot";

export default function Login() {
  const { signIn, signUp, resetPassword } = useAuthStore();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      if (mode === "signin") {
        const res = await signIn(email, password);
        if (res.error) setError(res.error);
      } else if (mode === "signup") {
        if (password.length < 6) {
          setError("Le mot de passe doit faire au moins 6 caractères.");
          return;
        }
        const res = await signUp(email, password, displayName || undefined);
        if (res.error) setError(res.error);
        else setSuccess("Compte créé ! Tu peux maintenant te connecter.");
      } else if (mode === "forgot") {
        const res = await resetPassword(email);
        if (res.error) setError(res.error);
        else setSuccess("Email envoyé. Vérifie ta boîte (et les spams).");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#FFFFFF",
          borderRadius: 18,
          boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
          overflow: "hidden",
        }}
      >
        {/* Header avec logo */}
        <div
          style={{
            padding: "26px 28px 22px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            borderBottom: "1px solid #F1F5F9",
          }}
        >
          <div style={{ boxShadow: "0 6px 16px rgba(230,57,70,0.35)", borderRadius: 12 }}>
            <LogoMark size={48} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", letterSpacing: "-0.3px" }}>
              ElecLabel
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 1 }}>
              {mode === "signin" && "Connecte-toi à ton compte"}
              {mode === "signup" && "Crée ton compte gratuit"}
              {mode === "forgot" && "Réinitialiser ton mot de passe"}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "22px 28px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {mode === "signup" && (
            <Field
              label="Nom (optionnel)"
              type="text"
              value={displayName}
              onChange={setDisplayName}
              placeholder="Alain Simon"
              autoComplete="name"
            />
          )}

          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="alain@exemple.fr"
            autoComplete="email"
            required
          />

          {mode !== "forgot" && (
            <Field
              label="Mot de passe"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder={mode === "signup" ? "6 caractères minimum" : "Ton mot de passe"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
            />
          )}

          {error && (
            <div
              style={{
                padding: "10px 12px",
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                color: "#991B1B",
                fontSize: 12,
                borderRadius: 8,
                lineHeight: 1.4,
              }}
            >
              ⚠ {error}
            </div>
          )}
          {success && (
            <div
              style={{
                padding: "10px 12px",
                background: "#ECFDF5",
                border: "1px solid #A7F3D0",
                color: "#065F46",
                fontSize: 12,
                borderRadius: 8,
                lineHeight: 1.4,
              }}
            >
              ✓ {success}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: 4,
              padding: "13px",
              fontSize: 14,
              fontWeight: 700,
              borderRadius: 11,
              border: "none",
              background: busy ? "#9CA3AF" : "linear-gradient(135deg, #E63946, #C0303C)",
              color: "#FFFFFF",
              cursor: busy ? "wait" : "pointer",
              boxShadow: busy ? "none" : "0 6px 16px rgba(230,57,70,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {busy ? (
              <>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#FFF",
                    animation: "loginSpin 0.8s linear infinite",
                  }}
                />
                Patiente…
              </>
            ) : (
              <>
                {mode === "signin" && "Se connecter"}
                {mode === "signup" && "Créer mon compte"}
                {mode === "forgot" && "Envoyer le lien de réinitialisation"}
              </>
            )}
          </button>

          {/* Liens de bascule */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4, alignItems: "center" }}>
            {mode === "signin" && (
              <>
                <LinkButton onClick={() => { setMode("forgot"); setError(null); setSuccess(null); }}>
                  Mot de passe oublié ?
                </LinkButton>
                <div style={{ fontSize: 12, color: "#6B7280" }}>
                  Pas encore de compte ?{" "}
                  <LinkButton onClick={() => { setMode("signup"); setError(null); setSuccess(null); }}>
                    Créer un compte
                  </LinkButton>
                </div>
              </>
            )}
            {mode === "signup" && (
              <div style={{ fontSize: 12, color: "#6B7280" }}>
                Déjà inscrit ?{" "}
                <LinkButton onClick={() => { setMode("signin"); setError(null); setSuccess(null); }}>
                  Se connecter
                </LinkButton>
              </div>
            )}
            {mode === "forgot" && (
              <LinkButton onClick={() => { setMode("signin"); setError(null); setSuccess(null); }}>
                ← Retour à la connexion
              </LinkButton>
            )}
          </div>
        </form>
      </div>

      <style>{`
        @keyframes loginSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

interface FieldProps {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}

function Field({ label, type, value, onChange, placeholder, autoComplete, required }: FieldProps) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        style={{
          padding: "11px 13px",
          fontSize: 14,
          border: "1.5px solid #E5E7EB",
          borderRadius: 10,
          background: "#FFFFFF",
          color: "#111827",
          outline: "none",
          fontFamily: "inherit",
          transition: "border-color 0.12s ease",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "#E63946")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "#E5E7EB")}
      />
    </label>
  );
}

function LinkButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: "#E63946",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: 0,
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}
