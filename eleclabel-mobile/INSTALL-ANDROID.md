# Installer ElecLabel sur ton Samsung — guide complet

3 étapes : préparer le projet (WSL) → générer l'APK (Android Studio) → installer sur le téléphone.

---

## Étape 1 — Préparer le projet (WSL, 1 min)

Dans ton terminal WSL :

```bash
cd "/mnt/d/TEK/Perso/Perso/ASE SPARKIUM/eleclabel-mobile"
./scripts/build-android.sh
```

Le script :
- Vérifie que `.env` est rempli (tes clés OpenAI + Supabase)
- Installe les dépendances npm si besoin
- **Au premier run** : scaffolde le dossier `android/` via `npx cap add android` (~30 sec)
- Compile le frontend (`npm run build`)
- Copie le bundle vers le projet Android (`npx cap sync`)
- Affiche le chemin Windows du dossier Android à ouvrir

À la fin, tu auras un message du type :
```
✓ PRÉPARATION TERMINÉE
Ouvre dans Android Studio : D:\TEK\Perso\Perso\ASE SPARKIUM\eleclabel-mobile\android
```

---

## Étape 2 — Générer l'APK (Android Studio, ~3 min première fois)

### 2.1 Ouvre le projet Android dans Android Studio

1. Lance **Android Studio** sur Windows
2. Si une fenêtre de bienvenue → clique **"Open"** (ou File → Open si déjà ouvert)
3. Navigue vers `D:\TEK\Perso\Perso\ASE SPARKIUM\eleclabel-mobile\android` → **OK**
4. Si demandé "Trust project?" → clique **Trust Project**

Android Studio commence l'**indexation Gradle** (la 1ʳᵉ fois c'est 1-5 min, ensuite c'est < 30 sec). Tu verras une barre de progression en bas. **Attends qu'elle finisse**.

### 2.2 Build l'APK

Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**

Pendant le build, tu verras une notification en bas à droite. Quand c'est fini, un message :
```
APK(s) generated successfully
locate    analyze
```

Clique sur **locate** pour ouvrir directement le dossier dans l'explorateur Windows. L'APK est à :

```
D:\TEK\Perso\Perso\ASE SPARKIUM\eleclabel-mobile\android\app\build\outputs\apk\debug\app-debug.apk
```

C'est un APK **non signé** (mode debug) — parfait pour tester sur ton propre téléphone. Pour Play Store ou distribution officielle il faudrait signer mais on s'en occupera plus tard.

---

## Étape 3 — Installer sur ton Samsung

Tu as **2 méthodes**, choisis selon ton confort.

### Méthode A — Transfert manuel via USB (le plus simple)

1. **Connecte ton Samsung en USB** au PC
2. **Sur le téléphone**, déroule la barre de notifications en haut :
   - Touche "Charge la batterie via USB" → choisis **"Transfert de fichiers"**
3. **Sur Windows**, ouvre l'Explorateur de fichiers — ton téléphone apparaît
4. **Copie** le fichier `app-debug.apk` vers `Stockage interne/Download` du téléphone
5. **Sur le téléphone** :
   - Ouvre **"Mes fichiers"** (l'app Samsung) → **Téléchargements**
   - Touche `app-debug.apk`
   - Si Android dit "Pour ta sécurité..." → touche **Paramètres**
   - Active **"Autoriser depuis cette source"** → retour
   - Touche **Installer**
   - Si une popup "Play Protect" → **Installer quand même** (c'est ton app)
   - Quand c'est fini : **Ouvrir** ou **OK**

C'est installé. L'icône ⚡ ElecLabel apparaît dans le tiroir d'apps.

### Méthode B — Installation directe via Android Studio (recommandé pour itérer)

Avantage : à chaque modif du code, un seul clic et l'app est mise à jour sur le téléphone.

1. **Active le mode développeur sur ton Samsung** (une seule fois) :
   - Paramètres → **À propos du téléphone**
   - **Informations sur le logiciel**
   - Touche **"Numéro de version"** ou **"Numéro de build"** **7 fois** d'affilée
   - "Mode développeur activé"
2. **Active le débogage USB** :
   - Paramètres → **Options pour les développeurs**
   - Active **"Débogage USB"** → autorise
3. **Branche le téléphone** au PC en USB
4. **Sur le téléphone**, une popup apparaît "Autoriser le débogage USB ?" → coche "Toujours autoriser" → **OK**
5. **Dans Android Studio** :
   - Dans la barre du haut, le menu déroulant "Device" doit afficher ton Samsung (ex: "SM-G991B")
   - Sélectionne-le
   - Clique **Run ▶** (Shift+F10)
6. L'app se compile, s'installe et se lance automatiquement sur le téléphone

---

## Cycle de développement après ça

Quand tu modifies le code :

```bash
# Dans WSL
cd "/mnt/d/TEK/Perso/Perso/ASE SPARKIUM/eleclabel-mobile"
./scripts/build-android.sh   # rebuild + sync (skip si juste tests UI)
```

Puis dans Android Studio :
- **Run ▶** (Méthode B) → réinstalle sur le téléphone branché
- ou **Build APK** + transfert (Méthode A)

---

## Dépannage Samsung

**"L'APK n'est pas compatible avec votre téléphone"** : ton Android est probablement trop ancien (on cible API 24 = Android 7.0 mini). Vérifie dans Paramètres → À propos → Android version.

**Téléphone non détecté par Android Studio** :
- Active "Débogage USB" dans Options développeur
- Essaie un autre câble USB (certains câbles sont juste "charge", pas "data")
- Installe les pilotes Samsung USB Driver sur Windows
- Sur le téléphone : Paramètres → Options développeur → Révoquer les autorisations de débogage USB, débranche puis rebranche

**"App not installed"** au tap sur l'APK :
- Désinstalle une éventuelle version précédente d'ElecLabel d'abord
- Vérifie qu'il te reste de l'espace de stockage

**Caméra ne s'ouvre pas** : Paramètres → Apps → ElecLabel → Autorisations → active **Appareil photo**.

**Aucun PDF généré au partage** : vérifie l'autorisation **Stockage** également (Paramètres → Apps → ElecLabel → Autorisations).

---

## Pour distribuer aux autres (plus tard)

L'APK actuel est en mode "debug" :
- ✅ Marche sur ton téléphone et tous les téléphones Android
- ⚠️ Le badge "Debug" apparaît sur l'icône
- ⚠️ Pas optimisé (un peu plus lourd)
- ❌ Refusé par Play Store

Quand tu voudras distribuer (Play Store, ou envoyer à des collègues) :
1. **Build → Generate Signed Bundle / APK** dans Android Studio
2. Crée une keystore (1 fois pour toutes), garde-la précieusement
3. Build en mode "release"
4. C'est ce fichier que tu distribues

Je peux t'aider à faire ça quand le moment viendra.
