// Correspondance mots-clés → icône emoji pour les étiquettes de disjoncteurs

const ICON_RULES: Array<{ keywords: string[]; icon: string }> = [
  // Alimentation générale
  { keywords: ["général", "general", "principale", "principal", "compteur", "entrée", "hager", "legrand"], icon: "⚡" },
  { keywords: ["différentiel", "differentiel", "diff"], icon: "🔒" },

  // Cuisine & électroménager
  { keywords: ["cuisinière", "cuisiniere", "plaque", "induction", "cuisson"], icon: "🍳" },
  { keywords: ["four", "micro-onde", "microonde", "micro onde"], icon: "🔥" },
  { keywords: ["réfrigérateur", "refrigerateur", "frigo", "congélateur", "congelateur"], icon: "❄️" },
  { keywords: ["lave-vaisselle", "lave vaisselle", "lavevaisselle", "vaisselle"], icon: "🍽️" },
  { keywords: ["lave-linge", "lave linge", "lavelinge", "machine à laver", "machine a laver"], icon: "👕" },
  { keywords: ["sèche-linge", "seche-linge", "sèche linge", "seche linge"], icon: "💨" },
  { keywords: ["cuisine", "plan de travail", "prises cuisine"], icon: "🍴" },
  { keywords: ["hotte"], icon: "💭" },

  // Eau chaude & chauffage
  { keywords: ["chauffe-eau", "chauffe eau", "chauffeeau", "ballon", "thermor", "cumulus"], icon: "🌡️" },
  { keywords: ["chaudière", "chaudiere", "chauffage", "radiateur", "poêle", "poele", "climatisation", "clim", "pompe à chaleur", "pompe chaleur", "pac"], icon: "🌡️" },
  { keywords: ["plancher chauffant", "plancher"], icon: "🌡️" },

  // Pièces de vie
  { keywords: ["séjour", "sejour", "salon", "living", "salle à manger", "salle manger"], icon: "🛋️" },
  { keywords: ["chambre", "room"], icon: "🛏️" },
  { keywords: ["bureau", "office", "informatique"], icon: "💻" },
  { keywords: ["bibliothèque", "bibliotheque"], icon: "📚" },
  { keywords: ["couloir", "hall", "entrée", "entree"], icon: "🚪" },
  { keywords: ["cave", "sous-sol", "sous sol", "débarras", "debarras", "grenier", "combles"], icon: "📦" },
  { keywords: ["garage"], icon: "🚗" },
  { keywords: ["terrasse", "balcon", "vérandah", "verandah"], icon: "☀️" },

  // Sanitaires
  { keywords: ["salle de bain", "sdb", "bain", "baignoire"], icon: "🛁" },
  { keywords: ["douche"], icon: "🚿" },
  { keywords: ["wc", "toilette", "toilettes", "sanitaire"], icon: "🚽" },
  { keywords: ["buanderie"], icon: "🧺" },

  // Éclairage
  { keywords: ["éclairage", "eclairage", "lumière", "lumiere", "spot", "lustre", "lampe", "neon", "néon"], icon: "💡" },
  { keywords: ["éclairage extérieur", "eclairage exterieur", "ext.", "extérieur", "exterieur"], icon: "🔦" },

  // Extérieur & sécurité
  { keywords: ["jardin", "pelouse", "arrosage"], icon: "🌿" },
  { keywords: ["piscine", "pool"], icon: "🏊" },
  { keywords: ["portail", "porte garage", "motorisation"], icon: "🔧" },
  { keywords: ["alarme", "détecteur", "detecteur", "sirène", "sirene", "sécurité", "securite"], icon: "🔔" },
  { keywords: ["caméra", "camera", "vidéo", "video", "interphone", "visiophone"], icon: "📷" },
  { keywords: ["domotique", "bticino", "knx"], icon: "🏠" },

  // Réseau & communication
  { keywords: ["box", "internet", "fibre", "routeur", "livebox", "freebox", "sfr"], icon: "📡" },
  { keywords: ["tv", "télévision", "television", "home cinéma", "home cinema", "hifi", "hi-fi"], icon: "📺" },
  { keywords: ["téléphone", "telephone", "rj45"], icon: "📞" },

  // Ventilation
  { keywords: ["vmc", "ventilation", "extracteur", "aération", "aeration"], icon: "🌬️" },

  // Divers
  { keywords: ["spare", "libre", "réserve", "reserve", "disponible"], icon: "⬜" },
  { keywords: ["volet", "store", "roulant"], icon: "🪟" },
  { keywords: ["ascenseur", "monte-charge"], icon: "🛗" },
  { keywords: ["borne", "véhicule", "vehicule", "voiture électrique", "voiture electrique", "irve"], icon: "🔌" },
];

// Retourne l'icône correspondant au label, ou une icône générique si aucune correspondance
export function getCircuitIcon(label: string): string {
  if (!label.trim()) return "◻️";
  const lower = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const rule of ICON_RULES) {
    for (const keyword of rule.keywords) {
      const normalizedKeyword = keyword.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (lower.includes(normalizedKeyword)) return rule.icon;
    }
  }
  return "🔌";
}
