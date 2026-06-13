<div align="center">

# ⚡ ElecLabel

**Analyse de tableau électrique par IA · Édition d'étiquettes · Export PDF · Gestion de factures**

Application double **desktop (Windows)** + **mobile (Android)**, synchronisée dans le cloud.

[![Desktop](https://img.shields.io/badge/Desktop-Tauri%20v2-24C8DB)](https://tauri.app)
[![Mobile](https://img.shields.io/badge/Mobile-Capacitor%206-119EFF)](https://capacitorjs.com)
[![Front](https://img.shields.io/badge/Frontend-React%2018%20+%20TypeScript-3178C6)](https://react.dev)
[![Cloud](https://img.shields.io/badge/Cloud-Supabase-3FCF8E)](https://supabase.com)

</div>

---

## Sommaire

- [Présentation](#présentation)
- [Fonctionnalités](#fonctionnalités)
- [Architecture du mono-repo](#architecture-du-mono-repo)
- [Stack technique](#stack-technique)
- [Démarrage rapide](#démarrage-rapide)
- [Configuration (.env)](#configuration-env)
- [Commandes](#commandes)
- [Documentation détaillée](#documentation-détaillée)
- [Conventions de code](#conventions-de-code)

---

## Présentation

ElecLabel aide l'électricien à étiqueter un tableau électrique en quelques minutes :

1. **Photo** du tableau → l'IA (GPT-4o Vision) reconstitue la structure exacte (rangées, modules, pôles, positions).
2. **Édition** des étiquettes (nom, sous-titre, icône) dans un éditeur visuel ; bibliothèque de ~210 presets + 25 modèles de tableaux prêts.
3. **Export PDF A4** prêt à découper aux dimensions DIN normalisées.
4. **Factures** : photo → OCR gratuit (Tesseract.js) → métadonnées extraites → PDF, classées par mois, export ZIP pour la comptable.

Le tout est **synchronisé en temps réel** entre l'ordinateur et le téléphone via un compte utilisateur (Supabase), avec un **mode hors-ligne** complet pour le travail en chantier.

---

## Fonctionnalités

| Domaine | Détail |
|---|---|
| **Analyse IA** | Pipeline 2 étapes (consensus multi-passes + vérification zoom), fallback Groq Llama 4 |
| **Éditeur d'étiquettes** | 1P/2P/3P/4P, undo/redo, correction sur photo, métadonnées chantier |
| **Modèles** | 25 tableaux pré-remplis (studio → maison T6, commerce, atelier, cabinet…) |
| **Presets** | ~210 étiquettes en 12 catégories, dont « ASE — carte de visite » |
| **Export PDF** | A4 portrait, largeur 1P = 18 mm, hauteur réglable, traits de coupe |
| **Factures** | OCR local gratuit, classement mensuel, export ZIP / PDF unitaire |
| **Compte & sync** | Auth email/mot de passe, sync multi-device temps réel, RLS |
| **Offline-first** | File d'attente persistante rejouée au retour du réseau |

---

## Architecture du mono-repo

```
ElecLabel/
├── README.md                  ← ce fichier
├── .gitignore                 ← protège .env, mdp, builds…
├── .github/workflows/         ← keep-alive Supabase (anti-pause)
├── docs/                      ← documentation technique complète
│   ├── ARCHITECTURE.md
│   ├── AI-PIPELINE.md
│   ├── INVOICES-OCR.md
│   ├── CLOUD-SYNC.md
│   ├── DATABASE.md
│   └── BUILD-DEPLOY.md
├── supabase/
│   └── migrations/            ← schéma SQL (tables, RLS, realtime)
│       ├── 001_initial.sql
│       └── 002_realtime.sql
├── eleclabel/                 ← 🖥️  DESKTOP (Tauri v2 + React)
│   ├── src/                   ← code React/TS
│   ├── src-tauri/             ← enveloppe Rust + config bundle
│   ├── build-exe.bat          ← script de build installateur Windows
│   └── BUILD-WINDOWS.md
└── eleclabel-mobile/          ← 📱  MOBILE (Capacitor 6 + React)
    ├── src/                   ← code React/TS (≈ 85 % partagé avec desktop)
    ├── resources/             ← logo + générateur d'icônes
    ├── scripts/build-android.sh
    └── INSTALL-ANDROID.md
```

> **Pourquoi un mono-repo ?** ~85 % du code (services, stores, types, utils, composants
> d'édition) est commun aux deux plateformes. Un seul repo = versioning cohérent,
> un seul schéma SQL partagé, une seule source de vérité. Voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Stack technique

**Frontend (partagé desktop + mobile)**
- React 18 + TypeScript (strict)
- Vite (bundler)
- Zustand (state management)
- React Router v7
- `@react-pdf/renderer` (génération PDF côté client)

**Runtimes natifs**
- 🖥️ **Tauri v2** (Rust + WebView2) → installateur `.exe` Windows (NSIS)
- 📱 **Capacitor 6** (WebView Android) → `.apk`, plugins natifs caméra/fichiers/partage

**IA & traitement**
- OpenAI **GPT-4o Vision** (analyse tableau, principal)
- **Groq Llama 4** (fallback)
- **Tesseract.js** (OCR factures, 100 % local et gratuit)
- Canvas API (prétraitement image, génération d'icônes)

**Cloud & données**
- **Supabase** : PostgreSQL + Auth + Storage + Realtime
- Row Level Security (isolation par utilisateur)
- **IndexedDB** (`idb-keyval`) : cache local volumineux + file de sync
- `localStorage` : données légères

**Outils**
- `jszip` (archives ZIP de factures)
- `sharp` (génération des icônes d'app, dev)

---

## Démarrage rapide

### Prérequis communs
- **Node.js** ≥ 18 — https://nodejs.org
- Un projet **Supabase** (gratuit) — voir [docs/DATABASE.md](docs/DATABASE.md)
- Une clé **OpenAI** (pour l'analyse photo)

### Desktop (Windows)
```bash
cd eleclabel
npm install
# crée le fichier .env (voir section Configuration)
npm run tauri dev          # lance en mode développement
```
Prérequis supplémentaires pour produire le `.exe` : Rust + Visual Studio Build Tools C++.
Voir [eleclabel/BUILD-WINDOWS.md](eleclabel/BUILD-WINDOWS.md).

### Mobile (Android)
```bash
cd eleclabel-mobile
npm install
# crée le fichier .env (voir section Configuration)
npm run dev                # test dans le navigateur (Chrome DevTools mobile)
```
Pour générer l'APK : Android Studio. Voir [eleclabel-mobile/INSTALL-ANDROID.md](eleclabel-mobile/INSTALL-ANDROID.md).

---

## Configuration (.env)

Chaque projet a son propre fichier `.env` (jamais committé). Crée-le à partir du modèle :

```env
# eleclabel/.env  ET  eleclabel-mobile/.env

# OpenAI — analyse photo GPT-4o Vision (obligatoire pour l'analyse)
VITE_OPENAI_API_KEY=sk-...

# Groq — fallback IA (optionnel)
VITE_GROQ_API_KEY=gsk_...

# Supabase — auth + sync cloud (obligatoire pour les comptes)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

> ⚠️ La clé `anon` Supabase est conçue pour être publique (la sécurité repose sur la RLS).
> En revanche **ne jamais committer** la clé `service_role` ni les clés OpenAI/Groq.

---

## Commandes

### Desktop (`eleclabel/`)
| Commande | Effet |
|---|---|
| `npm run dev` | Serveur Vite (navigateur) |
| `npm run tauri dev` | App desktop native en dev |
| `npm run build` | Build frontend (`tsc` + `vite build`) |
| `npm run tauri build` | Build installateur `.exe` (depuis Windows) |

### Mobile (`eleclabel-mobile/`)
| Commande | Effet |
|---|---|
| `npm run dev` | Serveur Vite (test navigateur) |
| `npm run build` | Build frontend |
| `npm run android:prepare` | Build + sync + instructions APK |
| `npx cap sync android` | Synchronise le web vers le projet Android |

---

## Documentation détaillée

| Document | Contenu |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Vue d'ensemble, partage de code, flux de données |
| [docs/AI-PIPELINE.md](docs/AI-PIPELINE.md) | Pipeline d'analyse IA des tableaux, prompts, fiabilisation |
| [docs/INVOICES-OCR.md](docs/INVOICES-OCR.md) | Système de factures : OCR Tesseract, extraction, PDF, ZIP |
| [docs/CLOUD-SYNC.md](docs/CLOUD-SYNC.md) | Auth, sync offline-first, queue, realtime, keep-alive |
| [docs/DATABASE.md](docs/DATABASE.md) | Schéma Supabase, tables, RLS, migrations |
| [docs/BUILD-DEPLOY.md](docs/BUILD-DEPLOY.md) | Build `.exe` Windows et `.apk` Android, distribution |

Docs spécifiques aux plateformes :
- [eleclabel/BUILD-WINDOWS.md](eleclabel/BUILD-WINDOWS.md) — installateur Windows pas à pas
- [eleclabel-mobile/INSTALL-ANDROID.md](eleclabel-mobile/INSTALL-ANDROID.md) — APK + installation Samsung
- [eleclabel-mobile/resources/logo/README.md](eleclabel-mobile/resources/logo/README.md) — logo & icônes

---

## Conventions de code

- Commentaires en **français**, identifiants en **anglais**
- Composants React en **PascalCase**, utilitaires en **camelCase**
- **Pas de `any`** TypeScript (mode strict)
- Appels API uniquement dans `src/services/`
- Code partagé desktop ↔ mobile : modifier d'abord dans `eleclabel/`, puis copier vers `eleclabel-mobile/` (voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md))

---

<div align="center">

**ElecLabel** — développé par **Alain Simon Électricité (ASE)**
Projet de stage · 2026

</div>
