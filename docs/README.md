# Documentation ElecLabel

Documentation technique du projet. Pour la présentation générale et le démarrage rapide,
voir le [README racine](../README.md).

## Sommaire

| Document | Pour... |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Comprendre l'organisation du code, le partage desktop/mobile, les stores |
| [AI-PIPELINE.md](AI-PIPELINE.md) | Comprendre l'analyse IA des tableaux (prompts, consensus, fiabilisation) |
| [INVOICES-OCR.md](INVOICES-OCR.md) | Le système de factures : OCR Tesseract, extraction, PDF, ZIP |
| [CLOUD-SYNC.md](CLOUD-SYNC.md) | Auth, sync offline-first, file d'attente, temps réel, keep-alive |
| [AI-PROXY.md](AI-PROXY.md) | Proxy serveur des clés API (Supabase Edge Function) — sécurité |
| [AUTO-UPDATE.md](AUTO-UPDATE.md) | Mise à jour automatique du desktop (Tauri updater + CI GitHub) |
| [DATABASE.md](DATABASE.md) | Schéma Supabase, RLS, Storage, migrations |
| [BUILD-DEPLOY.md](BUILD-DEPLOY.md) | Produire le `.exe` Windows et l'`.apk` Android |

## Guides plateforme

- [../eleclabel/BUILD-WINDOWS.md](../eleclabel/BUILD-WINDOWS.md) — installateur Windows pas à pas
- [../eleclabel-mobile/INSTALL-ANDROID.md](../eleclabel-mobile/INSTALL-ANDROID.md) — APK + installation Samsung
- [../eleclabel-mobile/resources/logo/README.md](../eleclabel-mobile/resources/logo/README.md) — logo & icônes

## Schéma de lecture conseillé

```
1. README racine          → vue d'ensemble + démarrage
2. ARCHITECTURE.md         → comment c'est organisé
3. DATABASE.md             → mettre en place Supabase
4. CLOUD-SYNC.md           → comprendre la synchro
5. AI-PIPELINE.md          → le cœur technique (analyse IA)
6. INVOICES-OCR.md         → la partie factures
7. BUILD-DEPLOY.md         → distribuer l'app
```
