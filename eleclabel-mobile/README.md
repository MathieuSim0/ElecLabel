# ElecLabel Mobile

Version mobile (Android) d'ElecLabel — application Capacitor + React + TypeScript.

Mêmes fonctionnalités que le desktop (analyse photo IA → édition étiquettes → export PDF A4) mais optimisées pour smartphone : caméra native, partage natif du PDF, layout single-column, navigation bottom-bar.

---

## Stack

| Couche | Technologie |
|---|---|
| Runtime mobile | Capacitor v6 (WebView Android) |
| Frontend | React 18 + TypeScript |
| State | Zustand v5 |
| PDF | `@react-pdf/renderer` |
| Camera | `@capacitor/camera` |
| File system / Share | `@capacitor/filesystem` + `@capacitor/share` |
| Router | React Router v7 (HashRouter — obligatoire en `file://`) |
| Build web | Vite 5 |

iOS sera ajouté plus tard (besoin d'un Mac ou d'EAS Build cloud).

---

## Workflow recommandé Windows + WSL

Le code (npm, vite, tsc) tourne **dans WSL** — c'est rapide et pratique.
Le build APK final tourne **sur Windows** (Android Studio + Android SDK).
`npx cap sync android` fait le pont entre les deux.

Le dossier `android/` (généré par Capacitor) doit être ouvert depuis Windows : tu peux y accéder via `\\wsl$\` ou — plus pratique — placer le projet directement sur un disque Windows monté (ex: `/mnt/d/...` comme actuellement).

---

## Prérequis (à installer une fois)

### Côté WSL
```bash
node --version    # ≥ 18
npm --version     # ≥ 9
```
Si manquant : `sudo apt install nodejs npm` ou via [nvm](https://github.com/nvm-sh/nvm).

### Côté Windows
1. **Android Studio** — [télécharger](https://developer.android.com/studio)
   - Lance-le une fois, accepte les licences, laisse-le installer le SDK par défaut.
2. **Java JDK 17** — fourni par Android Studio (utiliser le JBR embarqué) ou installer manuellement.
3. **Active le mode développeur sur ton téléphone Android** :
   - Réglages → À propos du téléphone → tape 7× sur "Numéro de build"
   - Puis Réglages → Système → Options pour développeurs → activer "Débogage USB"

---

## Installation initiale

Dans WSL :

```bash
cd "/mnt/d/TEK/Perso/Perso/ASE SPARKIUM/eleclabel-mobile"

# 1) installe les dépendances
npm install

# 2) crée ton fichier .env avec tes clés API
cp .env.example .env
# édite .env et remplace les valeurs

# 3) build du frontend
npm run build

# 4) initialise le projet Android (génère le dossier android/)
npx cap add android

# 5) synchronise web → android
npx cap sync android
```

Le dossier `android/` est créé. Il contient un projet Gradle complet, avec l'app web embarquée dans `android/app/src/main/assets/public/`.

---

## Cycle de développement quotidien

### A. Tester dans le navigateur (rapide)
```bash
npm run dev
```
Ouvre `http://localhost:5173`. La caméra retombe sur le sélecteur de fichier classique, le partage PDF déclenche un téléchargement. Pratique pour itérer sur l'UI sans Android.

### B. Tester sur ton téléphone (vrai mobile)
Plug ton téléphone en USB (mode débogage activé), puis :

```bash
# 1) rebuild + sync
npm run build
npx cap sync android

# 2) ouvre le projet dans Android Studio (sur Windows)
npx cap open android
```

Dans Android Studio :
- Sélectionne ton appareil dans la barre du haut
- Clique **Run ▶** (Shift+F10)
- L'APK est compilé, installé sur le téléphone, et lancé automatiquement

> **Tip** : `npm run android` enchaîne build + sync + open en une commande.

---

## Commandes utiles

```bash
npm run dev               # serveur Vite dans le navigateur (test UI)
npm run build             # build production du frontend → dist/
npm run preview           # preview du build production
npm run type-check        # tsc --noEmit (vérification types)
npm run cap:sync          # build + cap sync (toutes plateformes)
npm run cap:open:android  # ouvre Android Studio
npm run android           # build + sync + open (raccourci complet)
```

---

## Génération d'un APK signé pour distribution

