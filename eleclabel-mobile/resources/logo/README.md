# Logo ElecLabel

3 concepts de logo, en SVG vectoriel (qualité parfaite à toutes les tailles).

## Étape 1 — Choisir

Ouvre **`preview.html`** dans ton navigateur (double-clic sur le fichier, ou
clic droit → Ouvrir avec → Chrome). Tu verras les 3 concepts :

| Concept | Description |
|---|---|
| **A — Éclair** | Éclair blanc sur fond rouge. Épuré, intemporel, le choix sûr. |
| **B — Tableau** | Éclair rouge alimentant un rail de disjoncteurs, fond bleu nuit. Raconte le métier. |
| **C — Badge** | Éclair dans un anneau rouge, style emblème. Look « marque établie ». |

Chaque concept est montré en grand + en petit (32 à 96 px) sur fond clair et sombre,
pour vérifier la lisibilité une fois en icône d'app.

## Étape 2 — Télécharger le PNG

Sous le concept choisi, clique **« Télécharger PNG 1024×1024 »**.
Tu obtiens un fichier `icon-XXXX-1024.png`.

## Étape 3 — Me prévenir

Dis-moi simplement **« concept A »** (ou B / C). Je m'occupe du reste :

- Génération automatique de **toutes les icônes Android** (les 5 densités mipmap +
  icône adaptative + écran de démarrage) via `@capacitor/assets`
- Génération des **icônes desktop** (Tauri : `.ico`, `.icns`, `.png`) via `tauri icon`
- Branchement dans les 2 apps + remplacement du petit logo SVG actuel dans les headers

Tu n'auras qu'à placer le PNG téléchargé dans `eleclabel-mobile/resources/icon.png`
et lancer une commande que je te donnerai.

## Fichiers de ce dossier

```
resources/logo/
├── concept-a-eclair.svg    ← source vectorielle concept A
├── concept-b-tableau.svg   ← source vectorielle concept B
├── concept-c-badge.svg     ← source vectorielle concept C
├── preview.html            ← page de comparaison + export PNG
└── README.md               ← ce fichier
```

Les `.svg` sont les sources éditables — si tu veux ajuster une couleur ou une forme,
c'est dans ces fichiers (ou demande-moi).
