# Build & déploiement

Comment produire les exécutables distribuables : `.exe` Windows (desktop) et `.apk` Android (mobile).

---

## 1. Desktop — installateur Windows (.exe)

> ⚠️ Le build d'un `.exe` Windows **doit se faire depuis Windows** (pas depuis WSL).
> Guide pas à pas complet : [eleclabel/BUILD-WINDOWS.md](../eleclabel/BUILD-WINDOWS.md).

### Prérequis (une fois, sur le PC qui compile)

| Outil | Source |
|---|---|
| Node.js LTS | https://nodejs.org |
| Rust | https://rustup.rs |
| Visual Studio Build Tools C++ | `winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"` |
| WebView2 | déjà présent sur Win 10/11 (sinon installé par le setup) |

### Construire

```bash
cd eleclabel
# Option simple : double-clic sur build-exe.bat
# Option terminal :
npm install
npm run tauri build
```

Résultat :
```
eleclabel/src-tauri/target/release/bundle/nsis/ElecLabel_1.0.0_x64-setup.exe
```

### Configuration du bundle (`src-tauri/tauri.conf.json`)

- Cible : **NSIS** (un seul `.exe` setup).
- `installMode: currentUser` → installation **sans droits administrateur**.
- WebView2 : `downloadBootstrapper` (téléchargé si absent).
- Langues de l'installeur : français + anglais.

### Installer sur un autre PC

Copier le `.exe`, double-cliquer. Si SmartScreen avertit (app non signée) →
*Informations complémentaires → Exécuter quand même*. L'app s'installe en mode utilisateur.

> Les clés API du `.env` sont **intégrées au binaire** au moment du build. Ne pas distribuer
> le `.exe` à des inconnus (clés incluses). Pour supprimer l'avertissement SmartScreen il
> faudrait un certificat de signature de code (payant) — non nécessaire pour un usage perso.

### Mettre à jour la version

Changer `"version"` dans `src-tauri/tauri.conf.json`, rebuilder. La nouvelle version écrase
proprement l'ancienne à l'installation.

> **Note Tauri** : npm (`@tauri-apps/*`) et Rust (crate `tauri`) doivent être sur la **même
> version mineure**. En cas de mismatch (`Found version mismatched Tauri packages`) :
> `cargo update --manifest-path src-tauri/Cargo.toml`.

---

## 2. Mobile — APK Android

> Workflow : code/build dans WSL, compilation APK dans Android Studio (Windows).
> Guide complet : [eleclabel-mobile/INSTALL-ANDROID.md](../eleclabel-mobile/INSTALL-ANDROID.md).

### Prérequis

- WSL : Node.js
- Windows : Android Studio + Android SDK
- Téléphone : mode développeur + débogage USB (pour l'install directe)

### Préparer (WSL)

```bash
cd eleclabel-mobile
./scripts/build-android.sh
```

Le script : vérifie `.env`, installe npm, scaffolde `android/` au 1ᵉʳ run (`npx cap add android`),
build le frontend (`npm run build`), synchronise (`npx cap sync android`).

> ⚠️ **Toujours relancer ce script avant de builder l'APK.** Sinon Android utilise une vieille
> copie cachée des assets et l'app n'est pas à jour.

### Construire l'APK (Android Studio)

1. Ouvrir le dossier `eleclabel-mobile/android` dans Android Studio.
2. Attendre l'indexation Gradle (1–5 min la 1ʳᵉ fois).
3. **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
4. APK généré : `android/app/build/outputs/apk/debug/app-debug.apk`.

### Installer sur le Samsung

- **Manuel** : copier l'APK dans `Téléchargements` (USB), l'ouvrir, autoriser la source, installer.
- **Direct** (itération rapide) : téléphone branché + débogage USB → bouton **Run ▶** dans Android Studio.

### Icônes & splash

Générés depuis le logo via `resources/generate-app-icons.mjs` + `@capacitor/assets`.
Voir [eleclabel-mobile/resources/logo/README.md](../eleclabel-mobile/resources/logo/README.md).

---

## 3. Récapitulatif des artefacts

| Plateforme | Fichier produit | Où |
|---|---|---|
| Desktop | `ElecLabel_1.0.0_x64-setup.exe` | `eleclabel/src-tauri/target/release/bundle/nsis/` |
| Mobile | `app-debug.apk` | `eleclabel-mobile/android/app/build/outputs/apk/debug/` |

---

## 4. Distribution future (optionnel)

| Cible | Ce qu'il faudrait |
|---|---|
| Play Store | APK/AAB **signé** (keystore), compte développeur Google (25 $ une fois) |
| Sans avertissement Windows | Certificat de signature de code (~200–400 €/an) |
| iOS | Mac + compte Apple Developer (99 $/an), `npx cap add ios` |
| Sécuriser les clés API | Proxy serveur (Cloudflare Worker / Vercel) au lieu de clés dans le binaire |
