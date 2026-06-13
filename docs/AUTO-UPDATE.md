# Mise à jour automatique du logiciel desktop

Le logiciel ElecLabel (desktop) se met à jour **tout seul** : quand tu publies une nouvelle
version, les apps déjà installées la détectent au démarrage, la téléchargent et l'installent.

Technique : plugin **Tauri Updater** + **GitHub Releases** + signature cryptographique +
workflow **GitHub Actions** qui build et publie automatiquement.

---

## 1. Comment ça marche

```
   Tu pushes un tag (v1.0.1)
          │
          ▼
   GitHub Actions (.github/workflows/release-desktop.yml)
   ├─ build le .exe sur un runner Windows
   ├─ le SIGNE avec ta clé privée (secret GitHub)
   └─ publie une Release avec latest.json
          │
          ▼
   Apps installées (au démarrage)
   ├─ lisent https://github.com/.../releases/latest/download/latest.json
   ├─ comparent la version → plus récente ?
   ├─ vérifient la signature (clé publique dans tauri.conf.json)
   └─ téléchargent + installent + redémarrent
```

La **signature** garantit que seule une mise à jour signée par TA clé privée est acceptée :
personne ne peut pousser une fausse mise à jour à tes utilisateurs.

---

## 2. Configuration déjà en place (code)

| Élément | Fichier |
|---|---|
| Plugins updater + process | `eleclabel/package.json`, `src-tauri/Cargo.toml` |
| Enregistrement Rust | `src-tauri/src/lib.rs` (sous `#[cfg(desktop)]`) |
| Permissions | `src-tauri/capabilities/default.json` |
| Endpoint + clé publique + artefacts | `src-tauri/tauri.conf.json` (`plugins.updater`) |
| Bandeau "mise à jour dispo" | `src/components/UpdateBanner.tsx` |
| Workflow de publication | `.github/workflows/release-desktop.yml` |

La **clé publique** de signature est déjà dans `tauri.conf.json`. La **clé privée** est dans
`eleclabel/eleclabel-updater.key` (gitignorée — ne jamais la committer).

---

## 3. Étapes à faire UNE FOIS (toi)

### 3.1 Rendre les releases accessibles

L'updater télécharge depuis GitHub Releases sans authentification → le repo (ou au moins les
releases) doit être **public**. C'est sans risque maintenant que les clés API sont sorties du
binaire (proxy Supabase — voir [AI-PROXY.md](AI-PROXY.md)).

> Settings → General → Danger Zone → Change visibility → Public.

### 3.2 Ajouter les secrets GitHub

Settings → **Secrets and variables → Actions → New repository secret** :

| Secret | Valeur |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | le **contenu** du fichier `eleclabel/eleclabel-updater.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | (laisse **vide**) |
| `VITE_SUPABASE_URL` | `https://czixrnsfanajtkmilian.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | ta clé anon Supabase |

Pour copier le contenu de la clé privée (sur ton PC, dans le dossier `eleclabel`) :
```bash
# Windows PowerShell
Get-Content eleclabel-updater.key
# ou WSL / bash
cat eleclabel/eleclabel-updater.key
```
Copie tout (3 lignes) et colle-le dans le secret `TAURI_SIGNING_PRIVATE_KEY`.

---

## 4. Publier une nouvelle version

À chaque fois que tu veux diffuser une mise à jour :

```bash
# 1. Incrémente la version
#    eleclabel/src-tauri/tauri.conf.json  →  "version": "1.0.1"

# 2. Commit + tag + push
git commit -am "v1.0.1"
git tag v1.0.1
git push && git push --tags
```

GitHub Actions se déclenche (onglet **Actions**), build le `.exe` (~10-15 min), le signe et
crée la **Release v1.0.1**. Les apps installées proposeront la mise à jour au prochain lancement.

> Le numéro de tag (`v1.0.1`) et la version dans `tauri.conf.json` (`1.0.1`) doivent correspondre.

---

## 5. Première diffusion

La toute première version installée par tes utilisateurs doit être **téléchargée manuellement**
(l'auto-update ne peut mettre à jour qu'une app déjà installée). Donc :

1. Crée la release `v1.0.0` (push le tag `v1.0.0`).
2. Récupère `ElecLabel_1.0.0_x64-setup.exe` dans la Release.
3. Distribue-le à tes utilisateurs (1ʳᵉ installation manuelle).
4. À partir de là, toutes les versions suivantes (`v1.0.1`, `v1.0.2`…) s'installent automatiquement.

---

## 6. Dépannage

| Symptôme | Cause / solution |
|---|---|
| Le workflow échoue à la signature | Secret `TAURI_SIGNING_PRIVATE_KEY` manquant ou mal copié |
| L'app ne voit pas la mise à jour | Repo/releases pas publics, ou `latest.json` absent de la Release |
| "signature verification failed" | La clé publique de `tauri.conf.json` ne correspond pas à la clé privée des secrets |
| Build échoue sur `npm ci` | Vérifier que `package-lock.json` est commité |

---

## 7. Et le mobile ?

L'APK Android sideloadé **ne s'auto-mets pas à jour** (limite d'Android hors Play Store).
Options : republier l'APK et le réinstaller à la main, ou publier sur le Play Store
(mises à jour auto natives, 25 $ une fois). Voir [BUILD-DEPLOY.md](BUILD-DEPLOY.md) §4.
