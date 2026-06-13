# Architecture

Vue d'ensemble technique d'ElecLabel : organisation du code, partage entre plateformes, flux de données.

---

## 1. Vue d'ensemble

ElecLabel est un **mono-repo** contenant deux applications qui partagent l'essentiel de leur logique :

```
                       ┌──────────────────────────┐
                       │   Code partagé (≈ 85 %)   │
                       │  services · stores ·      │
                       │  types · utils · data ·   │
                       │  composants d'édition     │
                       └───────────┬──────────────┘
                                   │ (copié dans les 2 projets)
                   ┌───────────────┴───────────────┐
                   ▼                               ▼
        ┌────────────────────┐          ┌────────────────────┐
        │   eleclabel/        │          │ eleclabel-mobile/   │
        │   Tauri v2 (Rust)   │          │ Capacitor 6         │
        │   → WebView2        │          │ → WebView Android   │
        │   → .exe Windows    │          │ → .apk Android      │
        └─────────┬──────────┘          └─────────┬──────────┘
                  │                                │
                  └──────────────┬─────────────────┘
                                 ▼
                       ┌────────────────────┐
                       │     Supabase        │
                       │  Postgres · Auth ·  │
                       │  Storage · Realtime │
                       └────────────────────┘
```

---

## 2. Code partagé

Les deux projets ont une structure `src/` identique. Les fichiers suivants sont **strictement identiques** entre desktop et mobile (synchronisés par copie) :

| Dossier | Contenu partagé |
|---|---|
| `types/` | `panel.ts`, `invoice.ts` — modèles de données |
| `services/` | `openai.ts`, `supabase.ts`, `cloudSync.ts`, `syncQueue.ts`, `realtime.ts`, `ocrInvoice.ts`, `imageInvoice.ts`, `pdfInvoice.tsx`, `zipExport.ts` |
| `store/` | `panelStore.ts`, `historyStore.ts`, `invoiceStore.ts`, `authStore.ts`, `libraryStore.ts` |
| `data/` | `templates.ts`, `labelPresets.ts` |
| `utils/` | `labelLayout.ts`, `pdfLayout.ts`, `imagePreprocess.ts`, `smartSuggest.ts`, `circuitIcons.ts`, `emojiCanvas.ts` |
| `components/` | `LabelCell`, `LabelGrid`, `LabelPicker`, `PdfExport`, `PanelPreview`, `ManualPanelSetup`, `AuthGate`, `AccountMenu`, `SyncStatus`, `LogoMark` |

### Fichiers spécifiques par plateforme

| Desktop seulement | Mobile seulement |
|---|---|
| `components/PhotoDropzone.tsx` (drag & drop) | `components/PhotoCapture.tsx` (caméra native) |
| `App.tsx` (BrowserRouter) | `components/MobileHeader.tsx`, `BottomNav.tsx` |
| `pages/*` (layout large) | `services/native.ts`, `pdfMobile.ts` |
| `src-tauri/` (Rust) | `App.tsx` (HashRouter), `pages/*` (mobile) |

### Workflow de modification du code partagé

> **Règle** : on modifie d'abord dans `eleclabel/src/`, puis on copie vers `eleclabel-mobile/src/`.

```bash
# exemple : après modif d'un service partagé
cp eleclabel/src/services/openai.ts eleclabel-mobile/src/services/openai.ts
```

C'est volontairement simple (pas de package partagé npm). Une évolution future possible
serait de passer à des **npm workspaces** avec un package `@eleclabel/shared`, mais ce
n'est pas nécessaire au stade actuel.

---

## 3. Couches applicatives

