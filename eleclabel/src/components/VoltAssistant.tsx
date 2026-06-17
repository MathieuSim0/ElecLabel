// Volt — assistant conversationnel flottant (desktop).
// Robot ancré en bas à droite ; au clic, une bulle popover s'ouvre juste au-dessus.
// Lit le tableau courant (panelStore) pour répondre en contexte.
import { useEffect, useRef, useState } from "react";
import { usePanelStore } from "../store/panelStore";
import { askVolt, type ChatMessage } from "../services/assistant";

const ACCENT = "#0EA5C4";
const ACCENT_DARK = "#0B7E96";

// Suggestions affichées quand la conversation est vide. Celles finissant par "…"
// pré-remplissent le champ (question à compléter) au lieu d'envoyer directement.
const CHIPS = [
  "Vérifier ce tableau",
  "Aider à nommer les disjoncteurs",
  "Quelle section pour…",
  "Code couleur",
];

export default function VoltAssistant() {
  const panel = usePanelStore((s) => s.panel);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Échap + clic extérieur ferment la bulle
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  // Focus le champ à l'ouverture
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  // Auto-scroll vers le bas à chaque nouveau message / pendant la réflexion
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || thinking) return;
    setError(null);
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setThinking(true);
    try {
      const reply = await askVolt(next, panel);
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Volt n'a pas pu répondre.");
    } finally {
      setThinking(false);
    }
  };

  const onChip = (chip: string) => {
    if (chip.endsWith("…")) {
      setInput(chip.replace(/…$/, " "));
      inputRef.current?.focus();
    } else {
      void send(chip);
    }
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  // Vide la conversation courante (après confirmation) → retour aux chips.
  // Le backend est stateless : il suffit de réinitialiser l'état local.
  const resetConversation = () => {
    if (messages.length === 0 && !error) return;
    if (window.confirm("Effacer cette conversation ?")) {
      setMessages([]);
      setError(null);
      setInput("");
    }
  };

  return (
    <div ref={rootRef} style={{ position: "fixed", right: 20, bottom: 20, zIndex: 9999, fontFamily: "var(--font-sans)" }}>
      <style>{KEYFRAMES}</style>

      {/* ── Bulle de conversation ── */}
      {open && (
        <div
          role="dialog"
          aria-label="Assistant Volt"
          style={{
            position: "absolute",
            right: 0,
            bottom: 78,
            width: 400,
            maxWidth: "calc(100vw - 40px)",
            maxHeight: "70vh",
            display: "flex",
            flexDirection: "column",
            background: "#FFFFFF",
            borderRadius: 18,
            border: "1px solid #E5E7EB",
            boxShadow: "0 20px 50px rgba(15,23,42,0.22)",
            overflow: "hidden",
            transformOrigin: "bottom right",
            animation: "volt-pop 160ms ease-out",
          }}
        >
          {/* En-tête */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`, color: "#FFFFFF" }}>
            <RobotIcon size={28} thinking={thinking} mono />
            <div style={{ flex: 1, lineHeight: 1.1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Volt</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>Assistant électricien</div>
            </div>
            <button
              type="button"
              onClick={resetConversation}
              aria-label="Recommencer la conversation"
              title="Recommencer"
              style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#FFF", width: 28, height: 28, borderRadius: 8, cursor: "pointer", fontSize: 15, lineHeight: 1, marginRight: 6 }}
            >
              ↻
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#FFF", width: 28, height: 28, borderRadius: 8, cursor: "pointer", fontSize: 16, lineHeight: 1 }}
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10, background: "#F8FAFC" }}>
            {messages.length === 0 && !thinking && (
              <div style={{ color: "#475569", fontSize: 13, lineHeight: 1.5 }}>
                Salut 👋 Je suis Volt. Pose-moi une question métier, ou demande-moi un coup de main sur le tableau ouvert.
              </div>
            )}

            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} content={m.content} />
            ))}

            {thinking && <Typing />}

            {error && (
              <div style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA", borderRadius: 10, padding: "8px 10px", fontSize: 12.5 }}>
                {error}
              </div>
            )}

            {messages.length === 0 && !thinking && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {CHIPS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onChip(c)}
                    style={{ background: "#FFFFFF", border: `1px solid ${ACCENT}`, color: ACCENT_DARK, borderRadius: 999, padding: "6px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Saisie */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, padding: 10, borderTop: "1px solid #E5E7EB", background: "#FFFFFF" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onInputKey}
              rows={1}
              placeholder="Écris à Volt…"
              style={{ flex: 1, resize: "none", maxHeight: 100, border: "1px solid #E5E7EB", borderRadius: 12, padding: "9px 11px", fontSize: 13.5, fontFamily: "inherit", outline: "none", lineHeight: 1.4 }}
            />
            <button
              type="button"
              onClick={() => void send(input)}
              disabled={thinking || !input.trim()}
              aria-label="Envoyer"
              style={{
                background: thinking || !input.trim() ? "#CBD5E1" : ACCENT,
                border: "none",
                color: "#FFFFFF",
                width: 38,
                height: 38,
                borderRadius: 11,
                cursor: thinking || !input.trim() ? "default" : "pointer",
                flexShrink: 0,
                fontSize: 16,
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}

      {/* ── Robot flottant ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fermer Volt" : "Ouvrir l'assistant Volt"}
        aria-expanded={open}
        style={{
          width: 60,
          height: 60,
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`,
          boxShadow: open ? "0 6px 16px rgba(14,165,196,0.45)" : "0 8px 22px rgba(14,165,196,0.40)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: open ? "none" : "volt-float 3.4s ease-in-out infinite",
          transition: "transform 120ms ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.06)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <RobotIcon size={34} thinking={thinking} mono />
      </button>
    </div>
  );
}

// ─────────────────────────── Sous-composants ───────────────────────────

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div
        style={{
          maxWidth: "85%",
          padding: "9px 12px",
          borderRadius: 14,
          fontSize: 13.5,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          background: isUser ? ACCENT : "#FFFFFF",
          color: isUser ? "#FFFFFF" : "#1E293B",
          border: isUser ? "none" : "1px solid #E5E7EB",
          borderBottomRightRadius: isUser ? 4 : 14,
          borderBottomLeftRadius: isUser ? 14 : 4,
        }}
      >
        {isUser ? content : renderLight(content)}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748B", fontSize: 13, padding: "4px 2px" }}>
      <span style={{ display: "inline-flex", gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT, animation: `volt-blink 1s ${i * 0.18}s infinite` }} />
        ))}
      </span>
      Volt réfléchit…
    </div>
  );
}

