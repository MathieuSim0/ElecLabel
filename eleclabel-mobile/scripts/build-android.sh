#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  ElecLabel — script de préparation du build Android (WSL)         ║
# ║                                                                    ║
# ║  Ce script fait tout ce qu'on peut faire côté WSL avant la         ║
# ║  compilation finale qui doit tourner dans Android Studio (Windows).║
# ║                                                                    ║
# ║  Étapes :                                                          ║
# ║   1. Vérifie que les deps npm sont installées                      ║
# ║   2. Scaffolde le dossier android/ si c'est la 1ʳᵉ fois            ║
# ║   3. Build le frontend Vite → dist/                                ║
# ║   4. Synchronise dist/ vers android/app/src/main/assets/public/    ║
# ║   5. Affiche les instructions pour finir dans Android Studio       ║
# ╚══════════════════════════════════════════════════════════════════╝

set -e  # stop au 1er échec
cd "$(dirname "$0")/.."  # se place à la racine du projet eleclabel-mobile

# ── Couleurs pour la lisibilité ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  ElecLabel — Préparation du build Android${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── 1. Vérifie .env ──
if [ ! -f .env ]; then
  echo -e "${RED}✗ Fichier .env manquant.${NC}"
  echo "  Crée-le à partir de .env.example et remplis les clés API."
  exit 1
fi
echo -e "${GREEN}✓${NC} Fichier .env trouvé"

# ── 2. Vérifie node_modules ──
if [ ! -d node_modules ]; then
  echo -e "${YELLOW}⚠${NC} node_modules manquant — npm install…"
  npm install
fi
echo -e "${GREEN}✓${NC} Dépendances installées"

# ── 3. Scaffold Android si pas encore fait ──
if [ ! -d android ]; then
  echo ""
  echo -e "${YELLOW}🔧 1ʳᵉ fois — scaffold du projet Android…${NC}"
  npx cap add android
  echo -e "${GREEN}✓${NC} Projet Android créé"
else
  echo -e "${GREEN}✓${NC} Projet Android déjà présent"
fi

# ── 4. Build du frontend ──
echo ""
echo -e "${BLUE}📦 Build du frontend Vite…${NC}"
npm run build
echo -e "${GREEN}✓${NC} Build terminé (dist/)"

# ── 5. Sync vers Android ──
echo ""
echo -e "${BLUE}🔄 Synchronisation Capacitor…${NC}"
npx cap sync android
echo -e "${GREEN}✓${NC} Sync terminée"

# ── 6. Instructions finales ──
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✓ PRÉPARATION TERMINÉE${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Pour finir le build APK, tu as 2 options :"
echo ""
echo -e "${YELLOW}OPTION A — Android Studio (recommandé, plus simple)${NC}"
echo "  1. Ouvre Android Studio (sur Windows)"
echo "  2. File → Open → sélectionne le dossier :"
ANDROID_PATH=$(realpath android)
WIN_PATH=$(echo "$ANDROID_PATH" | sed 's|^/mnt/\([a-z]\)|\U\1:|' | sed 's|/|\\|g')
echo "     ${WIN_PATH}"
echo "  3. Attends la fin de l'indexation Gradle (~1 min la 1ʳᵉ fois)"
echo "  4. Menu Build → Build Bundle(s) / APK(s) → Build APK(s)"
echo "  5. L'APK sera créé ici :"
echo "     ${WIN_PATH}\\app\\build\\outputs\\apk\\debug\\app-debug.apk"
echo ""
echo -e "${YELLOW}OPTION B — Installer directement via USB${NC}"
echo "  Si ton Samsung est connecté en USB avec débogage activé :"
echo "  1. Dans Android Studio (option A), clique simplement Run ▶"
echo "  2. Sélectionne ton téléphone dans la liste"
echo "  → l'app est installée et lancée automatiquement"
echo ""
echo -e "${BLUE}Lis ${NC}INSTALL-ANDROID.md${BLUE} pour le guide complet d'installation sur Samsung.${NC}"
echo ""