(Pour installer sur d'autres téléphones sans Android Studio.)

### 1. Créer une keystore (une fois pour toutes)
```bash
keytool -genkey -v -keystore eleclabel.keystore -alias eleclabel \
  -keyalg RSA -keysize 2048 -validity 10000
```

### 2. Build signé
Dans Android Studio : **Build → Generate Signed Bundle / APK → APK**
Sélectionne ta keystore, choisis "release", clique Finish.

L'APK final est dans `android/app/release/app-release.apk`.

Pour l'installer sur un téléphone :
- L'envoyer par mail / Drive / clé USB
- Sur le téléphone : ouvrir le fichier, autoriser l'installation depuis cette source
- Installer

---

## Permissions Android

Capacitor injecte automatiquement les permissions nécessaires dans `AndroidManifest.xml` :
- `CAMERA` (prise de photo)
- `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` (Android < 11)
- `INTERNET` (analyse IA)

Aucune action manuelle requise — vérifie juste que ces permissions apparaissent quand l'app demande l'autorisation au premier lancement.

---

## Structure du projet

```
eleclabel-mobile/
├── android/              # projet Android natif (généré, ne pas commit)
├── public/               # assets statiques
├── src/
│   ├── App.tsx           # router (HashRouter)
│   ├── main.tsx          # entrée + init Capacitor
│   ├── index.css         # reset + safe-area + variables
│   ├── components/
│   │   ├── BottomNav.tsx        # navigation bottom-bar
│   │   ├── MobileHeader.tsx     # header sticky avec safe-area
│   │   ├── PhotoCapture.tsx     # caméra Capacitor + fallback web
│   │   ├── LabelGrid.tsx        # grille rangées (réutilisé desktop)
│   │   ├── LabelCell.tsx        # cellule disjoncteur (réutilisé)
│   │   ├── LabelPicker.tsx      # bibliothèque de presets (réutilisé)
│   │   ├── ManualPanelSetup.tsx # création manuelle (réutilisé)
│   │   ├── PdfExport.tsx        # rendu PDF react-pdf (réutilisé)
│   │   └── PanelPreview.tsx     # mini aperçu (réutilisé)
│   ├── pages/
│   │   ├── Home.tsx        # accueil mobile
│   │   ├── Templates.tsx   # modèles prêts
│   │   ├── History.tsx     # historique
│   │   ├── Editor.tsx      # édition + scroll horizontal grille
│   │   └── Preview.tsx     # génération + partage natif
│   ├── services/
│   │   ├── native.ts       # init StatusBar + Keyboard
│   │   ├── openai.ts       # pipeline GPT-4o (réutilisé desktop)
│   │   └── pdfMobile.ts    # save → Documents/ + Share natif
│   ├── store/              # zustand (réutilisé desktop)
│   ├── data/               # templates + labelPresets (réutilisé)
│   ├── utils/              # imagePreprocess, smartSuggest, etc. (réutilisé)
│   └── types/              # types Panel (réutilisé)
├── capacitor.config.ts     # appId fr.alainsimon.eleclabel
├── vite.config.ts
├── tsconfig.json
└── package.json
```

**~85% du code est partagé avec le desktop** (services, stores, utils, data, composants d'édition). Seules les pages et l'I/O native diffèrent.

---

## Sécurité des clés API

Tes clés `VITE_OPENAI_API_KEY` et `VITE_GROQ_API_KEY` sont **bundlées dans l'APK** au build (comme dans le desktop Tauri). Quelqu'un qui décompile ton APK peut les extraire.

- ✅ Acceptable : usage perso, distribution restreinte (toi + collègues + clients de confiance)
- ❌ Risqué : Play Store public, partage massif

Pour distribution publique : créer un petit backend proxy (Cloudflare Worker, Vercel Function) qui reçoit l'image, appelle OpenAI avec ta clé serveur, retourne le résultat. Dis-moi si tu veux que je code ça quand le moment viendra.

---

## Différences notables vs desktop

| Fonctionnalité | Desktop | Mobile |
|---|---|---|
| Capture photo | Drag & drop fichier | Caméra native + galerie |
| Aperçu PDF | PDFViewer iframe interactif | Récap textuel + génération à la demande |
| Export PDF | `<a download>` direct | Save Documents/ + Share Sheet natif |
| Bibliothèque fichiers | Import .smg/.pdf/.dwg | Pas en MVP (à ajouter v2 si besoin) |
| Navigation | Onglets top | Bottom nav bar |
| Layout | Multi-colonne large | Single-column + scroll horizontal éditeur |

---

## Roadmap potentielle

- [ ] iOS (avec Mac ou EAS Build)
- [ ] Mode offline complet (queue d'analyses en attente)
- [ ] Backend proxy clé API
- [ ] Plugin de partage rapide depuis appareil photo système
- [ ] Notifications push (rappel facture, suivi chantier)
- [ ] Bibliothèque de fichiers via Capacitor Filesystem (en local seul)

---

## Dépannage

**"Could not find adb" / téléphone non détecté** : installe les Google USB drivers, ou active le mode "Transfert de fichiers" sur le téléphone.

**Build Gradle qui rame** : la première compilation prend 5-10 min (téléchargement dépendances). Les suivantes < 1 min.

**Caméra ne s'ouvre pas** : autorise la permission Caméra dans Réglages → Apps → ElecLabel.

**Le PDF ne se partage pas** : il est quand même sauvegardé dans `Documents/eleclabel-etiquettes-XXmm-…pdf`. Ouvre l'explorateur de fichiers Android pour le retrouver.
