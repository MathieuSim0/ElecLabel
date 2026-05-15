// Page factures — capture/upload, OCR, listing groupé par mois, export ZIP.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInvoiceStore } from "../store/invoiceStore";
import { processInvoiceImage, createInvoiceThumbnail } from "../services/imageInvoice";
import { runOcr, extractInvoiceMetadata } from "../services/ocrInvoice";
import { generateInvoicePdfBlob, defaultInvoiceFilename } from "../services/pdfInvoice";
import { generateInvoicesZip, defaultZipFilenameForMonth } from "../services/zipExport";
import { type Invoice, type InvoiceMetadata, formatAmount, parseAmount, monthKey, monthLabel } from "../types/invoice";
import AccountMenu from "../components/AccountMenu";
import SyncStatus from "../components/SyncStatus";
import LogoMark from "../components/LogoMark";

// Facture en cours de vérification — image+OCR fait, mais pas encore sauvegardée
interface PendingInvoice {
  imageBase64: string;
  imageMimeType: string;
  thumbnail?: string;
  ocrRawText?: string;
  metadata: InvoiceMetadata;
}

export default function Invoices() {
  const navigate = useNavigate();
  const { invoices, loading, load, add, updateMeta, remove, loadPhotoIfMissing } = useInvoiceStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState<{ step: string; progress: number } | null>(null);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [pending, setPending] = useState<PendingInvoice | null>(null);
  const [exportingMonth, setExportingMonth] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Charge depuis IndexedDB au montage
  useEffect(() => {
    load();
  }, [load]);

  // Grouper par mois
  const grouped = useMemo(() => {
    const map = new Map<string, Invoice[]>();
    for (const inv of invoices) {
      const key = monthKey(inv);
      const arr = map.get(key);
      if (arr) arr.push(inv);
      else map.set(key, [inv]);
    }
    // Tri décroissant : mois le plus récent en premier
    return Array.from(map.entries())
      .sort(([a], [b]) => (a > b ? -1 : 1))
      .map(([key, items]) => ({
        key,
        label: monthLabel(key),
        items: items.sort((a, b) => b.createdAt - a.createdAt),
        totalCents: items.reduce((s, i) => s + (i.amountCents ?? 0), 0),
      }));
  }, [invoices]);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setSuccess(null);
    const totalFiles = fileList.length;

    // ── CAS 1 fichier : on traite et on ouvre le form de VÉRIFICATION (sans save) ──
    if (totalFiles === 1) {
      const file = fileList[0];
      try {
        setProcessing({ step: `Traitement de ${file.name}…`, progress: 10 });
        const base64Raw = await fileToBase64(file);
        const mime = file.type || "image/jpeg";

        setProcessing({ step: "Amélioration de l'image…", progress: 25 });
        const processed = await processInvoiceImage(base64Raw, mime, 3000);

        setProcessing({ step: "Miniature…", progress: 45 });
        const thumbnail = await createInvoiceThumbnail(processed.base64, processed.mimeType, 300);

        setProcessing({ step: "Lecture OCR (premier scan plus long)…", progress: 65 });
        let metadata: InvoiceMetadata = {};
        let ocrText = "";
        try {
          ocrText = await runOcr(processed.base64, processed.mimeType);
          metadata = extractInvoiceMetadata(ocrText);
        } catch (ocrErr) {
          console.warn("OCR failed:", ocrErr);
        }

        setProcessing(null);
        // Pose en pending — rien n'est sauvegardé tant que l'utilisateur ne valide pas
        setPending({
          imageBase64: processed.base64,
          imageMimeType: processed.mimeType,
          thumbnail,
          ocrRawText: ocrText || undefined,
          metadata,
        });
      } catch (err) {
        setProcessing(null);
        setError(err instanceof Error ? err.message : String(err));
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // ── CAS multi-fichiers : traitement en batch + save direct (pas faisable de
    //    confirmer 50 factures une par une — on garde le flux rapide d'import en masse) ──
    let created = 0;
    for (let i = 0; i < totalFiles; i++) {
      const file = fileList[i];
      try {
        setProcessing({ step: `Traitement (${i + 1}/${totalFiles}) — ${file.name}`, progress: 0 });
        const base64Raw = await fileToBase64(file);
        const mime = file.type || "image/jpeg";

        setProcessing({ step: `Amélioration de l'image (${i + 1}/${totalFiles})`, progress: 20 });
        const processed = await processInvoiceImage(base64Raw, mime, 3000);

        setProcessing({ step: `Miniature (${i + 1}/${totalFiles})`, progress: 35 });
        const thumbnail = await createInvoiceThumbnail(processed.base64, processed.mimeType, 300);

        setProcessing({ step: `OCR (${i + 1}/${totalFiles})…`, progress: 55 });
        let metadata: InvoiceMetadata = {};
        let ocrText = "";
        try {
          ocrText = await runOcr(processed.base64, processed.mimeType);
          metadata = extractInvoiceMetadata(ocrText);
        } catch (ocrErr) {
          console.warn("OCR failed:", ocrErr);
        }

        setProcessing({ step: `Sauvegarde (${i + 1}/${totalFiles})…`, progress: 75 });
        await add({
          imageBase64: processed.base64,
          imageMimeType: processed.mimeType,
          thumbnail,
          ocrRawText: ocrText || undefined,
          ...metadata,
        });
        created++;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    setProcessing(null);
    if (created > 0) {
      setSuccess(`✓ ${created} facture${created > 1 ? "s" : ""} ajoutée${created > 1 ? "s" : ""} — pense à vérifier les infos OCR`);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConfirmPending = async (meta: InvoiceMetadata) => {
    if (!pending) return;
    try {
      await add({
        imageBase64: pending.imageBase64,
        imageMimeType: pending.imageMimeType,
        thumbnail: pending.thumbnail,
        ocrRawText: pending.ocrRawText,
        ...meta,
        reviewed: true,
      });
      setPending(null);
      setSuccess("✓ Facture enregistrée");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'enregistrement.");
    }
  };

  const handleDiscardPending = () => {
    setPending(null);
  };

  const handleExportMonth = async (month: { key: string; label: string; items: Invoice[] }) => {
    setExportingMonth(month.key);
    setExportProgress({ current: 0, total: month.items.length, label: "Préparation…" });
    setError(null);
    try {
      const blob = await generateInvoicesZip(month.items, (current, total, label) => {
        setExportProgress({ current, total, label });
      });
      const filename = defaultZipFilenameForMonth(month.key);
      downloadBlob(blob, filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'export.");
    } finally {
      setExportingMonth(null);
      setExportProgress(null);
    }
  };

  const handleExportSingle = async (invoice: Invoice) => {
    setError(null);
    try {
      // Si photo HD pas encore chargée (vient du cloud), la télécharge d'abord
      if (!invoice.imageBase64 || invoice.imageBase64.length === 0) {
        await loadPhotoIfMissing(invoice.id);
      }
      const refreshed = useInvoiceStore.getState().invoices.find((i) => i.id === invoice.id) ?? invoice;
      const blob = await generateInvoicePdfBlob(refreshed);
      downloadBlob(blob, defaultInvoiceFilename(refreshed));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'export.");
    }
  };

  const handleEdit = async (invoice: Invoice) => {
    // Charge la photo HD au cas où on ne l'a pas encore (synchro depuis cloud)
    if (!invoice.imageBase64 || invoice.imageBase64.length === 0) {
      await loadPhotoIfMissing(invoice.id);
    }
    const refreshed = useInvoiceStore.getState().invoices.find((i) => i.id === invoice.id) ?? invoice;
    setEditing(refreshed);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F7F8FC", fontFamily: "var(--font-sans)" }}>
      {/* ── Header ── */}
      <header style={{ background: "#FFFFFF", borderBottom: "1px solid #E5E7EB" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <LogoMark size={34} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", letterSpacing: "-0.3px" }}>
                ElecLabel
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                Étiquettes de tableau électrique
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SyncStatus />
            <AccountMenu />
          </div>
        </div>
        <div style={{ display: "flex", padding: "0 32px", gap: 4 }}>
          <TabButton active={false} label="Analyse photo" icon="📷" onClick={() => navigate("/")} />
          <TabButton active={false} label="Modèles prêts" icon="📋" onClick={() => navigate("/templates")} />
          <TabButton active={false} label="Historique" icon="🕐" onClick={() => navigate("/history")} />
          <TabButton active label="Factures" icon="🧾" onClick={() => {}} />
        </div>
      </header>

      <main style={{ flex: 1, padding: "28px 24px 60px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ marginBottom: 22, textAlign: "center" }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: "#111827", letterSpacing: "-0.5px", marginBottom: 8 }}>
              Factures
            </h1>
            <p style={{ fontSize: 13, color: "#6B7280" }}>
              Importez vos factures, l'OCR extrait les infos, chaque mois s'exporte en un clic pour la comptable.
            </p>
          </div>

          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: "2px dashed #D1D5DB",
              background: "#FFFFFF",
              borderRadius: 14,
              padding: "28px 20px",
              textAlign: "center",
              cursor: processing ? "wait" : "pointer",
              marginBottom: 20,
              transition: "all 0.15s ease",
              opacity: processing ? 0.6 : 1,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>🧾</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
              Glissez vos factures ici ou cliquez pour sélectionner
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>
              .jpg, .png, .heic — l'OCR remplit les infos · télécharge le PDF quand tu veux
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            style={{ display: "none" }}
          />

          {processing && (
            <div
              style={{
                padding: "12px 14px",
                background: "#EEF2FF",
                border: "1px solid #C7D2FE",
                borderRadius: 10,
                marginBottom: 16,
                fontSize: 12,
                color: "#3730A3",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span
                  style={{
                    width: 14, height: 14, borderRadius: "50%",
                    border: "2px solid rgba(55,48,163,0.3)",
                    borderTopColor: "#3730A3",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                {processing.step}
              </div>
              <div style={{ height: 4, background: "rgba(55,48,163,0.15)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${processing.progress}%`, height: "100%", background: "#3730A3", transition: "width 0.3s" }} />
              </div>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: "10px 14px",
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: 10,
                marginBottom: 16,
                color: "#991B1B",
                fontSize: 12,
              }}
            >
              ⚠ {error}
            </div>
          )}

          {success && (
            <div
              style={{
                padding: "12px 14px",
                background: "#ECFDF5",
                border: "1px solid #A7F3D0",
                borderRadius: 10,
                marginBottom: 16,
                color: "#065F46",
                fontSize: 13,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <span>{success}</span>
              <button
                type="button"
                onClick={() => setSuccess(null)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#065F46",
                  fontSize: 16,
                  cursor: "pointer",
                  padding: "0 4px",
                }}
              >
                ×
              </button>
            </div>
          )}

          {/* Liste mois */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#9CA3AF", fontSize: 13 }}>
              Chargement…
            </div>
          ) : invoices.length === 0 ? (
            <EmptyState />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {grouped.map((month) => (
                <MonthSection
                  key={month.key}
                  month={month}
                  exporting={exportingMonth === month.key}
                  exportProgress={exportingMonth === month.key ? exportProgress : null}
                  onExport={() => handleExportMonth(month)}
                  onEdit={handleEdit}
                  onExportSingle={handleExportSingle}
                  onDelete={async (inv) => {
                    if (window.confirm(`Supprimer la facture "${inv.supplier ?? "(sans nom)"}" ?`)) {
                      await remove(inv.id);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modale de vérification AVANT enregistrement */}
      {pending && (
        <PendingInvoiceModal
          pending={pending}
          onConfirm={handleConfirmPending}
          onDiscard={handleDiscardPending}
        />
      )}

      {/* Modale d'édition — bouton séparé "Télécharger PDF" pour rester explicite */}
      {editing && (
        <InvoiceEditModal
          invoice={editing}
          onSave={async (meta) => {
            await updateMeta(editing.id, { ...meta, reviewed: true });
            setSuccess("✓ Modifications enregistrées");
            setEditing(null);
          }}
          onDownload={async (meta) => {
            // Sauvegarde d'abord pour que les changements soient persistés
            await updateMeta(editing.id, { ...meta, reviewed: true });
            const updated: Invoice = { ...editing, ...meta, reviewed: true };
            try {
              const blob = await generateInvoicePdfBlob(updated);
              const filename = defaultInvoiceFilename(updated);
              downloadBlob(blob, filename);
              setSuccess(`✓ PDF téléchargé : ${filename}`);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Erreur génération PDF.");
            }
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
          onDelete={async () => {
            if (window.confirm("Supprimer cette facture ?")) {
              await remove(editing.id);
              setEditing(null);
            }
          }}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─────────────────────── Sub-components ───────────────────────

interface MonthSectionProps {
  month: { key: string; label: string; items: Invoice[]; totalCents: number };
  exporting: boolean;
  exportProgress: { current: number; total: number; label: string } | null;
  onExport: () => void;
  onEdit: (invoice: Invoice) => void;
  onExportSingle: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
}

function MonthSection({ month, exporting, exportProgress, onExport, onEdit, onExportSingle, onDelete }: MonthSectionProps) {
  return (
    <section
      style={{
        background: "#FFFFFF",
        borderRadius: 14,
        border: "1px solid #E5E7EB",
        padding: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
            {month.label}
          </h2>
          <p style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
            {month.items.length} facture{month.items.length > 1 ? "s" : ""}
            {month.totalCents > 0 && ` · ${formatAmount(month.totalCents)} total`}
          </p>
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 8,
            border: "none",
            background: exporting ? "#9CA3AF" : "linear-gradient(135deg, #111827, #1F2937)",
            color: "#FFF",
            cursor: exporting ? "wait" : "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          {exporting ? (
            <>
              <span
                style={{
                  width: 12, height: 12, borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#FFF",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              {exportProgress ? `${exportProgress.current}/${exportProgress.total}…` : "Export…"}
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Exporter le mois (.zip)
            </>
          )}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 10,
        }}
      >
        {month.items.map((inv) => (
          <InvoiceCard
            key={inv.id}
            invoice={inv}
            onEdit={() => onEdit(inv)}
            onExport={() => onExportSingle(inv)}
            onDelete={() => onDelete(inv)}
          />
        ))}
      </div>
    </section>
  );
}

function InvoiceCard({
  invoice,
  onEdit,
  onExport,
  onDelete,
}: {
  invoice: Invoice;
  onEdit: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const needsReview = !invoice.reviewed;
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 10,
        border: `1px solid ${needsReview ? "#FCD34D" : "#E5E7EB"}`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <button
        type="button"
        onClick={onEdit}
        style={{
          height: 140,
          background: "#F3F4F6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          border: "none",
          cursor: "pointer",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {invoice.thumbnail ? (
          <img
            src={`data:image/jpeg;base64,${invoice.thumbnail}`}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ fontSize: 32, opacity: 0.4 }}>🧾</span>
        )}
        {needsReview && (
          <span
            style={{
              position: "absolute", top: 6, right: 6,
              padding: "2px 6px", borderRadius: 4,
              background: "#FBBF24", color: "#78350F",
              fontSize: 10, fontWeight: 700,
            }}
          >
            À vérifier
          </span>
        )}
      </button>
      <div style={{ padding: 10, flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            fontSize: 13, fontWeight: 700, color: "#111827",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {invoice.supplier?.trim() || "(fournisseur ?)"}
        </div>
        <div style={{ fontSize: 11, color: "#6B7280", display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span>{invoice.invoiceDate ?? new Date(invoice.createdAt).toLocaleDateString("fr-FR")}</span>
          <span style={{ fontWeight: 700, color: "#111827" }}>
            {invoice.amountCents !== undefined ? formatAmount(invoice.amountCents) : "—"}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
          <button
            type="button"
            onClick={onExport}
            title="Télécharger le PDF"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "7px",
              fontSize: 12, fontWeight: 700,
              borderRadius: 6, border: "none",
              background: "linear-gradient(135deg, #E63946, #C0303C)",
              color: "#FFF", cursor: "pointer",
              boxShadow: "0 2px 6px rgba(230,57,70,0.3)",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Télécharger PDF
          </button>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              onClick={onEdit}
              style={{
                flex: 1, padding: "6px",
                fontSize: 11, fontWeight: 600,
                borderRadius: 6, border: "1px solid #E5E7EB",
                background: "#FFF", color: "#4B5563", cursor: "pointer",
              }}
            >
              Modifier
            </button>
            <button
              type="button"
              onClick={onDelete}
              title="Supprimer"
              style={{
                padding: "6px 10px",
                fontSize: 12, border: "1px solid #E5E7EB",
                borderRadius: 6, background: "#FFF", color: "#4B5563", cursor: "pointer",
              }}
            >
              🗑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface InvoiceEditModalMeta {
  invoiceDate?: string;
  supplier?: string;
  reference?: string;
  amountCents?: number;
  notes?: string;
}

interface InvoiceEditModalProps {
  invoice: Invoice;
  onSave: (meta: InvoiceEditModalMeta) => void;
  onDownload: (meta: InvoiceEditModalMeta) => void;
  onClose: () => void;
  onDelete: () => void;
}

function InvoiceEditModal({ invoice, onSave, onDownload, onClose, onDelete }: InvoiceEditModalProps) {
  const [supplier, setSupplier] = useState(invoice.supplier ?? "");
  const [invoiceDate, setInvoiceDate] = useState(invoice.invoiceDate ?? "");
  const [reference, setReference] = useState(invoice.reference ?? "");
  const [amountStr, setAmountStr] = useState(
    invoice.amountCents !== undefined ? (invoice.amountCents / 100).toFixed(2).replace(".", ",") : "",
  );
  const [notes, setNotes] = useState(invoice.notes ?? "");

  const collectMeta = (): InvoiceEditModalMeta => ({
    supplier: supplier.trim() || undefined,
    invoiceDate: invoiceDate.trim() || undefined,
    reference: reference.trim() || undefined,
    amountCents: amountStr.trim() ? parseAmount(amountStr) : undefined,
    notes: notes.trim() || undefined,
  });
  const save = () => onSave(collectMeta());
  const download = () => onDownload(collectMeta());

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    fontSize: 13,
    border: "1.5px solid #E5E7EB",
    borderRadius: 8,
    background: "#FFFFFF",
    outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "#4B5563",
    marginBottom: 4,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(17,24,39,0.55)", zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF", borderRadius: 14,
          width: "100%", maxWidth: 920, maxHeight: "90vh",
          display: "flex", flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Vérifier la facture</h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: "1px solid #E5E7EB", background: "#FFF", color: "#6B7280",
              fontSize: 16, cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, padding: 20 }}>
          {/* Aperçu PDF — mime la mise en page de l'export A4 */}
          <PdfMockPreview
            supplier={supplier}
            invoiceDate={invoiceDate}
            reference={reference}
            amountStr={amountStr}
            notes={notes}
            imageBase64={invoice.imageBase64}
            imageMimeType={invoice.imageMimeType}
          />

          {/* Champs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle}>Fournisseur</label>
              <input type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Ex: Schneider Electric" style={fieldStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>N° facture</label>
                <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="FA-2026-001" style={fieldStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Montant TTC (€)</label>
              <input type="text" inputMode="decimal" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} placeholder="142,50" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Mention libre (chantier, ref interne…)"
                style={{ ...fieldStyle, resize: "vertical", fontFamily: "inherit" }}
              />
            </div>
            {invoice.ocrRawText && (
              <details style={{ marginTop: 4 }}>
                <summary style={{ fontSize: 11, color: "#9CA3AF", cursor: "pointer" }}>
                  Texte brut OCR (debug)
                </summary>
                <pre
                  style={{
                    marginTop: 6, padding: 10,
                    background: "#F9FAFB", borderRadius: 6, fontSize: 10,
                    color: "#6B7280", maxHeight: 120, overflowY: "auto",
                    whiteSpace: "pre-wrap", fontFamily: "monospace",
                  }}
                >
                  {invoice.ocrRawText}
                </pre>
              </details>
            )}
          </div>
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", gap: 8 }}>
          <button
            type="button"
            onClick={onDelete}
            style={{
              padding: "9px 14px", fontSize: 12, fontWeight: 600,
              borderRadius: 8, border: "1.5px solid #FECACA",
              background: "#FFFFFF", color: "#DC2626", cursor: "pointer",
            }}
          >
            Supprimer
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "9px 14px", fontSize: 12, fontWeight: 600,
                borderRadius: 8, border: "1.5px solid #E5E7EB",
                background: "#FFFFFF", color: "#6B7280", cursor: "pointer",
              }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={save}
              style={{
                padding: "9px 14px", fontSize: 12, fontWeight: 700,
                borderRadius: 8, border: "1.5px solid #E5E7EB",
                background: "#FFFFFF", color: "#111827", cursor: "pointer",
              }}
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={download}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "9px 16px", fontSize: 12, fontWeight: 700,
                borderRadius: 8, border: "none",
                background: "linear-gradient(135deg, #E63946, #C0303C)", color: "#FFF", cursor: "pointer",
                boxShadow: "0 2px 8px rgba(230,57,70,0.35)",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Télécharger PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Aperçu visuel qui mime la mise en page du PDF généré (A4 portrait).
// Live update : le titre/header se met à jour à chaque saisie dans le formulaire.
function PdfMockPreview({
  supplier,
  invoiceDate,
  reference,
  amountStr,
  notes,
  imageBase64,
  imageMimeType,
}: {
  supplier: string;
  invoiceDate: string;
  reference: string;
  amountStr: string;
  notes: string;
  imageBase64: string;
  imageMimeType: string;
}) {
  const hasMeta = Boolean(supplier.trim() || invoiceDate.trim() || reference.trim() || amountStr.trim() || notes.trim());
  const title = supplier.trim() || "Facture";
  const formattedDate = (() => {
    if (!invoiceDate.trim()) return "";
    const m = invoiceDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : invoiceDate;
  })();
  const formattedAmount = (() => {
    if (!amountStr.trim()) return "";
    const cleaned = amountStr.trim().replace(/\s/g, "").replace(",", ".");
    const val = parseFloat(cleaned);
    if (isNaN(val)) return amountStr;
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(val);
  })();
  const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "75vh" }}>
      <div
        style={{
          fontSize: 10,
          color: "#9CA3AF",
          fontWeight: 600,
          letterSpacing: 0.3,
          textTransform: "uppercase",
        }}
      >
        Aperçu PDF (A4)
      </div>
      <div
        style={{
          flex: 1,
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: 6,
          padding: "24px 22px",
          fontFamily: "'Helvetica', Arial, sans-serif",
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          aspectRatio: "595 / 842",
          maxHeight: "72vh",
        }}
      >
        {hasMeta && (
          <div style={{ paddingBottom: 8, marginBottom: 12, borderBottom: "0.5px solid #000000" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#000000", marginBottom: 5 }}>
              {title}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 9, color: "#333333" }}>
              {formattedDate && (
                <span>
                  <span style={{ fontWeight: 700, color: "#000" }}>Date : </span>{formattedDate}
                </span>
              )}
              {reference.trim() && (
                <span>
                  <span style={{ fontWeight: 700, color: "#000" }}>N° : </span>{reference.trim()}
                </span>
              )}
              {formattedAmount && (
                <span>
                  <span style={{ fontWeight: 700, color: "#000" }}>Montant : </span>{formattedAmount}
                </span>
              )}
              {notes.trim() && <span>{notes.trim()}</span>}
            </div>
          </div>
        )}

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
          <img
            src={`data:${imageMimeType};base64,${imageBase64}`}
            alt="Facture"
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
        </div>

        <div style={{ fontSize: 7, color: "#9CA3AF", textAlign: "right", marginTop: 6 }}>
          Généré par ElecLabel le {today}
        </div>
      </div>
    </div>
  );
}

// Modale de vérification d'une facture juste après import (pas encore sauvegardée).
// Bouton Annuler → tout jeter. Bouton Enregistrer → ajoute au store + cloud.
function PendingInvoiceModal({
  pending,
  onConfirm,
  onDiscard,
}: {
  pending: PendingInvoice;
  onConfirm: (meta: InvoiceMetadata) => void | Promise<void>;
  onDiscard: () => void;
}) {
  const [supplier, setSupplier] = useState(pending.metadata.supplier ?? "");
  const [invoiceDate, setInvoiceDate] = useState(pending.metadata.invoiceDate ?? "");
  const [reference, setReference] = useState(pending.metadata.reference ?? "");
  const [amountStr, setAmountStr] = useState(
    pending.metadata.amountCents !== undefined
      ? (pending.metadata.amountCents / 100).toFixed(2).replace(".", ",")
      : "",
  );
  const [notes, setNotes] = useState(pending.metadata.notes ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onConfirm({
        supplier: supplier.trim() || undefined,
        invoiceDate: invoiceDate.trim() || undefined,
        reference: reference.trim() || undefined,
        amountCents: amountStr.trim() ? parseAmount(amountStr) : undefined,
        notes: notes.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    fontSize: 13,
    border: "1.5px solid #E5E7EB",
    borderRadius: 8,
    background: "#FFFFFF",
    outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "#4B5563",
    marginBottom: 4,
  };

  return (
    <div
      onClick={onDiscard}
      style={{
        position: "fixed", inset: 0, background: "rgba(17,24,39,0.55)", zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF", borderRadius: 14,
          width: "100%", maxWidth: 920, maxHeight: "90vh",
          display: "flex", flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
              Nouvelle facture — vérification
            </h3>
            <p style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
              Les champs sont pré-remplis par l'OCR. Corrige puis enregistre.
            </p>
          </div>
          <button
            type="button"
            onClick={onDiscard}
            aria-label="Annuler"
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: "1px solid #E5E7EB", background: "#FFF", color: "#6B7280",
              fontSize: 16, cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, padding: 20 }}>
          <PdfMockPreview
            supplier={supplier}
            invoiceDate={invoiceDate}
            reference={reference}
            amountStr={amountStr}
            notes={notes}
            imageBase64={pending.imageBase64}
            imageMimeType={pending.imageMimeType}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle}>Fournisseur</label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Ex: Schneider Electric"
                style={fieldStyle}
                autoFocus
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>N° facture</label>
                <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="FA-2026-001" style={fieldStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Montant TTC (€)</label>
              <input type="text" inputMode="decimal" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} placeholder="142,50" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Chantier, ref interne…"
                style={{ ...fieldStyle, resize: "vertical", fontFamily: "inherit" }}
              />
            </div>
          </div>
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid #E5E7EB", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            style={{
              padding: "10px 18px", fontSize: 13, fontWeight: 600,
              borderRadius: 9, border: "1.5px solid #E5E7EB",
              background: "#FFFFFF", color: "#4B5563",
              cursor: saving ? "wait" : "pointer",
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            style={{
              padding: "10px 20px", fontSize: 13, fontWeight: 700,
              borderRadius: 9, border: "none",
              background: saving ? "#9CA3AF" : "linear-gradient(135deg, #E63946, #C0303C)",
              color: "#FFFFFF",
              cursor: saving ? "wait" : "pointer",
              boxShadow: saving ? "none" : "0 4px 14px rgba(230,57,70,0.35)",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {saving ? (
              <>
                <span
                  style={{
                    width: 14, height: 14, borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#FFF",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                Enregistrement…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Enregistrer la facture
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        textAlign: "center", padding: "50px 20px",
        background: "#FFF", borderRadius: 14, border: "1px dashed #E5E7EB",
      }}
    >
      <div style={{ fontSize: 44, opacity: 0.4, marginBottom: 14 }}>🧾</div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
        Aucune facture
      </h3>
      <p style={{ fontSize: 12, color: "#6B7280" }}>
        Importez vos photos de factures, l'OCR remplit fournisseur/montant/date automatiquement.
      </p>
    </div>
  );
}

function TabButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "10px 16px",
        background: "transparent", border: "none",
        borderBottom: `2px solid ${active ? "#E63946" : "transparent"}`,
        color: active ? "#111827" : "#6B7280",
        fontSize: 13, fontWeight: active ? 700 : 500,
        cursor: "pointer", transition: "all 0.15s ease",
        marginBottom: -1,
      }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      {label}
    </button>
  );
}

// ─────────────────────── Utils ───────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return reject(new Error("FileReader failed"));
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