```
┌─────────────────────────────────────────────────────────┐
│  PAGES (UI)          Home · Editor · Preview · Templates  │
│                      History · Invoices · Login           │
├─────────────────────────────────────────────────────────┤
│  COMPONENTS          LabelGrid · LabelCell · LabelPicker  │
│                      AuthGate · SyncStatus · …            │
├─────────────────────────────────────────────────────────┤
│  STORES (Zustand)    panelStore · historyStore ·          │
│                      invoiceStore · authStore             │
├─────────────────────────────────────────────────────────┤
│  SERVICES            openai · cloudSync · syncQueue ·     │
│                      realtime · ocrInvoice · pdfInvoice   │
├─────────────────────────────────────────────────────────┤
│  PLATEFORME          Tauri (Rust)  |  Capacitor (natif)   │
│                      Supabase (cloud)                     │
└─────────────────────────────────────────────────────────┘
```

**Principe** : les pages et composants ne parlent jamais directement à l'API. Ils passent
par les **stores** (état réactif) qui eux-mêmes appellent les **services** (I/O réseau, IA, PDF).

---

## 4. Stores Zustand

| Store | Rôle | Persistance |
|---|---|---|
| `panelStore` | Tableau en cours d'édition + undo/redo (max 60 états) | mémoire |
| `historyStore` | Historique des tableaux | localStorage + Supabase |
| `invoiceStore` | Factures | IndexedDB + Supabase |
| `authStore` | Session utilisateur (wrapper Supabase Auth) | localStorage (Supabase) |
| `libraryStore` | Fichiers importés (schémas) | localStorage |

Les stores `historyStore` et `invoiceStore` sont **local-first** : lecture instantanée
depuis le cache local, écriture locale immédiate + synchronisation cloud en arrière-plan
(voir [CLOUD-SYNC.md](CLOUD-SYNC.md)).

---

## 5. Modèle de données (types clés)

```typescript
// types/panel.ts
type PoleWidth = 1 | 2 | 3 | 4;

interface Breaker {
  id: string;            // "r{row}-{index}"
  row: number;
  position: number;      // index du slot de gauche (0-based)
  poles: PoleWidth;
  label: string;
  sublabel?: string;
  icon?: string;         // emoji explicite (sinon dérivé du label)
  suggested?: boolean;   // label proposé par l'IA, non confirmé
}

interface PanelRow { index: number; totalSlots: number; breakers: Breaker[]; }
interface Panel    { rows: PanelRow[]; imageBase64?: string; project?: ProjectMeta; }
```

```typescript
// types/invoice.ts
interface Invoice {
  id: string;            // UUID (compatible Supabase)
  createdAt: number;
  imageBase64: string;   // vide tant que la photo HD n'est pas chargée (lazy)
  imageMimeType: string;
  thumbnail?: string;
  invoiceDate?: string;  // ISO yyyy-mm-dd
  supplier?: string;
  reference?: string;
  amountCents?: number;  // montant en centimes (pas de flottant)
  notes?: string;
  ocrRawText?: string;
  reviewed?: boolean;
}
```

---

## 6. Navigation

| Plateforme | Routeur | Raison |
|---|---|---|
| Desktop | `BrowserRouter` | URL propres dans WebView2 |
| Mobile | `HashRouter` | Capacitor charge en `file://`, le hash évite les 404 |

Routes communes : `/` (accueil), `/templates`, `/history`, `/invoices`, `/editor`, `/preview`.
Toutes protégées par `<AuthGate>` (redirige vers `/login` si non connecté).

---

## 7. Décisions d'architecture notables

1. **Tauri plutôt qu'Electron** (desktop) : binaire ~10 Mo au lieu de ~150 Mo, WebView2 système.
2. **Capacitor plutôt que React Native/Flutter** (mobile) : réutilisation de ~85 % du code React existant. Voir le rapport pour le détail du choix.
3. **Local-first** : l'app reste utilisable hors-ligne (chantier sans 4G), la sync est un bonus, pas un prérequis.
4. **IA par orchestration, sans fine-tuning** : qualité obtenue par prompt engineering + pipeline multi-passes, pas d'entraînement. Voir [AI-PIPELINE.md](AI-PIPELINE.md).
5. **OCR local gratuit** (Tesseract.js) plutôt qu'une API payante : zéro coût récurrent sur les factures.
