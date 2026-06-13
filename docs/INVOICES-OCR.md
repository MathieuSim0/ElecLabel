# Système de factures & OCR

Gestion des factures fournisseurs : photo → OCR gratuit → métadonnées → PDF → export mensuel.

Code source : `src/services/ocrInvoice.ts`, `imageInvoice.ts`, `pdfInvoice.tsx`,
`zipExport.ts`, `store/invoiceStore.ts`, `pages/Invoices.tsx`.

---

## 1. Objectif

Permettre à l'électricien de **numériser ses factures fournisseurs** et de les transmettre
proprement à sa comptable : un PDF par facture, classés par mois, exportables en une archive ZIP.

Contrainte forte : **rester 100 % gratuit** → pas d'API OCR payante.

---

## 2. Flux complet

```
   Photo facture (caméra mobile / drag-drop desktop)
          │
          ▼
   ┌──────────────────────┐
   │ 1. Traitement image   │  processInvoiceImage() — rotation EXIF + contraste
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │ 2. OCR (Tesseract.js) │  runOcr() — texte brut, 100 % local et gratuit
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │ 3. Extraction regex   │  extractInvoiceMetadata() — date, fournisseur, montant, n°
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │ 4. Formulaire de      │  l'utilisateur vérifie / corrige AVANT d'enregistrer
   │    vérification        │
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │ 5. Enregistrement      │  invoiceStore → IndexedDB + Supabase (photo dans Storage)
   └──────────┬───────────┘
              ▼
   Export : PDF unitaire  OU  ZIP du mois entier (1 PDF par facture)
```

---

## 3. Traitement image (`imageInvoice.ts`)

- **Auto-rotation EXIF** : redresse les photos prises de travers (le navigateur applique l'orientation).
- **Boost contraste/luminosité** via Canvas (`filter: contrast(1.15) brightness(1.08) saturate(0.95)`).
- Redimensionnement à 3000 px max, sortie JPEG qualité 90 %.
- Génération d'une **miniature 300 px** pour les listes (qualité 65 %).

---

## 4. OCR gratuit (`ocrInvoice.ts`)

Utilise **Tesseract.js** — moteur OCR open-source qui tourne **entièrement dans le navigateur**
(et la WebView mobile). Aucun appel API, aucun coût.

- Worker partagé entre appels (évite de réinitialiser le moteur).
- Langues chargées : **français + anglais** (les factures FR contiennent souvent des termes EN).
- Premier scan : ~10–20 s (téléchargement des `traineddata`, ~7 Mo, mis en cache ensuite).
- Scans suivants : ~3–5 s, et **fonctionnent hors-ligne** une fois le cache constitué.

---

## 5. Extraction structurée (heuristiques regex)

Le texte brut OCR est analysé pour en extraire les champs. Best-effort, corrigeable par l'utilisateur.

| Champ | Méthode |
|---|---|
| **Date** | Regex numérique (`05/05/2026`, `05-05-2026`) + textuelle (`5 mai 2026`) → ISO |
| **Montant TTC** | Regex montants en € **pondérée par contexte** : `TOTAL TTC` / `Net à payer` → score élevé ; bonus si en bas de page |
| **N° facture** | Patterns `Facture n°`, `Réf.`, `N°` |
| **Fournisseur** | 1ʳᵉ ligne significative en haut + liste de fournisseurs connus (Schneider, Legrand, Hager, Rexel, Sonepar, Leroy Merlin…) |

Le montant est stocké en **centimes** (`amountCents`) pour éviter les erreurs de flottant.

---

## 6. Vérification avant enregistrement

> Choix d'UX important : **rien n'est sauvegardé automatiquement.**

Après l'OCR, un **formulaire de vérification** s'ouvre avec les champs pré-remplis et un aperçu de la photo. L'utilisateur :
- corrige ce que l'OCR a mal lu,
- puis clique **« Enregistrer la facture »** (sauvegarde locale + cloud) ou **« Annuler »** (jette tout).

Sur desktop, l'import de **plusieurs fichiers** d'un coup bascule en mode batch (pas de formulaire par facture).

---

## 7. Stockage (`invoiceStore.ts`)

Backend **IndexedDB** (via `idb-keyval`) car les photos sont volumineuses (localStorage est limité à ~5 Mo).

- **Local-first** : lecture instantanée du cache, écriture locale immédiate.
- **Sync cloud** en arrière-plan via la file d'attente (voir [CLOUD-SYNC.md](CLOUD-SYNC.md)).
- **Lazy loading des photos** : au login, seuls les thumbnails + métadonnées sont chargés.
  La photo HD est téléchargée à la demande (ouverture éditeur / export PDF) via `loadPhotoIfMissing()`.
  Évite de télécharger 200 Mo si on a 100 factures.

Côté cloud : la **photo** va dans le bucket Storage `invoices/{user_id}/{invoice_id}.jpg`,
les **métadonnées** dans la table `invoices`.

---

## 8. Génération PDF (`pdfInvoice.tsx`)

Un PDF A4 propre par facture, via `@react-pdf/renderer` :
- En-tête : fournisseur (gras), date, n°, montant.
- Image de la facture centrée, plein cadre.
- Pied de page « Généré par ElecLabel le … ».

Nom de fichier normalisé : `2026-05-15_Schneider_142,50EUR.pdf` (tri alphabétique = tri chronologique).

---

## 9. Export mensuel (`zipExport.ts`)

Le bouton **« Exporter le mois »** génère une archive **ZIP** (via `jszip`) contenant **1 PDF par facture** du mois.

- Nom : `Factures_2026-05_Mai.zip`.
- Barre de progression (utile pour 50+ factures).
- Desktop : téléchargement direct.
- Mobile : sauvegarde dans `Documents/` + ouverture de la **feuille de partage native** (Gmail, Drive, imprimante…).

Les factures sont **groupées par mois** dans l'UI (clé `YYYY-MM` basée sur la date de facture
si disponible, sinon la date de capture), avec total cumulé par mois.

---

## 10. Dépendances

```json
"tesseract.js": "^5.1.1",   // OCR local gratuit
"jszip": "^3.10.1",         // archives ZIP
"idb-keyval": "^6.2.1"      // stockage IndexedDB
```
