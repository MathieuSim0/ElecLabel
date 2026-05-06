// Modèles de tableaux électriques pré-remplis — impression directe sans analyse IA
import type { Panel } from "../types/panel";

export interface PanelTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: "studio" | "apartment" | "house" | "special";
  panel: Panel;
}

// Helper pour créer des disjoncteurs rapidement
function bk(row: number, pos: number, poles: 1 | 2 | 3 | 4, label: string, amp: string) {
  return { id: `r${row}-${pos}`, row, position: pos, poles, label, sublabel: amp };
}

// Variante avec icône explicite (utile pour les étiquettes "carte de visite" ASE)
function bki(row: number, pos: number, poles: 1 | 2 | 3 | 4, label: string, amp: string, icon: string) {
  return { id: `r${row}-${pos}`, row, position: pos, poles, label, sublabel: amp, icon };
}

export const TEMPLATES: PanelTemplate[] = [
  // ───────────────────────── STUDIO MINI ─────────────────────────
  {
    id: "studio-mini",
    name: "Studio compact",
    description: "< 15 m² · 1 rangée 8 slots",
    icon: "🛏️",
    category: "studio",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 8,
          breakers: [
            bk(0, 0, 2, "Différentiel",   "30mA"),
            bk(0, 2, 1, "Cuisson",        "32A"),
            bk(0, 3, 1, "Lave-linge",     "20A"),
            bk(0, 4, 1, "Prises",         "16A"),
            bk(0, 5, 1, "Prises cuisine", "16A"),
            bk(0, 6, 1, "Éclairage",      "10A"),
            bk(0, 7, 1, "VMC",            "2A"),
          ],
        },
      ],
    },
  },

  // ───────────────────────── STUDIO ─────────────────────────
  {
    id: "studio",
    name: "Studio",
    description: "1 pièce · ~18 m²",
    icon: "🏠",
    category: "studio",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 13,
          breakers: [
            bk(0, 0,  2, "Différentiel",   "30mA"),
            bk(0, 2,  2, "Chauffe-eau",    "20A"),
            bk(0, 4,  1, "Cuisson",        "32A"),
            bk(0, 5,  1, "Lave-linge",     "20A"),
            bk(0, 6,  1, "Réfrigérateur",  "16A"),
            bk(0, 7,  1, "Prises cuisine", "16A"),
            bk(0, 8,  1, "Prises",         "16A"),
            bk(0, 9,  1, "Éclairage",      "10A"),
            bk(0, 10, 1, "VMC",            "2A"),
            bk(0, 11, 1, "Spare",          ""),
            bk(0, 12, 1, "Spare",          ""),
          ],
        },
      ],
    },
  },

  // ───────────────────────── T1 ─────────────────────────
  {
    id: "t1",
    name: "Appartement T1",
    description: "1 pièce + cuisine · ~30 m²",
    icon: "🏢",
    category: "apartment",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 13,
          breakers: [
            bk(0, 0,  2, "Général",        "63A"),
            bk(0, 2,  2, "Différentiel",   "30mA"),
            bk(0, 4,  2, "Chauffe-eau",    "20A"),
            bk(0, 6,  1, "Cuisson",        "32A"),
            bk(0, 7,  1, "Lave-linge",     "20A"),
            bk(0, 8,  1, "Lave-vaisselle", "20A"),
            bk(0, 9,  1, "Prises cuisine", "16A"),
            bk(0, 10, 1, "Prises séjour",  "16A"),
            bk(0, 11, 1, "Éclairage",      "10A"),
            bk(0, 12, 1, "VMC",            "2A"),
          ],
        },
      ],
    },
  },

  // ───────────────────────── T2 ─────────────────────────
  {
    id: "t2",
    name: "Appartement T2",
    description: "2 pièces · ~45 m²",
    icon: "🏢",
    category: "apartment",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 13,
          breakers: [
            bk(0, 0,  2, "Général",        "63A"),
            bk(0, 2,  2, "Différentiel",   "30mA"),
            bk(0, 4,  2, "Chauffe-eau",    "20A"),
            bk(0, 6,  1, "Cuisson",        "32A"),
            bk(0, 7,  1, "Lave-linge",     "20A"),
            bk(0, 8,  1, "Lave-vaisselle", "20A"),
            bk(0, 9,  1, "Réfrigérateur",  "16A"),
            bk(0, 10, 1, "Prises cuisine", "16A"),
            bk(0, 11, 1, "Prises séjour",  "16A"),
            bk(0, 12, 1, "Prises chambre", "16A"),
          ],
        },
        {
          index: 1, totalSlots: 13,
          breakers: [
            bk(1, 0,  2, "Différentiel",      "30mA"),
            bk(1, 2,  1, "Éclairage séjour",  "10A"),
            bk(1, 3,  1, "Éclairage chambre", "10A"),
            bk(1, 4,  1, "Éclairage cuisine", "10A"),
            bk(1, 5,  1, "Éclairage SdB",     "10A"),
            bk(1, 6,  1, "Éclairage couloir", "10A"),
            bk(1, 7,  1, "Salle de bain",     "16A"),
            bk(1, 8,  1, "VMC",               "2A"),
            bk(1, 9,  1, "Interphone",        "2A"),
            bk(1, 10, 1, "Spare",             ""),
            bk(1, 11, 1, "Spare",             ""),
            bk(1, 12, 1, "Spare",             ""),
          ],
        },
      ],
    },
  },

  // ───────────────────────── T3 ─────────────────────────
  {
    id: "t3",
    name: "Appartement T3",
    description: "3 pièces · ~65 m²",
    icon: "🏢",
    category: "apartment",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 13,
          breakers: [
            bk(0, 0,  2, "Général",        "63A"),
            bk(0, 2,  2, "Différentiel",   "30mA"),
            bk(0, 4,  2, "Chauffe-eau",    "20A"),
            bk(0, 6,  1, "Cuisson",        "32A"),
            bk(0, 7,  1, "Four",           "20A"),
            bk(0, 8,  1, "Lave-vaisselle", "20A"),
            bk(0, 9,  1, "Lave-linge",     "20A"),
            bk(0, 10, 1, "Réfrigérateur",  "16A"),
            bk(0, 11, 1, "Prises cuisine", "16A"),
            bk(0, 12, 1, "Prises séjour",  "16A"),
          ],
        },
        {
          index: 1, totalSlots: 13,
          breakers: [
            bk(1, 0,  2, "Différentiel",        "30mA"),
            bk(1, 2,  1, "Prises chambre 1",    "16A"),
            bk(1, 3,  1, "Prises chambre 2",    "16A"),
            bk(1, 4,  1, "Prises bureau",       "16A"),
            bk(1, 5,  1, "Salle de bain",       "16A"),
            bk(1, 6,  1, "Éclairage séjour",    "10A"),
            bk(1, 7,  1, "Éclairage chambres",  "10A"),
            bk(1, 8,  1, "Éclairage cuisine",   "10A"),
            bk(1, 9,  1, "Éclairage SdB/WC",    "10A"),
            bk(1, 10, 1, "Éclairage couloir",   "10A"),
            bk(1, 11, 1, "VMC",                 "2A"),
            bk(1, 12, 1, "Interphone",          "2A"),
          ],
        },
      ],
    },
  },

  // ───────────────────────── T4 ─────────────────────────
  {
    id: "t4",
    name: "Appartement T4",
    description: "4 pièces · ~85 m²",
    icon: "🏢",
    category: "apartment",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 13,
          breakers: [
            bk(0, 0,  2, "Général",        "63A"),
            bk(0, 2,  2, "Différentiel",   "30mA"),
            bk(0, 4,  2, "Chauffe-eau",    "20A"),
            bk(0, 6,  2, "Cuisinière",     "32A"),
            bk(0, 8,  1, "Four",           "20A"),
            bk(0, 9,  1, "Lave-vaisselle", "20A"),
            bk(0, 10, 1, "Réfrigérateur",  "16A"),
            bk(0, 11, 1, "Prises cuisine", "16A"),
            bk(0, 12, 1, "Hotte",          "10A"),
          ],
        },
        {
          index: 1, totalSlots: 13,
          breakers: [
            bk(1, 0,  2, "Différentiel",      "30mA"),
            bk(1, 2,  1, "Lave-linge",        "20A"),
            bk(1, 3,  1, "Sèche-linge",       "16A"),
            bk(1, 4,  1, "Prises séjour",     "16A"),
            bk(1, 5,  1, "Prises chambre 1",  "16A"),
            bk(1, 6,  1, "Prises chambre 2",  "16A"),
            bk(1, 7,  1, "Prises chambre 3",  "16A"),
            bk(1, 8,  1, "Prises bureau",     "16A"),
            bk(1, 9,  1, "Salle de bain",     "16A"),
            bk(1, 10, 1, "WC",                "10A"),
            bk(1, 11, 1, "Couloir",           "10A"),
            bk(1, 12, 1, "Interphone",        "2A"),
          ],
        },
        {
          index: 2, totalSlots: 13,
          breakers: [
            bk(2, 0,  2, "Différentiel",        "30mA"),
            bk(2, 2,  1, "Éclairage séjour",    "10A"),
            bk(2, 3,  1, "Éclairage chambre 1", "10A"),
            bk(2, 4,  1, "Éclairage chambre 2", "10A"),
            bk(2, 5,  1, "Éclairage chambre 3", "10A"),
            bk(2, 6,  1, "Éclairage bureau",    "10A"),
            bk(2, 7,  1, "Éclairage cuisine",   "10A"),
            bk(2, 8,  1, "Éclairage SdB",       "10A"),
            bk(2, 9,  1, "Éclairage couloir",   "10A"),
            bk(2, 10, 1, "VMC",                 "2A"),
            bk(2, 11, 1, "Alarme",              "2A"),
            bk(2, 12, 1, "Spare",               ""),
          ],
        },
      ],
    },
  },

  // ───────────────────────── MAISON T4 ─────────────────────────
  {
    id: "house-t4",
    name: "Maison T4",
    description: "Plain-pied · garage",
    icon: "🏡",
    category: "house",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 13,
          breakers: [
            bk(0, 0,  2, "Général",        "63A"),
            bk(0, 2,  2, "Différentiel",   "30mA"),
            bk(0, 4,  2, "Chauffe-eau",    "20A"),
            bk(0, 6,  2, "Cuisinière",     "32A"),
            bk(0, 8,  1, "Four",           "20A"),
            bk(0, 9,  1, "Lave-vaisselle", "20A"),
            bk(0, 10, 1, "Lave-linge",     "20A"),
            bk(0, 11, 1, "Sèche-linge",    "16A"),
            bk(0, 12, 1, "Réfrigérateur",  "16A"),
          ],
        },
        {
          index: 1, totalSlots: 13,
          breakers: [
            bk(1, 0,  2, "Différentiel",      "30mA"),
            bk(1, 2,  1, "Prises cuisine",    "16A"),
            bk(1, 3,  1, "Prises séjour",     "16A"),
            bk(1, 4,  1, "Prises chambre 1",  "16A"),
            bk(1, 5,  1, "Prises chambre 2",  "16A"),
            bk(1, 6,  1, "Prises chambre 3",  "16A"),
            bk(1, 7,  1, "Prises bureau",     "16A"),
            bk(1, 8,  1, "Salle de bain",     "16A"),
            bk(1, 9,  1, "Garage",            "16A"),
            bk(1, 10, 1, "Prises extérieur",  "16A"),
            bk(1, 11, 1, "Congélateur",       "16A"),
            bk(1, 12, 1, "Spare",             ""),
          ],
        },
        {
          index: 2, totalSlots: 13,
          breakers: [
            bk(2, 0,  2, "Différentiel",        "30mA"),
            bk(2, 2,  1, "Éclairage séjour",    "10A"),
            bk(2, 3,  1, "Éclairage chambres",  "10A"),
            bk(2, 4,  1, "Éclairage cuisine",   "10A"),
            bk(2, 5,  1, "Éclairage SdB/WC",    "10A"),
            bk(2, 6,  1, "Éclairage couloir",   "10A"),
            bk(2, 7,  1, "Éclairage garage",    "10A"),
            bk(2, 8,  1, "Éclairage ext.",      "10A"),
            bk(2, 9,  1, "Portail",             "10A"),
            bk(2, 10, 1, "VMC",                 "2A"),
            bk(2, 11, 1, "Alarme",              "2A"),
            bk(2, 12, 1, "Interphone",          "2A"),
          ],
        },
      ],
    },
  },

  // ───────────────────────── MAISON T5 ─────────────────────────
  {
    id: "house-t5",
    name: "Maison T5",
    description: "Étage · garage · jardin",
    icon: "🏡",
    category: "house",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 13,
          breakers: [
            bk(0, 0,  2, "Général",        "63A"),
            bk(0, 2,  2, "Différentiel",   "30mA"),
            bk(0, 4,  2, "Chauffe-eau",    "20A"),
            bk(0, 6,  2, "Cuisinière",     "32A"),
            bk(0, 8,  2, "Climatisation",  "20A"),
            bk(0, 10, 1, "Four",           "20A"),
            bk(0, 11, 1, "Lave-vaisselle", "20A"),
            bk(0, 12, 1, "Réfrigérateur",  "16A"),
          ],
        },
        {
          index: 1, totalSlots: 13,
          breakers: [
            bk(1, 0,  2, "Différentiel",      "30mA"),
            bk(1, 2,  1, "Lave-linge",        "20A"),
            bk(1, 3,  1, "Sèche-linge",       "16A"),
            bk(1, 4,  1, "Prises cuisine",    "16A"),
            bk(1, 5,  1, "Prises séjour",     "16A"),
            bk(1, 6,  1, "Prises salle TV",   "16A"),
            bk(1, 7,  1, "Prises chambre 1",  "16A"),
            bk(1, 8,  1, "Prises chambre 2",  "16A"),
            bk(1, 9,  1, "Prises chambre 3",  "16A"),
            bk(1, 10, 1, "Prises chambre 4",  "16A"),
            bk(1, 11, 1, "Prises bureau",     "16A"),
            bk(1, 12, 1, "Garage",            "16A"),
          ],
        },
        {
          index: 2, totalSlots: 13,
          breakers: [
            bk(2, 0,  2, "Différentiel",      "30mA"),
            bk(2, 2,  1, "Salle de bain",     "16A"),
            bk(2, 3,  1, "Salle d'eau",       "16A"),
            bk(2, 4,  1, "Prises extérieur",  "16A"),
            bk(2, 5,  1, "Congélateur",       "16A"),
            bk(2, 6,  1, "Volets roulants",   "16A"),
            bk(2, 7,  1, "Éclairage RDC",     "10A"),
            bk(2, 8,  1, "Éclairage étage",   "10A"),
            bk(2, 9,  1, "Éclairage cuisine", "10A"),
            bk(2, 10, 1, "Éclairage SdB",     "10A"),
            bk(2, 11, 1, "Éclairage couloir", "10A"),
            bk(2, 12, 1, "Éclairage garage",  "10A"),
          ],
        },
        {
          index: 3, totalSlots: 13,
          breakers: [
            bk(3, 0,  1, "Éclairage ext.",  "10A"),
            bk(3, 1,  1, "Éclairage jardin","10A"),
            bk(3, 2,  1, "Portail",         "10A"),
            bk(3, 3,  1, "Arrosage",        "10A"),
            bk(3, 4,  1, "VMC",             "2A"),
            bk(3, 5,  1, "Alarme",          "2A"),
            bk(3, 6,  1, "Interphone",      "2A"),
            bk(3, 7,  1, "Box internet",    "2A"),
            bk(3, 8,  1, "Sonnette",        "2A"),
            bk(3, 9,  1, "Spare",           ""),
            bk(3, 10, 1, "Spare",           ""),
            bk(3, 11, 1, "Spare",           ""),
            bk(3, 12, 1, "Spare",           ""),
          ],
        },
      ],
    },
  },

  // ───────────────────────── GARAGE / ATELIER ─────────────────────────
  {
    id: "garage",
    name: "Garage / Atelier",
    description: "Tableau divisionnaire",
    icon: "🔧",
    category: "special",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 8,
          breakers: [
            bk(0, 0, 2, "Différentiel",    "30mA"),
            bk(0, 2, 1, "Prises 16A",      "16A"),
            bk(0, 3, 1, "Prises 20A",      "20A"),
            bk(0, 4, 1, "Éclairage",       "10A"),
            bk(0, 5, 1, "Éclairage ext.",  "10A"),
            bk(0, 6, 1, "Portail",         "10A"),
            bk(0, 7, 1, "Borne voiture",   "16A"),
          ],
        },
      ],
    },
  },

  // ───────────────────────── PISCINE / POOL HOUSE ─────────────────────────
  {
    id: "pool",
    name: "Pool house",
    description: "Piscine + local technique",
    icon: "🏊",
    category: "special",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 8,
          breakers: [
            bk(0, 0, 2, "Différentiel",     "30mA"),
            bk(0, 2, 1, "Filtration",       "16A"),
            bk(0, 3, 1, "Pompe chaleur",    "20A"),
            bk(0, 4, 1, "Éclairage piscine","10A"),
            bk(0, 5, 1, "Prises pool",      "16A"),
            bk(0, 6, 1, "Éclairage ext.",   "10A"),
            bk(0, 7, 1, "Spare",            ""),
          ],
        },
      ],
    },
  },

  // ───────────────────────── LOFT ─────────────────────────
  {
    id: "loft",
    name: "Loft",
    description: "Plateau ouvert · ~90 m²",
    icon: "🏙️",
    category: "apartment",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 13,
          breakers: [
            bk(0, 0,  2, "Général",         "63A"),
            bk(0, 2,  2, "Différentiel",    "30mA"),
            bk(0, 4,  2, "Chauffe-eau",     "20A"),
            bk(0, 6,  2, "Climatisation",   "20A"),
            bk(0, 8,  1, "Cuisson",         "32A"),
            bk(0, 9,  1, "Four",            "20A"),
            bk(0, 10, 1, "Lave-vaisselle",  "20A"),
            bk(0, 11, 1, "Lave-linge",      "20A"),
            bk(0, 12, 1, "Réfrigérateur",   "16A"),
          ],
        },
        {
          index: 1, totalSlots: 13,
          breakers: [
            bk(1, 0,  2, "Différentiel",       "30mA"),
            bk(1, 2,  1, "Prises cuisine",     "16A"),
            bk(1, 3,  1, "Prises îlot",        "16A"),
            bk(1, 4,  1, "Prises salon",       "16A"),
            bk(1, 5,  1, "Prises TV",          "16A"),
            bk(1, 6,  1, "Prises bureau",      "16A"),
            bk(1, 7,  1, "Prises chambre",     "16A"),
            bk(1, 8,  1, "Salle de bain",      "16A"),
            bk(1, 9,  1, "Éclairage cuisine",  "10A"),
            bk(1, 10, 1, "Éclairage salon",    "10A"),
            bk(1, 11, 1, "Éclairage chambre",  "10A"),
            bk(1, 12, 1, "Éclairage SdB",      "10A"),
          ],
        },
      ],
    },
  },

  // ───────────────────────── DUPLEX ─────────────────────────
  {
    id: "duplex",
    name: "Duplex",
    description: "2 niveaux · ~110 m²",
    icon: "🏘️",
    category: "apartment",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 13,
          breakers: [
            bk(0, 0,  2, "Général",         "63A"),
            bk(0, 2,  2, "Différentiel RDC","30mA"),
            bk(0, 4,  2, "Chauffe-eau",     "20A"),
            bk(0, 6,  2, "Cuisinière",      "32A"),
            bk(0, 8,  1, "Four",            "20A"),
            bk(0, 9,  1, "Lave-vaisselle",  "20A"),
            bk(0, 10, 1, "Lave-linge",      "20A"),
            bk(0, 11, 1, "Prises cuisine",  "16A"),
            bk(0, 12, 1, "Réfrigérateur",   "16A"),
          ],
        },
        {
          index: 1, totalSlots: 13,
          breakers: [
            bk(1, 0,  2, "Différentiel RDC",     "30mA"),
            bk(1, 2,  1, "Prises séjour",        "16A"),
            bk(1, 3,  1, "Prises salle à manger","16A"),
            bk(1, 4,  1, "Prises entrée",        "16A"),
            bk(1, 5,  1, "WC RDC",               "10A"),
            bk(1, 6,  1, "Éclairage séjour",     "10A"),
            bk(1, 7,  1, "Éclairage cuisine",    "10A"),
            bk(1, 8,  1, "Éclairage escalier",   "10A"),
            bk(1, 9,  1, "Éclairage entrée",     "10A"),
            bk(1, 10, 1, "Interphone",           "2A"),
            bk(1, 11, 1, "VMC",                  "2A"),
            bk(1, 12, 1, "Spare",                ""),
          ],
        },
        {
          index: 2, totalSlots: 13,
          breakers: [
            bk(2, 0,  2, "Différentiel étage",   "30mA"),
            bk(2, 2,  1, "Prises chambre 1",     "16A"),
            bk(2, 3,  1, "Prises chambre 2",     "16A"),
            bk(2, 4,  1, "Prises chambre 3",     "16A"),
            bk(2, 5,  1, "Prises bureau",        "16A"),
            bk(2, 6,  1, "Salle de bain",        "16A"),
            bk(2, 7,  1, "Sèche-serviettes",     "10A"),
            bk(2, 8,  1, "Éclairage chambres",   "10A"),
            bk(2, 9,  1, "Éclairage bureau",     "10A"),
            bk(2, 10, 1, "Éclairage SdB",        "10A"),
            bk(2, 11, 1, "Éclairage couloir",    "10A"),
            bk(2, 12, 1, "Alarme",               "2A"),
          ],
        },
      ],
    },
  },

  // ───────────────────────── GRANDE MAISON TRIPHASÉE ─────────────────────────
  {
    id: "house-tri",
    name: "Grande maison triphasée",
    description: "2 étages · triphasé · ~200 m²",
    icon: "🏰",
    category: "house",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 13,
          breakers: [
            bk(0, 0,  3, "Général 3P",      "63A"),
            bk(0, 3,  2, "Différentiel 1", "30mA"),
            bk(0, 5,  2, "Chauffe-eau",    "20A"),
            bk(0, 7,  3, "Plaque triphasée","32A"),
            bk(0, 10, 1, "Four",            "20A"),
            bk(0, 11, 1, "Lave-vaisselle",  "20A"),
            bk(0, 12, 1, "Réfrigérateur",   "16A"),
          ],
        },
        {
          index: 1, totalSlots: 13,
          breakers: [
            bk(1, 0,  2, "Différentiel 2",    "30mA"),
            bk(1, 2,  2, "Climatisation",     "20A"),
            bk(1, 4,  1, "Lave-linge",        "20A"),
            bk(1, 5,  1, "Sèche-linge",       "16A"),
            bk(1, 6,  1, "Congélateur",       "16A"),
            bk(1, 7,  1, "Prises cuisine",    "16A"),
            bk(1, 8,  1, "Prises salon",      "16A"),
            bk(1, 9,  1, "Prises salle à manger","16A"),
            bk(1, 10, 1, "Prises bureau",     "16A"),
            bk(1, 11, 1, "Prises bibliothèque","16A"),
            bk(1, 12, 1, "Garage",            "16A"),
          ],
        },
        {
          index: 2, totalSlots: 13,
          breakers: [
            bk(2, 0,  2, "Différentiel 3",      "30mA"),
            bk(2, 2,  1, "Prises chambre 1",    "16A"),
            bk(2, 3,  1, "Prises chambre 2",    "16A"),
            bk(2, 4,  1, "Prises chambre 3",    "16A"),
            bk(2, 5,  1, "Prises chambre 4",    "16A"),
            bk(2, 6,  1, "Prises suite parent", "16A"),
            bk(2, 7,  1, "Prises dressing",     "16A"),
            bk(2, 8,  1, "Salle de bain 1",     "16A"),
            bk(2, 9,  1, "Salle de bain 2",     "16A"),
            bk(2, 10, 1, "Salle d'eau",         "16A"),
            bk(2, 11, 1, "WC étage",            "10A"),
            bk(2, 12, 1, "Sèche-serviettes",    "10A"),
          ],
        },
        {
          index: 3, totalSlots: 13,
          breakers: [
            bk(3, 0,  2, "Différentiel 4",      "30mA"),
            bk(3, 2,  1, "Éclairage RDC",       "10A"),
            bk(3, 3,  1, "Éclairage étage",     "10A"),
            bk(3, 4,  1, "Éclairage cuisine",   "10A"),
            bk(3, 5,  1, "Éclairage SdB",       "10A"),
            bk(3, 6,  1, "Éclairage escalier",  "10A"),
            bk(3, 7,  1, "Éclairage extérieur", "10A"),
            bk(3, 8,  1, "Éclairage jardin",    "10A"),
            bk(3, 9,  1, "Volets roulants",     "16A"),
            bk(3, 10, 1, "Portail",             "10A"),
            bk(3, 11, 1, "Arrosage",            "10A"),
            bk(3, 12, 1, "Alarme",              "2A"),
          ],
        },
      ],
    },
  },

  // ───────────────────────── BUREAU / COMMERCE ─────────────────────────
  {
    id: "office",
    name: "Bureau / Commerce",
    description: "Local professionnel · ~60 m²",
    icon: "💼",
    category: "special",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 13,
          breakers: [
            bk(0, 0,  2, "Général",         "40A"),
            bk(0, 2,  2, "Différentiel",    "30mA"),
            bk(0, 4,  2, "Climatisation",   "20A"),
            bk(0, 6,  1, "Serveur / baie",  "16A"),
            bk(0, 7,  1, "Prises bureau 1", "16A"),
            bk(0, 8,  1, "Prises bureau 2", "16A"),
            bk(0, 9,  1, "Prises accueil",  "16A"),
            bk(0, 10, 1, "Prises salle réunion","16A"),
            bk(0, 11, 1, "Cuisine / pause", "16A"),
            bk(0, 12, 1, "Sanitaire",       "16A"),
          ],
        },
        {
          index: 1, totalSlots: 13,
          breakers: [
            bk(1, 0,  1, "Éclairage accueil",    "10A"),
            bk(1, 1,  1, "Éclairage open space", "10A"),
            bk(1, 2,  1, "Éclairage bureau 1",   "10A"),
            bk(1, 3,  1, "Éclairage bureau 2",   "10A"),
            bk(1, 4,  1, "Éclairage réunion",    "10A"),
            bk(1, 5,  1, "Éclairage cuisine",    "10A"),
            bk(1, 6,  1, "Éclairage sanitaire",  "10A"),
            bk(1, 7,  1, "Enseigne vitrine",     "10A"),
            bk(1, 8,  1, "VMC",                  "2A"),
            bk(1, 9,  1, "Alarme",               "2A"),
            bk(1, 10, 1, "Interphone",           "2A"),
            bk(1, 11, 1, "Box / fibre",          "2A"),
            bk(1, 12, 1, "Spare",                ""),
          ],
        },
      ],
    },
  },

  // ───────────────────────── ATELIER PRO ─────────────────────────
  {
    id: "workshop",
    name: "Atelier professionnel",
    description: "Triphasé · machines-outils",
    icon: "🏭",
    category: "special",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 13,
          breakers: [
            bk(0, 0,  3, "Général 3P",     "63A"),
            bk(0, 3,  2, "Différentiel",   "30mA"),
            bk(0, 5,  3, "Moteur 3P",      "32A"),
            bk(0, 8,  3, "Compresseur",    "20A"),
            bk(0, 11, 1, "Prises 16A",     "16A"),
            bk(0, 12, 1, "Éclairage",      "10A"),
          ],
        },
        {
          index: 1, totalSlots: 13,
          breakers: [
            bk(1, 0,  2, "Différentiel 2",    "30mA"),
            bk(1, 2,  1, "Poste à souder",    "20A"),
            bk(1, 3,  1, "Tour / fraiseuse",  "20A"),
            bk(1, 4,  1, "Scie / raboteuse",  "20A"),
            bk(1, 5,  1, "Aspiration",        "16A"),
            bk(1, 6,  1, "Prises établi",     "16A"),
            bk(1, 7,  1, "Prises atelier",    "16A"),
            bk(1, 8,  1, "Prises extérieures","16A"),
            bk(1, 9,  1, "Éclairage atelier", "10A"),
            bk(1, 10, 1, "Éclairage stock",   "10A"),
            bk(1, 11, 1, "Éclairage ext.",    "10A"),
            bk(1, 12, 1, "Borne véhicule",    "16A"),
          ],
        },
      ],
    },
  },

  // ───────────────────────── CAMPING-CAR / MOBIL-HOME ─────────────────────────
  {
    id: "mobile",
    name: "Camping-car / Mobil-home",
    description: "Branchement extérieur · 6 slots",
    icon: "🚐",
    category: "special",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 6,
          breakers: [
            bk(0, 0, 2, "Différentiel",  "30mA"),
            bk(0, 2, 1, "Prises",        "16A"),
            bk(0, 3, 1, "Chauffe-eau",   "16A"),
            bk(0, 4, 1, "Éclairage",     "10A"),
            bk(0, 5, 1, "Frigo",         "10A"),
          ],
        },
      ],
    },
  },

  // ───────────────────────── T5 ─────────────────────────
  {
    id: "t5",
    name: "Appartement T5",
    description: "5 pièces · ~110 m²",
    icon: "🏢",
    category: "apartment",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 13,
          breakers: [
            bk(0, 0,  2, "Général",        "63A"),
            bk(0, 2,  2, "Différentiel 1", "30mA"),
            bk(0, 4,  2, "Chauffe-eau",    "20A"),
            bk(0, 6,  2, "Cuisinière",     "32A"),
            bk(0, 8,  1, "Four",           "20A"),
            bk(0, 9,  1, "Lave-vaisselle", "20A"),
            bk(0, 10, 1, "Lave-linge",     "20A"),
            bk(0, 11, 1, "Sèche-linge",    "16A"),
            bk(0, 12, 1, "Réfrigérateur",  "16A"),
          ],
        },
        {
          index: 1, totalSlots: 13,
          breakers: [
            bk(1, 0,  2, "Différentiel 2",     "30mA"),
            bk(1, 2,  1, "Prises cuisine",     "16A"),
            bk(1, 3,  1, "Prises séjour",      "16A"),
            bk(1, 4,  1, "Prises chambre 1",   "16A"),
            bk(1, 5,  1, "Prises chambre 2",   "16A"),
            bk(1, 6,  1, "Prises chambre 3",   "16A"),
            bk(1, 7,  1, "Prises chambre 4",   "16A"),
            bk(1, 8,  1, "Prises bureau",      "16A"),
            bk(1, 9,  1, "Salle de bain 1",    "16A"),
            bk(1, 10, 1, "Salle de bain 2",    "16A"),
            bk(1, 11, 1, "Sèche-serviettes",   "10A"),
            bk(1, 12, 1, "Congélateur",        "16A"),
          ],
        },
        {
          index: 2, totalSlots: 13,
          breakers: [
            bk(2, 0,  2, "Différentiel 3",     "30mA"),
            bk(2, 2,  1, "Éclairage séjour",   "10A"),
            bk(2, 3,  1, "Éclairage chambres", "10A"),
            bk(2, 4,  1, "Éclairage cuisine",  "10A"),
            bk(2, 5,  1, "Éclairage bureau",   "10A"),
            bk(2, 6,  1, "Éclairage SdB",      "10A"),
            bk(2, 7,  1, "Éclairage couloir",  "10A"),
            bk(2, 8,  1, "Éclairage WC",       "10A"),
            bk(2, 9,  1, "Volets roulants",    "16A"),
            bk(2, 10, 1, "VMC",                "2A"),
            bk(2, 11, 1, "Alarme",             "2A"),
            bki(2, 12, 1, "ASE",               "06 00 00 00 00", "📞"),
          ],
        },
      ],
    },
  },

  // ───────────────────────── MAISON ÉCOLOGIQUE / MODERNE ─────────────────────────
  {
    id: "house-eco",
    name: "Maison écologique moderne",
    description: "PV + IRVE + PAC + domotique",
    icon: "🌱",
    category: "house",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 13,
          breakers: [
            bk(0, 0,  2, "Général",          "63A"),
            bk(0, 2,  2, "Différentiel 1",   "30mA"),
            bk(0, 4,  2, "Pompe à chaleur",  "32A"),
            bk(0, 6,  2, "Chauffe-eau therm.", "20A"),
            bk(0, 8,  2, "Cuisinière",       "32A"),
            bk(0, 10, 1, "Four",             "20A"),
            bk(0, 11, 1, "Lave-vaisselle",   "20A"),
            bk(0, 12, 1, "Réfrigérateur",    "16A"),
          ],
        },
        {
          index: 1, totalSlots: 13,
          breakers: [
            bk(1, 0,  2, "Différentiel 2",     "30mA"),
            bk(1, 2,  2, "Borne IRVE",         "32A"),
            bk(1, 4,  1, "Onduleur PV",        "20A"),
            bk(1, 5,  1, "Production solaire", "16A"),
            bk(1, 6,  1, "Batterie domestique","16A"),
            bk(1, 7,  1, "Lave-linge",         "20A"),
            bk(1, 8,  1, "Sèche-linge",        "16A"),
            bk(1, 9,  1, "VMC double flux",    "16A"),
            bk(1, 10, 1, "Plancher chauffant", "16A"),
            bk(1, 11, 1, "Adoucisseur",        "16A"),
            bk(1, 12, 1, "Pompe relevage",     "16A"),
          ],
        },
        {
          index: 2, totalSlots: 13,
          breakers: [
            bk(2, 0,  2, "Différentiel 3",     "30mA"),
            bk(2, 2,  1, "Prises cuisine",     "16A"),
            bk(2, 3,  1, "Prises séjour",      "16A"),
            bk(2, 4,  1, "Prises chambres",    "16A"),
            bk(2, 5,  1, "Prises bureau",      "16A"),
            bk(2, 6,  1, "Prises SdB",         "16A"),
            bk(2, 7,  1, "Prises garage",      "16A"),
            bk(2, 8,  1, "Prises extérieur",   "16A"),
            bk(2, 9,  1, "Volets roulants",    "16A"),
            bk(2, 10, 1, "Box domotique",      "10A"),
            bk(2, 11, 1, "Vidéosurveillance",  "10A"),
            bk(2, 12, 1, "Alarme",             "2A"),
          ],
        },
        {
          index: 3, totalSlots: 13,
          breakers: [
            bk(3, 0,  2, "Différentiel 4",     "30mA"),
            bk(3, 2,  1, "Éclairage RDC",      "10A"),
            bk(3, 3,  1, "Éclairage étage",    "10A"),
            bk(3, 4,  1, "Éclairage cuisine",  "10A"),
            bk(3, 5,  1, "Éclairage SdB",      "10A"),
            bk(3, 6,  1, "Éclairage couloir",  "10A"),
            bk(3, 7,  1, "Éclairage extérieur","10A"),
            bk(3, 8,  1, "Éclairage jardin",   "10A"),
            bk(3, 9,  1, "Portail motorisé",   "10A"),
            bk(3, 10, 1, "Arrosage auto",      "10A"),
            bki(3, 11, 2, "ASE — Alain Simon", "06 00 00 00 00", "📞"),
          ],
        },
      ],
    },
  },

  // ───────────────────────── TABLEAU DIVISIONNAIRE ÉTAGE ─────────────────────────
  {
    id: "secondary-floor",
    name: "Tableau divisionnaire étage",
    description: "Sous-tableau dédié 1er étage",
    icon: "🪜",
    category: "special",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 13,
          breakers: [
            bk(0, 0,  2, "Différentiel",       "30mA"),
            bk(0, 2,  1, "Prises chambre 1",   "16A"),
            bk(0, 3,  1, "Prises chambre 2",   "16A"),
            bk(0, 4,  1, "Prises chambre 3",   "16A"),
            bk(0, 5,  1, "Prises bureau",      "16A"),
            bk(0, 6,  1, "Salle de bain",      "16A"),
            bk(0, 7,  1, "Sèche-serviettes",   "10A"),
            bk(0, 8,  1, "Éclairage chambres", "10A"),
            bk(0, 9,  1, "Éclairage SdB",      "10A"),
            bk(0, 10, 1, "Éclairage couloir",  "10A"),
            bk(0, 11, 1, "Volets roulants",    "16A"),
            bki(0, 12, 1, "ASE",               "06 00 00 00 00", "📞"),
          ],
        },
      ],
    },
  },

  // ───────────────────────── LOCAL COMMERCIAL / BOUTIQUE ─────────────────────────
  {
    id: "shop",
    name: "Boutique / Commerce",
    description: "Local de vente · ~40 m²",
    icon: "🏪",
    category: "special",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 13,
          breakers: [
            bk(0, 0,  2, "Général",         "40A"),
            bk(0, 2,  2, "Différentiel",    "30mA"),
            bk(0, 4,  2, "Climatisation",   "20A"),
            bk(0, 6,  1, "Caisse / TPE",    "16A"),
            bk(0, 7,  1, "Vitrine",         "16A"),
            bk(0, 8,  1, "Prises magasin",  "16A"),
            bk(0, 9,  1, "Prises réserve",  "16A"),
            bk(0, 10, 1, "Frigo / vitrine", "16A"),
            bk(0, 11, 1, "Sanitaire",       "16A"),
            bk(0, 12, 1, "Enseigne",        "10A"),
          ],
        },
        {
          index: 1, totalSlots: 13,
          breakers: [
            bk(1, 0,  1, "Éclairage vitrine",  "10A"),
            bk(1, 1,  1, "Éclairage magasin",  "10A"),
            bk(1, 2,  1, "Éclairage spots",    "10A"),
            bk(1, 3,  1, "Éclairage réserve",  "10A"),
            bk(1, 4,  1, "Éclairage sanitaire","10A"),
            bk(1, 5,  1, "Éclairage extérieur","10A"),
            bk(1, 6,  1, "VMC",                "2A"),
            bk(1, 7,  1, "Alarme",             "2A"),
            bk(1, 8,  1, "Vidéosurveillance",  "2A"),
            bk(1, 9,  1, "Box / fibre",        "2A"),
            bk(1, 10, 1, "Sonnette",           "2A"),
            bki(1, 11, 2, "ASE — Dépannage",   "06 00 00 00 00", "📞"),
          ],
        },
      ],
    },
  },

  // ───────────────────────── CABINET MÉDICAL / PARAMÉDICAL ─────────────────────────
  {
    id: "medical",
    name: "Cabinet médical",
    description: "Salle d'attente + 2 cabinets",
    icon: "⚕️",
    category: "special",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 13,
          breakers: [
            bk(0, 0,  2, "Général",          "40A"),
            bk(0, 2,  2, "Différentiel",     "30mA"),
            bk(0, 4,  2, "Climatisation",    "20A"),
            bk(0, 6,  1, "Stérilisateur",    "16A"),
            bk(0, 7,  1, "Autoclave",        "16A"),
            bk(0, 8,  1, "Prises cabinet 1", "16A"),
            bk(0, 9,  1, "Prises cabinet 2", "16A"),
            bk(0, 10, 1, "Prises accueil",   "16A"),
            bk(0, 11, 1, "Prises salle attente", "16A"),
            bk(0, 12, 1, "Cuisine / pause",  "16A"),
          ],
        },
        {
          index: 1, totalSlots: 13,
          breakers: [
            bk(1, 0,  1, "Éclairage cabinet 1", "10A"),
            bk(1, 1,  1, "Éclairage cabinet 2", "10A"),
            bk(1, 2,  1, "Éclairage accueil",   "10A"),
            bk(1, 3,  1, "Éclairage attente",   "10A"),
            bk(1, 4,  1, "Éclairage couloir",   "10A"),
            bk(1, 5,  1, "Éclairage sanitaire", "10A"),
            bk(1, 6,  1, "Sanitaires prises",   "16A"),
            bk(1, 7,  1, "Réseau / serveur",    "10A"),
            bk(1, 8,  1, "Téléphonie",          "2A"),
            bk(1, 9,  1, "Alarme",              "2A"),
            bk(1, 10, 1, "VMC",                 "2A"),
            bki(1, 11, 2, "ASE — Alain Simon",  "06 00 00 00 00", "📞"),
          ],
        },
      ],
    },
  },

  // ───────────────────────── SALON COIFFURE / ESTHÉTIQUE ─────────────────────────
  {
    id: "salon",
    name: "Salon coiffure / esthétique",
    description: "4 postes + bac · ~50 m²",
    icon: "💇",
    category: "special",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 13,
          breakers: [
            bk(0, 0,  2, "Général",         "40A"),
            bk(0, 2,  2, "Différentiel",    "30mA"),
            bk(0, 4,  2, "Chauffe-eau",     "20A"),
            bk(0, 6,  2, "Climatisation",   "20A"),
            bk(0, 8,  1, "Casque / séchoir 1", "16A"),
            bk(0, 9,  1, "Casque / séchoir 2", "16A"),
            bk(0, 10, 1, "Bac à shampoing", "16A"),
            bk(0, 11, 1, "Stérilisateur",   "16A"),
            bk(0, 12, 1, "Vapozone",        "16A"),
          ],
        },
        {
          index: 1, totalSlots: 13,
          breakers: [
            bk(1, 0,  1, "Prises poste 1",     "16A"),
            bk(1, 1,  1, "Prises poste 2",     "16A"),
            bk(1, 2,  1, "Prises poste 3",     "16A"),
            bk(1, 3,  1, "Prises poste 4",     "16A"),
            bk(1, 4,  1, "Prises caisse",      "16A"),
            bk(1, 5,  1, "Prises réserve",     "16A"),
            bk(1, 6,  1, "Éclairage salon",    "10A"),
            bk(1, 7,  1, "Éclairage miroirs",  "10A"),
            bk(1, 8,  1, "Éclairage vitrine",  "10A"),
            bk(1, 9,  1, "Enseigne",           "10A"),
            bk(1, 10, 1, "VMC",                "2A"),
            bki(1, 11, 2, "ASE — Alain Simon", "06 00 00 00 00", "📞"),
          ],
        },
      ],
    },
  },

  // ───────────────────────── GRANDE MAISON FAMILIALE ─────────────────────────
  {
    id: "house-t6",
    name: "Grande maison T6+",
    description: "5 chambres · garage double · ~250 m²",
    icon: "🏰",
    category: "house",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 18,
          breakers: [
            bk(0, 0,  2, "Général",          "63A"),
            bk(0, 2,  2, "Différentiel 1",   "30mA"),
            bk(0, 4,  2, "Chauffe-eau",      "20A"),
            bk(0, 6,  2, "Pompe à chaleur",  "32A"),
            bk(0, 8,  2, "Cuisinière",       "32A"),
            bk(0, 10, 2, "Climatisation",    "20A"),
            bk(0, 12, 1, "Four",             "20A"),
            bk(0, 13, 1, "Lave-vaisselle",   "20A"),
            bk(0, 14, 1, "Lave-linge",       "20A"),
            bk(0, 15, 1, "Sèche-linge",      "16A"),
            bk(0, 16, 1, "Réfrigérateur",    "16A"),
            bk(0, 17, 1, "Congélateur",      "16A"),
          ],
        },
        {
          index: 1, totalSlots: 18,
          breakers: [
            bk(1, 0,  2, "Différentiel 2",     "30mA"),
            bk(1, 2,  2, "Borne IRVE",         "32A"),
            bk(1, 4,  1, "Prises cuisine",     "16A"),
            bk(1, 5,  1, "Prises séjour",      "16A"),
            bk(1, 6,  1, "Prises salle à manger","16A"),
            bk(1, 7,  1, "Prises chambre 1",   "16A"),
            bk(1, 8,  1, "Prises chambre 2",   "16A"),
            bk(1, 9,  1, "Prises chambre 3",   "16A"),
            bk(1, 10, 1, "Prises chambre 4",   "16A"),
            bk(1, 11, 1, "Prises chambre 5",   "16A"),
            bk(1, 12, 1, "Prises suite parent","16A"),
            bk(1, 13, 1, "Prises bureau",      "16A"),
            bk(1, 14, 1, "Prises bibliothèque","16A"),
            bk(1, 15, 1, "Prises home cinéma", "16A"),
            bk(1, 16, 1, "Prises buanderie",   "16A"),
            bk(1, 17, 1, "Prises garage",      "16A"),
          ],
        },
        {
          index: 2, totalSlots: 18,
          breakers: [
            bk(2, 0,  2, "Différentiel 3",       "30mA"),
            bk(2, 2,  1, "Salle de bain 1",      "16A"),
            bk(2, 3,  1, "Salle de bain 2",      "16A"),
            bk(2, 4,  1, "Salle d'eau",          "16A"),
            bk(2, 5,  1, "Sèche-serviettes 1",   "10A"),
            bk(2, 6,  1, "Sèche-serviettes 2",   "10A"),
            bk(2, 7,  1, "Volets RDC",           "16A"),
            bk(2, 8,  1, "Volets étage",         "16A"),
            bk(2, 9,  1, "Piscine filtration",   "16A"),
            bk(2, 10, 1, "Piscine PAC",          "16A"),
            bk(2, 11, 1, "Piscine éclairage",    "10A"),
            bk(2, 12, 1, "Spa / Jacuzzi",        "20A"),
            bk(2, 13, 1, "Arrosage automatique", "10A"),
            bk(2, 14, 1, "Pompe puisard",        "16A"),
            bk(2, 15, 1, "Adoucisseur",          "16A"),
            bk(2, 16, 1, "VMC",                  "2A"),
            bk(2, 17, 1, "VMC double flux",      "16A"),
          ],
        },
        {
          index: 3, totalSlots: 18,
          breakers: [
            bk(3, 0,  2, "Différentiel 4",       "30mA"),
            bk(3, 2,  1, "Éclairage séjour",     "10A"),
            bk(3, 3,  1, "Éclairage cuisine",    "10A"),
            bk(3, 4,  1, "Éclairage chambres",   "10A"),
            bk(3, 5,  1, "Éclairage suite",      "10A"),
            bk(3, 6,  1, "Éclairage bureau",     "10A"),
            bk(3, 7,  1, "Éclairage SdB 1",      "10A"),
            bk(3, 8,  1, "Éclairage SdB 2",      "10A"),
            bk(3, 9,  1, "Éclairage couloirs",   "10A"),
            bk(3, 10, 1, "Éclairage escalier",   "10A"),
            bk(3, 11, 1, "Éclairage garage",     "10A"),
            bk(3, 12, 1, "Éclairage extérieur",  "10A"),
            bk(3, 13, 1, "Éclairage jardin",     "10A"),
            bk(3, 14, 1, "Portail motorisé",     "10A"),
            bk(3, 15, 1, "Garage porte",         "10A"),
            bk(3, 16, 1, "Vidéosurveillance",    "10A"),
            bki(3, 17, 1, "ASE",                 "06 00 00 00 00", "📞"),
          ],
        },
      ],
    },
  },

  // ───────────────────────── CHALET / RÉSIDENCE SECONDAIRE ─────────────────────────
  {
    id: "chalet",
    name: "Chalet / résidence secondaire",
    description: "Chauffage électrique fort",
    icon: "🏔️",
    category: "house",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 13,
          breakers: [
            bk(0, 0,  2, "Général",         "63A"),
            bk(0, 2,  2, "Différentiel 1",  "30mA"),
            bk(0, 4,  2, "Chauffe-eau",     "20A"),
            bk(0, 6,  2, "Cuisson",         "32A"),
            bk(0, 8,  2, "Plancher chauffant","20A"),
            bk(0, 10, 1, "Lave-vaisselle",  "20A"),
            bk(0, 11, 1, "Lave-linge",      "20A"),
            bk(0, 12, 1, "Réfrigérateur",   "16A"),
          ],
        },
        {
          index: 1, totalSlots: 13,
          breakers: [
            bk(1, 0,  2, "Différentiel 2",     "30mA"),
            bk(1, 2,  1, "Radiateur séjour",   "16A"),
            bk(1, 3,  1, "Radiateur chambre 1","16A"),
            bk(1, 4,  1, "Radiateur chambre 2","16A"),
            bk(1, 5,  1, "Radiateur chambre 3","16A"),
            bk(1, 6,  1, "Sèche-serviettes",   "10A"),
            bk(1, 7,  1, "Insert / poêle",     "10A"),
            bk(1, 8,  1, "Prises cuisine",     "16A"),
            bk(1, 9,  1, "Prises séjour",      "16A"),
            bk(1, 10, 1, "Prises chambres",    "16A"),
            bk(1, 11, 1, "Prises mezzanine",   "16A"),
            bk(1, 12, 1, "Salle de bain",      "16A"),
          ],
        },
        {
          index: 2, totalSlots: 13,
          breakers: [
            bk(2, 0,  1, "Éclairage séjour",   "10A"),
            bk(2, 1,  1, "Éclairage cuisine",  "10A"),
            bk(2, 2,  1, "Éclairage chambres", "10A"),
            bk(2, 3,  1, "Éclairage SdB",      "10A"),
            bk(2, 4,  1, "Éclairage mezzanine","10A"),
            bk(2, 5,  1, "Éclairage extérieur","10A"),
            bk(2, 6,  1, "Éclairage terrasse", "10A"),
            bk(2, 7,  1, "Pompe surpresseur",  "16A"),
            bk(2, 8,  1, "Hors-gel canalisations","10A"),
            bk(2, 9,  1, "Alarme",             "2A"),
            bk(2, 10, 1, "Box internet",       "2A"),
            bki(2, 11, 2, "ASE — Alain Simon", "06 00 00 00 00", "📞"),
          ],
        },
      ],
    },
  },

  // ───────────────────────── RÉNOVATION SIMPLE ─────────────────────────
  {
    id: "renovation",
    name: "Rénovation simple",
    description: "Mise aux normes 1 rangée",
    icon: "🔨",
    category: "apartment",
    panel: {
      rows: [
        {
          index: 0, totalSlots: 13,
          breakers: [
            bk(0, 0,  2, "Général",        "40A"),
            bk(0, 2,  2, "Différentiel",   "30mA"),
            bk(0, 4,  1, "Cuisson",        "32A"),
            bk(0, 5,  1, "Lave-linge",     "20A"),
            bk(0, 6,  1, "Lave-vaisselle", "20A"),
            bk(0, 7,  1, "Réfrigérateur",  "16A"),
            bk(0, 8,  1, "Prises cuisine", "16A"),
            bk(0, 9,  1, "Prises pièces",  "16A"),
            bk(0, 10, 1, "Salle de bain",  "16A"),
            bk(0, 11, 1, "Éclairage",      "10A"),
            bki(0, 12, 1, "ASE",           "06 00 00 00 00", "📞"),
          ],
        },
      ],
    },
  },
];

export const CATEGORIES = [
  { id: "studio",    label: "Studio",         icon: "🏠" },
  { id: "apartment", label: "Appartements",   icon: "🏢" },
  { id: "house",     label: "Maisons",        icon: "🏡" },
  { id: "special",   label: "Spécifiques",    icon: "🔧" },
] as const;
