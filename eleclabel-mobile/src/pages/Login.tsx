// Page Login mobile — plein écran, inputs grands, optimisé tactile.
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
        else setSuccess("Compte créé ! Tu peux te connecter.");
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
        background: "linear-gradient(180deg, #0F172A 0%, #1E293B 50%, #FFFFFF 50%)",
        display: "flex",
        flexDirection: "column",
        padding: "var(--safe-top) 0 var(--safe-bottom)",
      }}
    >
      {/* Header avec logo */}
      <div
        style={{
          padding: "40px 24px 30px",
          textAlign: "center",
          color: "#FFFFFF",
        }}
      >
        <div
          style={{
            display: "inline-block",
            borderRadius: 16,
            boxShadow: "0 8px 24px rgba(230,57,70,0.4)",
            marginBottom: 14,
          }}
        >
          <LogoMark size={68} />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 4 }}>
          ElecLabel
        </h1>
        <p style={{ fontSize: 13, opacity: 0.7 }}>
          {mode === "signin" && "Connecte-toi pour retrouver tes tableaux et factures"}
          {mode === "signup" && "Crée ton compte — c'est gratuit"}
          {mode === "forgot" && "Réinitialiser ton mot de passe"}
        </p>
      </div>

      {/* Carte form */}
      <div style={{ flex: 1, padding: "0 16px 24px" }}>
        <form
          onSubmit={handleSubmit}
          style={{
            background: "#FFFFFF",
            borderRadius: 18,
            boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            padding: "22px 20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {mode === "signup" && (
            <Field
              label="Nom (optionnel)"
              type="text"
              value={displayName}
              onChange={setDisplayName}
              placeholder="Alain Simon"
              autoComplete="name"
              inputMode="text"
            />
          )}

          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="alain@exemple.fr"
            autoComplete="email"
            inputMode="email"
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
                padding: "11px 13px",
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                color: "#991B1B",
                fontSize: 13,
                borderRadius: 9,
                lineHeight: 1.4,
              }}
            >
              ⚠ {error}
            </div>
          )}
          {success && (
            <div
              style={{
                padding: "11px 13px",
                background: "#ECFDF5",
                border: "1px solid #A7F3D0",
                color: "#065F46",
                fontSize: 13,
                borderRadius: 9,
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
              padding: "15px",
              fontSize: 15,
              fontWeight: 700,
              borderRadius: 12,
              border: "none",
              background: busy ? "#9CA3AF" : "linear-gradient(135deg, #E63946, #C0303C)",
              color: "#FFFFFF",
              cursor: busy ? "wait" : "pointer",
              boxShadow: busy ? "none" : "0 6px 16px rgba(230,57,70,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              minHeight: 52,
            }}
          >
            {busy ? (
              <>
                <span
                  style={{
                    width: 16,
                    height: 16,
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
                {mode === "forgot" && "Envoyer le lien"}
              </>
            )}
          </button>

          {/* Liens de bascule */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6, alignItems: "center" }}>
            {mode === "signin" && (
              <>
                <LinkButton onClick={() => { setMode("forgot"); setError(null); setSuccess(null); }}>
                  Mot de passe oublié ?
                </LinkButton>
                <div style={{ fontSize: 13, color: "#6B7280" }}>
                  Pas encore de compte ?{" "}
                  <LinkButton onClick={() => { setMode("signup"); setError(null); setSuccess(null); }}>
                    Créer un compte
                  </LinkButton>
                </div>
              </>
            )}
            {mode === "signup" && (
              <div style={{ fontSize: 13, color: "#6B7280" }}>
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
  inputMode?: "text" | "email" | "numeric" | "decimal" | "tel";
  required?: boolean;
}

function Field({ label, type, value, onChange, placeholder, autoComplete, inputMode, required }: FieldProps) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        required={required}
        style={{
          padding: "13px 14px",
          fontSize: 15,
          border: "1.5px solid #E5E7EB",
          borderRadius: 11,
          background: "#FFFFFF",
          color: "#111827",
          outline: "none",
          fontFamily: "inherit",
          minHeight: 48,
          boxSizing: "border-box",
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
        fontSize: 13,
        fontWeight: 600,
        color: "#E63946",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: "4px 0",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}
