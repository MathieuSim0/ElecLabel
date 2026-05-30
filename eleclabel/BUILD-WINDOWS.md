# Construire ElecLabel en installateur Windows (.exe)

ElecLabel est une app Tauri. Pour produire un `.exe` installable sur n'importe quel
PC Windows, la compilation **doit se faire depuis Windows** (pas depuis WSL — WSL ne
peut pas produire un exécutable Windows facilement).

Résultat final : un fichier `ElecLabel_1.0.0_x64-setup.exe` que tu copies sur
n'importe quel PC pour installer le logiciel.

---

## Étape 1 — Prérequis (à installer une fois sur le PC qui compile)

### 1. Node.js
- Télécharge la version **LTS** sur https://nodejs.org
- Installe (laisse les options par défaut)

### 2. Rust
- Va sur https://rustup.rs
- Télécharge et lance `rustup-init.exe`
- Choisis l'installation par défaut (touche Entrée)
- Ferme et rouvre ton terminal après l'installation

### 3. Visual Studio Build Tools C++ ⚠️ LE PLUS IMPORTANT
C'est ce qui manquait avant (erreur `link.exe not found`). Sans ça, le build échoue.

**Option A — winget (rapide, en ligne de commande)**
Ouvre PowerShell et lance :
```powershell
winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

**Option B — manuel**
1. Va sur https://visualstudio.microsoft.com/fr/visual-cpp-build-tools/
2. Télécharge **"Build Tools pour Visual Studio 2022"**
3. Lance l'installeur
4. Coche la case **« Développement Desktop en C++ »**
5. Installe (~6-7 Go, compte 15-30 min)

### 4. WebView2
Déjà présent sur Windows 10 récent et Windows 11. Rien à faire — et de toute façon
l'installateur d'ElecLabel l'installera automatiquement si absent.

> **Vérification** : ouvre un terminal et tape `node --version` et `cargo --version`.
> Si les deux répondent un numéro de version, tu es prêt.

---

## Étape 2 — Construire le .exe

### Méthode simple — double-clic
1. Ouvre le dossier `eleclabel` dans l'explorateur Windows
   (`D:\TEK\Perso\Perso\ASE SPARKIUM\eleclabel`)
2. Vérifie que le fichier `.env` est présent (il contient tes clés API)
3. Double-clique sur **`build-exe.bat`**
4. Patiente — la première compilation prend 5 à 15 min (Rust compile tout)
5. À la fin, l'explorateur s'ouvre sur le dossier contenant l'installateur

### Méthode terminal
Ouvre un terminal (CMD ou PowerShell) dans le dossier `eleclabel` :
```bat
npm install
npm run tauri build
```

---

## Étape 3 — Récupérer l'installateur

Une fois la compilation finie, l'installateur est ici :
```
eleclabel\src-tauri\target\release\bundle\nsis\ElecLabel_1.0.0_x64-setup.exe
```

C'est **ce fichier unique** que tu copies sur un autre PC.

---

## Étape 4 — Installer sur un autre ordinateur

1. Copie `ElecLabel_1.0.0_x64-setup.exe` sur l'autre PC (clé USB, mail, Drive…)
2. Double-clique dessus
3. Windows SmartScreen peut afficher un avertissement (app non signée) :
   → clique **« Informations complémentaires »** puis **« Exécuter quand même »**
4. L'installateur se lance — suis les étapes (français disponible)
5. ElecLabel s'installe **sans droits administrateur** (mode utilisateur courant)
6. Si le PC n'a pas WebView2, l'installateur le télécharge automatiquement
   (connexion internet nécessaire à ce moment-là, une seule fois)
7. ElecLabel apparaît dans le menu Démarrer

---

## À savoir

### Les clés API sont incluses dans le .exe
Au moment du build, tes clés (OpenAI, Supabase, du fichier `.env`) sont **intégrées
dans l'exécutable**. L'app fonctionne donc directement sur l'autre PC, sans config.
Tu te connectes simplement avec ton compte ElecLabel et tu retrouves tes données.

⚠️ Ne distribue pas ce `.exe` à des inconnus : tes clés API sont dedans. Pour un usage
perso / collègues de confiance, c'est OK.

### Mettre à jour la version
Quand tu fais des modifs et veux un nouveau `.exe` :
1. Change le numéro `"version"` dans `src-tauri/tauri.conf.json` (ex: `1.0.1`)
2. Relance `build-exe.bat`
3. Le nouvel installateur écrase proprement l'ancienne version à l'installation

---

## Dépannage

**`error: linker 'link.exe' not found`**
→ Visual Studio Build Tools C++ pas installé ou workload C++ pas coché. Reprends l'étape 1.3.

**`cargo: command not found` / `'cargo' n'est pas reconnu`**
→ Rust pas installé, ou terminal pas redémarré après l'install de Rust. Ferme/rouvre le terminal.

**Le build est très long**
→ Normal la 1ʳᵉ fois (Rust compile ~400 dépendances). Les builds suivants sont bien plus rapides (1-3 min).

**SmartScreen bloque l'installateur sur l'autre PC**
→ Normal pour une app non signée numériquement. « Informations complémentaires » → « Exécuter quand même ».
Pour supprimer cet avertissement définitivement il faudrait un certificat de signature de code (payant, ~200-400 €/an) — pas nécessaire pour un usage perso.

**L'analyse photo ne marche pas sur le PC installé**
→ Le `.env` n'était pas présent au moment du build. Vérifie qu'il existe, rebuild.
