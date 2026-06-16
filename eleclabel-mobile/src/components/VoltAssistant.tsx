// Volt — assistant conversationnel (mobile).
// Robot flottant au-dessus de la barre de navigation ; au tap, une bottom sheet
// monte depuis le bas (≈ 80 % de l'écran). Lit le tableau courant (panelStore).
import { useEffect, useRef, useState } from "react";
import { usePanelStore } from "../store/panelStore";
import { askVolt, type ChatMessage } from "../services/assistant";

const ACCENT = "#0EA5C4";
const ACCENT_DARK = "#0B7E96";

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

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Verrouille le scroll de l'arrière-plan quand la feuille est ouverte
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

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

  return (
    <>
      <style>{KEYFRAMES}</style>

      {/* ── Bottom sheet ── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(15,23,42,0.45)", animation: "volt-fade 160ms ease-out" }}
        >
          <div
            role="dialog"
            aria-label="Assistant Volt"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              height: "82vh",
              display: "flex",
              flexDirection: "column",
              background: "#FFFFFF",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              overflow: "hidden",
              animation: "volt-sheet 220ms cubic-bezier(0.16,1,0.3,1)",
              paddingBottom: "var(--safe-bottom)",
            }}
          >
            {/* poignée + en-tête */}
            <div style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`, color: "#FFFFFF", paddingTop: "calc(var(--safe-top) + 6px)" }}>
              <div style={{ width: 38, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.5)", margin: "0 auto 8px" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px 12px" }}>
                <RobotIcon size={30} thinking={thinking} mono />
                <div style={{ flex: 1, lineHeight: 1.1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Volt</div>
                  <div style={{ fontSize: 11.5, opacity: 0.85 }}>Assistant électricien</div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fermer"
                  style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#FFF", width: 34, height: 34, borderRadius: 10, cursor: "pointer", fontSize: 17 }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* messages */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10, background: "#F8FAFC" }}>
              {messages.length === 0 && !thinking && (
                <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
                  Salut 👋 Je suis Volt. Pose-moi une question métier, ou demande-moi un coup de main sur le tableau ouvert.
                </div>
              )}

              {messages.map((m, i) => (
                <Bubble key={i} role={m.role} content={m.content} />
              ))}

              {thinking && <Typing />}

              {error && (
                <div style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA", borderRadius: 10, padding: "9px 11px", fontSize: 13 }}>
                  {error}
                </div>
              )}

              {messages.length === 0 && !thinking && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 4 }}>
                  {CHIPS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onChip(c)}
                      style={{ background: "#FFFFFF", border: `1px solid ${ACCENT}`, color: ACCENT_DARK, borderRadius: 999, padding: "8px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* saisie */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, padding: 12, borderTop: "1px solid #E5E7EB", background: "#FFFFFF" }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onInputKey}
                rows={1}
                placeholder="Écris à Volt…"
                style={{ flex: 1, resize: "none", maxHeight: 110, border: "1px solid #E5E7EB", borderRadius: 12, padding: "11px 13px", fontSize: 15, fontFamily: "inherit", outline: "none", lineHeight: 1.4 }}
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
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  cursor: thinking || !input.trim() ? "default" : "pointer",
                  flexShrink: 0,
                  fontSize: 18,
                }}
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Robot flottant (au-dessus de la BottomNav) ── */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir l'assistant Volt"
          style={{
            position: "fixed",
            right: 16,
            bottom: "calc(72px + var(--safe-bottom))",
            zIndex: 60,
            width: 56,
            height: 56,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`,
            boxShadow: "0 8px 22px rgba(14,165,196,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "volt-float 3.4s ease-in-out infinite",
          }}
        >
          <RobotIcon size={32} thinking={false} mono />
        </button>
      )}
    </>
  );
}

// ─────────────────────────── Sous-composants ───────────────────────────

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div
        style={{
          maxWidth: "86%",
          padding: "10px 13px",
          borderRadius: 15,
          fontSize: 14.5,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          background: isUser ? ACCENT : "#FFFFFF",
          color: isUser ? "#FFFFFF" : "#1E293B",
          border: isUser ? "none" : "1px solid #E5E7EB",
          borderBottomRightRadius: isUser ? 4 : 15,
          borderBottomLeftRadius: isUser ? 15 : 4,
        }}
      >
        {isUser ? content : renderLight(content)}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748B", fontSize: 14, padding: "4px 2px" }}>
      <span style={{ display: "inline-flex", gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT, animation: `volt-blink 1s ${i * 0.18}s infinite` }} />
        ))}
      </span>
      Volt réfléchit…
    </div>
  );
}

function RobotIcon({ size = 32, thinking = false, mono = false }: { size?: number; thinking?: boolean; mono?: boolean }) {
  const body = mono ? "#FFFFFF" : ACCENT;
  const eye = mono ? ACCENT : "#FFFFFF";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" style={{ display: "block" }}>
      <path d="M24 3 L20 13 L24 13 L21 21 L30 11 L25 11 Z" fill={mono ? "#FFE27A" : "#F5C518"} />
      <rect x="9" y="14" width="30" height="24" rx="9" fill={body} />
      <rect x="13" y="19" width="22" height="13" rx="6.5" fill={mono ? "rgba(14,165,196,0.85)" : "#0B3B47"} />
      <circle cx="19.5" cy="25.5" r="2.6" fill={eye} style={{ animation: thinking ? "volt-blink 0.7s infinite" : "none" }} />
      <circle cx="28.5" cy="25.5" r="2.6" fill={eye} style={{ animation: thinking ? "volt-blink 0.7s 0.15s infinite" : "none" }} />
      <rect x="6" y="22" width="3" height="8" rx="1.5" fill={body} />
      <rect x="39" y="22" width="3" height="8" rx="1.5" fill={body} />
    </svg>
  );
}

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
@keyframes volt-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes volt-sheet { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes volt-blink { 0%,80%,100% { opacity: 1; } 40% { opacity: 0.25; } }
`;
