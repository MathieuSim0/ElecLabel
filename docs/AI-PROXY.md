# Proxy des clés API (Supabase Edge Function)

Sécurise les clés OpenAI / Groq : au lieu d'être intégrées dans l'app distribuée (où
n'importe qui pourrait les extraire en décompilant le `.exe` / l'`.apk`), elles vivent
côté serveur dans une **Supabase Edge Function**. L'app appelle le proxy avec le jeton
de l'utilisateur connecté ; le proxy ajoute la clé secrète et relaie vers OpenAI/Groq.

> Phase 1 du chantier « auto-update propre ». Une fois le proxy en place, on pourra
> distribuer le `.exe` publiquement (auto-update) sans exposer aucun secret.

Fichier : `supabase/functions/ai-proxy/index.ts`.

---

## 1. Comment ça marche

```
   App (desktop/mobile)                 Supabase Edge "ai-proxy"            OpenAI / Groq
   ─────────────────────                ───────────────────────            ─────────────
   POST /functions/v1/ai-proxy
   Authorization: Bearer <JWT user>  ─▶  vérifie le JWT (utilisateur OK ?)
   { provider, payload }                 ajoute la clé secrète         ─▶  POST /chat/completions
                                         relaie la réponse             ◀─  réponse
                                    ◀─   passthrough (statut + JSON)
```

- **Aucune clé API dans l'app** : seul l'URL Supabase (déjà public) et le jeton de session sont utilisés.
- **Protection anti-abus** : seul un utilisateur ElecLabel connecté (JWT valide) peut appeler le proxy. Personne ne peut cramer tes crédits OpenAI sans compte.

---

## 2. Prérequis : la CLI Supabase

```bash
# installation (une fois)
npm install -g supabase
# ou : scoop install supabase  /  brew install supabase/tap/supabase

supabase --version
supabase login        # ouvre le navigateur pour t'authentifier
```

---

## 3. Lier ton projet

Depuis la racine du repo :

```bash
cd "ASE SPARKIUM"
supabase link --project-ref czixrnsfanajtkmilian
```

(le `project-ref` est l'identifiant dans ton URL Supabase : `https://<ref>.supabase.co`)

---

## 4. Déployer la fonction + les secrets

```bash
# Déploie la fonction (--no-verify-jwt : on vérifie le JWT à la main pour le CORS)
supabase functions deploy ai-proxy --no-verify-jwt

# Mets tes clés API en secrets serveur (jamais dans l'app)
supabase secrets set OPENAI_API_KEY=sk-ta-cle-openai
supabase secrets set GROQ_API_KEY=gsk_ta-cle-groq   # optionnel
```

Vérifie dans le dashboard : **Edge Functions** → `ai-proxy` doit apparaître ; **Edge
Functions → Secrets** doit lister `OPENAI_API_KEY`.

---

## 5. Activer le mode proxy dans l'app

Dans `eleclabel/.env` **et** `eleclabel-mobile/.env` :

```env
# Active le proxy : les appels IA passent par la Edge Function
VITE_USE_AI_PROXY=true

# Ces deux-là ne sont plus nécessaires dans l'app (les clés sont sur le serveur)
# VITE_OPENAI_API_KEY=
# VITE_GROQ_API_KEY=

# Toujours nécessaires (Supabase reste utilisé pour auth + sync + proxy)
VITE_SUPABASE_URL=https://czixrnsfanajtkmilian.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

> Tant que `VITE_USE_AI_PROXY` n'est pas `true`, l'app garde l'ancien comportement
> (appel direct avec les clés du `.env`). Tu peux donc déployer le proxy puis basculer
> tranquillement.

Rebuild l'app (`npm run build` / `tauri build` / APK). Désormais le binaire distribué
**ne contient plus aucune clé OpenAI/Groq**.

---

## 6. Tester

1. `VITE_USE_AI_PROXY=true` dans `.env`.
2. Lance l'app, connecte-toi.
3. Analyse une photo de tableau → si ça marche, le proxy fonctionne.
4. En cas d'échec, regarde les logs : `supabase functions logs ai-proxy`.

---

## 7. Coûts

- **Supabase Edge Functions** : gratuit jusqu'à 500 000 invocations/mois (large pour un usage individuel).
- **OpenAI** : facturé comme avant (le proxy ne change pas le coût des appels, il déplace juste la clé).

---

## 8. Dépannage

| Symptôme | Cause / solution |
|---|---|
| `401 Non autorisé` | Pas connecté, ou JWT expiré → se reconnecter |
| `Clé openai non configurée côté serveur` | `supabase secrets set OPENAI_API_KEY=…` oublié |
| Erreur CORS | Déployer avec `--no-verify-jwt` (la fonction gère le préflight elle-même) |
| `function not found` | `supabase functions deploy ai-proxy` pas exécuté, ou mauvais projet lié |