// Robot mascotte. mono = monochrome blanc (sur fond coloré) ; sinon dégradé.
function RobotIcon({ size = 34, thinking = false, mono = false }: { size?: number; thinking?: boolean; mono?: boolean }) {
  const body = mono ? "#FFFFFF" : ACCENT;
  const eye = mono ? ACCENT : "#FFFFFF";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" style={{ display: "block" }}>
      {/* antenne éclair */}
      <path d="M24 3 L20 13 L24 13 L21 21 L30 11 L25 11 Z" fill={mono ? "#FFE27A" : "#F5C518"} />
      {/* tête */}
      <rect x="9" y="14" width="30" height="24" rx="9" fill={body} />
      {/* visière */}
      <rect x="13" y="19" width="22" height="13" rx="6.5" fill={mono ? "rgba(14,165,196,0.85)" : "#0B3B47"} />
      {/* yeux */}
      <circle cx="19.5" cy="25.5" r="2.6" fill={eye} style={{ animation: thinking ? "volt-blink 0.7s infinite" : "none" }} />
      <circle cx="28.5" cy="25.5" r="2.6" fill={eye} style={{ animation: thinking ? "volt-blink 0.7s 0.15s infinite" : "none" }} />
      {/* oreilles */}
      <rect x="6" y="22" width="3" height="8" rx="1.5" fill={body} />
      <rect x="39" y="22" width="3" height="8" rx="1.5" fill={body} />
    </svg>
  );
}

// Markdown léger : **gras**, puces "- ", retours à la ligne (le reste en pre-wrap).
function renderLight(text: string): React.ReactNode {
  return text.split("\n").map((line, li) => {
    const bullet = /^\s*[-•]\s+/.test(line);
    const clean = line.replace(/^\s*[-•]\s+/, "");
    const parts = clean.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    const nodes = parts.map((p, pi) =>
      p.startsWith("**") && p.endsWith("**") ? <strong key={pi}>{p.slice(2, -2)}</strong> : <span key={pi}>{p}</span>,
    );
    return (
      <div key={li} style={bullet ? { display: "flex", gap: 6 } : undefined}>
        {bullet && <span style={{ color: ACCENT }}>•</span>}
        <span>{nodes}</span>
      </div>
    );
  });
}

const KEYFRAMES = `
@keyframes volt-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
@keyframes volt-pop { from { opacity: 0; transform: scale(0.92) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
@keyframes volt-blink { 0%,80%,100% { opacity: 1; } 40% { opacity: 0.25; } }
`;
