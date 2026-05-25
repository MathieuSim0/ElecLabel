// Supabase Edge Function "ai-proxy"
// ───────────────────────────────────────────────────────────────────────────
// Proxy sécurisé vers OpenAI et Groq. Les clés API restent côté serveur (secrets
// Supabase) et ne sont JAMAIS dans l'application distribuée.
//
// Sécurité : seul un utilisateur ElecLabel connecté (JWT Supabase valide) peut
// appeler ce proxy → impossible d'abuser de tes crédits OpenAI sans compte.
//
// Déploiement :
//   supabase functions deploy ai-proxy --no-verify-jwt
//   supabase secrets set OPENAI_API_KEY=sk-...   GROQ_API_KEY=gsk_...
// (--no-verify-jwt : on vérifie le JWT manuellement pour gérer le préflight CORS)
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // Préflight CORS
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  // ── Vérification de l'utilisateur (JWT Supabase) ──
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return json({ error: "Edge non configurée" }, 500);

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: "Non autorisé — connecte-toi." }, 401);
  }

  // ── Routage vers le bon fournisseur ──
  let provider: string;
  let payload: unknown;
  try {
    const body = await req.json();
    provider = body.provider;
    payload = body.payload;
  } catch {
    return json({ error: "Corps JSON invalide" }, 400);
  }

  let url: string;
  let key: string | undefined;
  if (provider === "openai") {
    url = OPENAI_URL;
    key = Deno.env.get("OPENAI_API_KEY");
  } else if (provider === "groq") {
    url = GROQ_URL;
    key = Deno.env.get("GROQ_API_KEY");
  } else {
    return json({ error: "Fournisseur invalide" }, 400);
  }
  if (!key) return json({ error: `Clé ${provider} non configurée côté serveur` }, 500);

  // ── Transfert vers OpenAI / Groq avec la clé secrète, passthrough du statut ──
  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return json({ error: `Échec amont : ${String(e)}` }, 502);
  }
});
