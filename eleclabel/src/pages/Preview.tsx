// Page aperçu PDF — rendu A4 avant téléchargement
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PDFViewer } from "@react-pdf/renderer";
import { usePanelStore } from "../store/panelStore";
import { PdfDocument, generatePdfBlob } from "../components/PdfExport";
import { getCircuitIcon } from "../utils/circuitIcons";
import { buildIconMap } from "../utils/emojiCanvas";
import { LABEL_HEIGHT_PRESETS_MM, DEFAULT_LABEL_HEIGHT_MM } from "../utils/pdfLayout";
import LogoMark from "../components/LogoMark";

export default function Preview() {
  const navigate = useNavigate();
  const { panel, reset } = usePanelStore();
  const [dlHovered, setDlHovered] = useState(false);

  // Index dans LABEL_HEIGHT_PRESETS_MM pour la hauteur d'étiquette choisie par l'utilisateur
  const defaultIndex = Math.max(
    0,
    LABEL_HEIGHT_PRESETS_MM.indexOf(DEFAULT_LABEL_HEIGHT_MM),
  );
  const [heightIndex, setHeightIndex] = useState(defaultIndex);
  const labelHeightMm = LABEL_HEIGHT_PRESETS_MM[heightIndex];

  useEffect(() => {
    if (!panel) navigate("/", { replace: true });
  }, [panel, navigate]);

  const iconMap = useMemo(() => {
    if (!panel) return {};
    const icons = panel.rows.flatMap((row) => row.breakers.map((b) => getCircuitIcon(b.label)));
    return buildIconMap(icons);
  }, [panel]);

  if (!panel) return null;

  const totalBreakers = panel.rows.reduce((s, r) => s + r.breakers.length, 0);

  const handleDownload = async () => {
    try {
      const blob = await generatePdfBlob(panel, labelHeightMm);
      const url  = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href  = url;
      link.download = `eleclabel-etiquettes-${labelHeightMm}mm.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erreur génération PDF :", err);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F7F8FC", fontFamily: "var(--font-sans)" }}>

      {/* ── Header ── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "#FFFFFF",
          borderBottom: "1px solid #E5E7EB",
          boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
          padding: "0 24px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        {/* Retour à l'accueil — sobre */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            onClick={() => {
              reset();
              navigate("/");
            }}
            title="Retour à l'accueil — modifications déjà enregistrées dans l'historique"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 500,
              color: "#6B7280",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "6px 10px",
              borderRadius: 8,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#F3F4F6"; e.currentTarget.style.color = "#111827"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#6B7280"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Retour
          </button>
          <button
            type="button"
            onClick={() => navigate("/editor")}
            title="Retourner à l'éditeur"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              fontWeight: 500,
              color: "#9CA3AF",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 6,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#4B5563"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#9CA3AF"; }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            éditeur
          </button>
        </div>

        {/* Centre : logo + stats */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LogoMark size={30} />
          <div>
            <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>Aperçu PDF</span>
            <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: 8 }}>
              {panel.rows.length} rangée{panel.rows.length > 1 ? "s" : ""} · {totalBreakers} disjoncteur{totalBreakers > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Télécharger */}
        <button
          type="button"
          onClick={handleDownload}
          onMouseEnter={() => setDlHovered(true)}
          onMouseLeave={() => setDlHovered(false)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "7px 16px",
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 8,
            border: "none",
            background: dlHovered
              ? "linear-gradient(135deg, #111827, #1F2937)"
              : "linear-gradient(135deg, #E63946, #C0303C)",
            color: "#FFFFFF",
            cursor: "pointer",
            boxShadow: "0 2px 10px rgba(230,57,70,0.4)",
            transition: "all 0.15s ease",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Télécharger le PDF
        </button>
      </header>

      {/* ── Sélecteur de hauteur ── */}
      <HeightSelector
        heightIndex={heightIndex}
        labelHeightMm={labelHeightMm}
        onChange={setHeightIndex}
      />

      {/* ── Viewer PDF ── */}
      <main style={{ flex: 1, display: "flex" }}>
        <PDFViewer style={{ flex: 1, border: "none" }} key={labelHeightMm}>
          <PdfDocument panel={panel} iconMap={iconMap} labelHeightMm={labelHeightMm} />
        </PDFViewer>
      </main>
    </div>
  );
}

interface HeightSelectorProps {
  heightIndex: number;
  labelHeightMm: number;
  onChange: (index: number) => void;
}

function HeightSelector({ heightIndex, labelHeightMm, onChange }: HeightSelectorProps) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderBottom: "1px solid #E5E7EB",
        padding: "16px 32px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Titre + valeur courante */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5" />
            <polyline points="6 11 12 5 18 11" />
            <polyline points="6 13 12 19 18 13" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
            Hauteur d'étiquette
          </span>
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>
            (largeur 1P fixe : 18 mm)
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 4,
            padding: "4px 10px",
            background: "#F3F4F6",
            borderRadius: 8,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 700, color: "#111827", fontVariantNumeric: "tabular-nums" }}>
            {labelHeightMm}
          </span>
          <span style={{ fontSize: 11, color: "#6B7280", fontWeight: 500 }}>mm</span>
        </div>
      </div>

      {/* Slider avec graduations */}
      <div style={{ position: "relative", padding: "8px 0 22px" }}>
        <input
          type="range"
          min={0}
          max={LABEL_HEIGHT_PRESETS_MM.length - 1}
          step={1}
          value={heightIndex}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            width: "100%",
            margin: 0,
            accentColor: "#E63946",
            cursor: "pointer",
          }}
        />

        {/* Graduations sous le slider */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            justifyContent: "space-between",
            pointerEvents: "none",
          }}
        >
          {LABEL_HEIGHT_PRESETS_MM.map((mm, i) => (
            <button
              key={mm}
              type="button"
              onClick={() => onChange(i)}
              style={{
                fontSize: 10,
                fontWeight: i === heightIndex ? 700 : 500,
                color: i === heightIndex ? "#E63946" : "#9CA3AF",
                background: "transparent",
                border: "none",
                padding: "2px 4px",
                cursor: "pointer",
                pointerEvents: "auto",
                fontVariantNumeric: "tabular-nums",
                transition: "color 0.15s ease",
              }}
            >
              {mm}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
