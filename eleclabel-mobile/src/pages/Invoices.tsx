// Page factures mobile — capture caméra/galerie, OCR, listing par mois, export ZIP partagé natif.
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { useInvoiceStore } from "../store/invoiceStore";
import { processInvoiceImage, createInvoiceThumbnail } from "../services/imageInvoice";
import { smartExtractInvoice } from "../services/aiInvoice";
import { generateInvoicePdfBlob, defaultInvoiceFilename } from "../services/pdfInvoice";
import { generateInvoicesZip, defaultZipFilenameForMonth } from "../services/zipExport";
import { isNative } from "../services/native";
import { savePdfAndShare } from "../services/pdfMobile";
import { type Invoice, type InvoiceMetadata, formatAmount, parseAmount, monthKey, monthLabel } from "../types/invoice";
import MobileHeader from "../components/MobileHeader";
import BottomNav from "../components/BottomNav";
import DocumentScanner from "../components/DocumentScanner";

// Facture en cours de vérification, pas encore sauvegardée.
// Tant qu'elle est dans cet état, l'utilisateur peut Valider ou Annuler.
interface PendingInvoice {
  imageBase64: string;
  imageMimeType: string;
  thumbnail?: string;
  ocrRawText?: string;
  metadata: InvoiceMetadata;
}

export default function Invoices() {
  const { invoices, loading, load, add, updateMeta, remove, loadPhotoIfMissing } = useInvoiceStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState<{ step: string; progress: number } | null>(null);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [pending, setPending] = useState<PendingInvoice | null>(null);
  const [exportingMonth, setExportingMonth] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, Invoice[]>();
    for (const inv of invoices) {
      const key = monthKey(inv);
      const arr = map.get(key);
      if (arr) arr.push(inv);
      else map.set(key, [inv]);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (a > b ? -1 : 1))
      .map(([key, items]) => ({
        key,
        label: monthLabel(key),
        items: items.sort((a, b) => b.createdAt - a.createdAt),
        totalCents: items.reduce((s, i) => s + (i.amountCents ?? 0), 0),
      }));
  }, [invoices]);

  // Pipeline : image → contraste → thumbnail → OCR → pose en PENDING pour vérification.
  // Rien n'est sauvegardé tant que l'utilisateur ne valide pas le formulaire qui s'ouvre.
  const handleSingleImage = async (base64Raw: string, mime: string) => {
    setError(null);
    setSuccess(null);
    setProcessing({ step: "Amélioration de l'image…", progress: 20 });
    try {
      const processed = await processInvoiceImage(base64Raw, mime, 3000);

      setProcessing({ step: "Miniature…", progress: 40 });
      const thumbnail = await createInvoiceThumbnail(processed.base64, processed.mimeType, 300);

      setProcessing({ step: "Analyse IA de la facture…", progress: 65 });
      // IA (GPT-4o Vision) d'abord, repli Tesseract si indisponible — voir aiInvoice.ts
      const extraction = await smartExtractInvoice(processed.base64, processed.mimeType);
      const metadata = extraction.metadata;
      const ocrText = extraction.rawText ?? "";

      setProcessing(null);
      // Ouvre le formulaire de vérification — rien n'est sauvegardé pour l'instant
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

  const handleNativeCapture = async (source: CameraSource) => {
    setError(null);
    try {
      const result = await Camera.getPhoto({
        source,
        resultType: CameraResultType.Base64,
        quality: 92,
        allowEditing: false,
        correctOrientation: true,
        width: 4096,
      });
      if (!result.base64String) return;
      const mime = result.format ? `image/${result.format}` : "image/jpeg";
      await handleSingleImage(result.base64String, mime);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/cancel/i.test(msg) || /denied/i.test(msg)) return;
      setError(`Erreur caméra : ${msg}`);
    }
  };

  const handleWebFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    for (const file of Array.from(fileList)) {
      const base64 = await fileToBase64(file);
      await handleSingleImage(base64, file.type || "image/jpeg");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleExportMonth = async (month: { key: string; items: Invoice[] }) => {
    setExportingMonth(month.key);
    setExportProgress({ current: 0, total: month.items.length, label: "Préparation…" });
    setError(null);
    try {
      // Charge les photos HD manquantes (factures synchro depuis le cloud) avant
      // de générer les PDF — sinon le ZIP contient des factures sans image.
      for (let i = 0; i < month.items.length; i++) {
        const inv = month.items[i];
        if (!inv.imageBase64 || inv.imageBase64.length === 0) {
          setExportProgress({ current: i, total: month.items.length, label: "Chargement des photos…" });
          await loadPhotoIfMissing(inv.id);
        }
      }
      // Relit les factures hydratées depuis le store (imageBase64 désormais rempli)
      const state = useInvoiceStore.getState().invoices;
      const items = month.items.map((inv) => state.find((i) => i.id === inv.id) ?? inv);

      const blob = await generateInvoicesZip(items, (current, total, label) => {
        setExportProgress({ current, total, label });
      });
      const filename = defaultZipFilenameForMonth(month.key);
      await saveAndShareZip(blob, filename);
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
      if (!invoice.imageBase64 || invoice.imageBase64.length === 0) {
        await loadPhotoIfMissing(invoice.id);
      }
      const refreshed = useInvoiceStore.getState().invoices.find((i) => i.id === invoice.id) ?? invoice;
      const blob = await generateInvoicePdfBlob(refreshed);
      await savePdfAndShare(blob, defaultInvoiceFilename(refreshed));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'export.");
    }
  };

  const handleEdit = async (invoice: Invoice) => {
    if (!invoice.imageBase64 || invoice.imageBase64.length === 0) {
      await loadPhotoIfMissing(invoice.id);
    }
    const refreshed = useInvoiceStore.getState().invoices.find((i) => i.id === invoice.id) ?? invoice;
    setEditing(refreshed);
  };

  const native = isNative();

  // Scanner actif → on affiche UNIQUEMENT la caméra (fond transparent pour la voir)
  if (scanning) {
    return (
      <DocumentScanner
        onCapture={(base64, mime) => {
          setScanning(false);
          handleSingleImage(base64, mime);
        }}
        onCancel={() => setScanning(false)}
      />
    );
  }

  return (
    <div style={{ height: "100vh", maxHeight: "100vh", display: "flex", flexDirection: "column", background: "#F7F8FC" }}>
      <MobileHeader title="Factures" subtitle={`${invoices.length} facture${invoices.length > 1 ? "s" : ""} archivée${invoices.length > 1 ? "s" : ""}`} />

      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          padding: "14px 14px 100px",
        }}
      >
        {/* Boutons capture */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => {
              if (native) setScanning(true);
              else fileInputRef.current?.click();
            }}
            disabled={Boolean(processing)}
            style={{
              padding: "16px",
              borderRadius: 14,
              border: "none",
              background: processing
                ? "#9CA3AF"
                : "linear-gradient(135deg, #E63946, #C0303C)",
              color: "#FFFFFF",
              fontSize: 15,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              minHeight: 56,
              boxShadow: processing ? "none" : "0 4px 14px rgba(230,57,70,0.35)",
              cursor: processing ? "wait" : "pointer",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Photographier une facture
          </button>
          <button
            type="button"
            onClick={() => {
              if (native) handleNativeCapture(CameraSource.Photos);
              else fileInputRef.current?.click();
            }}
            disabled={Boolean(processing)}
            style={{
              padding: "13px",
              borderRadius: 12,
              border: "1.5px solid #E5E7EB",
              background: "#FFFFFF",
              color: "#111827",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              minHeight: 46,
              cursor: processing ? "wait" : "pointer",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            Importer depuis la galerie
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={(e) => handleWebFiles(e.target.files)}
            style={{ display: "none" }}
          />
        </div>

        {processing && (
          <div
            style={{
              padding: "12px 14px",
              background: "#EEF2FF",
              border: "1px solid #C7D2FE",
              borderRadius: 10,
              marginBottom: 14,
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
              padding: "10px 12px",
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: 10,
              marginBottom: 14,
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
              marginBottom: 14,
              color: "#065F46",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {success}
            </span>
            <button
              type="button"
              onClick={() => setSuccess(null)}
              style={{ border: "none", background: "transparent", color: "#065F46", fontSize: 18, padding: 0, width: 24 }}
            >
              ×
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#9CA3AF", fontSize: 13 }}>
            Chargement…
          </div>
        ) : invoices.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
      </main>

      {pending && (
        <PendingInvoiceSheet
          pending={pending}
          onConfirm={handleConfirmPending}
          onDiscard={handleDiscardPending}
        />
      )}

      {editing && (
        <InvoiceEditSheet
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
              await savePdfAndShare(blob, filename);
              setSuccess(`✓ PDF généré : ${filename}`);
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

      <BottomNav />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─────────────────────── Sub-components ───────────────────────

function MonthSection({
  month,
  exporting,
  exportProgress,
  onExport,
  onEdit,
  onExportSingle,
  onDelete,
}: {
  month: { key: string; label: string; items: Invoice[]; totalCents: number };
  exporting: boolean;
  exportProgress: { current: number; total: number; label: string } | null;
  onExport: () => void;
  onEdit: (invoice: Invoice) => void;
  onExportSingle: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
}) {
  return (
    <section
      style={{
        background: "#FFFFFF",
        borderRadius: 12,
        border: "1px solid #E5E7EB",
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
            {month.label}
          </h2>
          <p style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
            {month.items.length} facture{month.items.length > 1 ? "s" : ""}
            {month.totalCents > 0 && ` · ${formatAmount(month.totalCents)}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 8,
            border: "none",
            background: exporting ? "#9CA3AF" : "#111827",
            color: "#FFFFFF",
            cursor: exporting ? "wait" : "pointer",
          }}
        >
          {exporting ? (
            <>
              <span
                style={{
                  width: 12, height: 12, borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#FFFFFF",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              {exportProgress ? `${exportProgress.current}/${exportProgress.total}` : "…"}
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Exporter
            </>
          )}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
      }}
    >
      <button
        type="button"
        onClick={onEdit}
        style={{
          width: 80, height: 80, flexShrink: 0,
          background: "#F3F4F6",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 0, border: "none", cursor: "pointer",
          overflow: "hidden", position: "relative",
        }}
      >
        {invoice.thumbnail ? (
          <img src={`data:image/jpeg;base64,${invoice.thumbnail}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 26, opacity: 0.4 }}>🧾</span>
        )}
        {needsReview && (
          <span
            style={{
              position: "absolute", top: 3, right: 3,
              padding: "1px 4px", borderRadius: 3,
              background: "#FBBF24", color: "#78350F",
              fontSize: 8, fontWeight: 700,
            }}
          >
            !
          </span>
        )}
      </button>
      <div style={{ flex: 1, padding: "8px 10px", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
        <div
          style={{
            fontSize: 13, fontWeight: 700, color: "#111827",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
          onClick={onEdit}
        >
          {invoice.supplier?.trim() || "(fournisseur ?)"}
        </div>
        <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
          {invoice.invoiceDate ?? new Date(invoice.createdAt).toLocaleDateString("fr-FR")}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginTop: 2 }}>
          {invoice.amountCents !== undefined ? formatAmount(invoice.amountCents) : "—"}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", borderLeft: "1px solid #E5E7EB" }}>
        <button
          type="button"
          onClick={onExport}
          aria-label="Télécharger le PDF"
          title="Télécharger le PDF"
          style={{
            flex: 1, padding: "0 14px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            fontSize: 11, fontWeight: 700,
            border: "none",
            background: "linear-gradient(135deg, #E63946, #C0303C)",
            color: "#FFF",
            minWidth: 64,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          PDF
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Supprimer"
          style={{
            padding: "8px 12px", fontSize: 14,
            border: "none", borderTop: "1px solid #E5E7EB",
            background: "transparent", color: "#4B5563",
          }}
        >
          🗑
        </button>
      </div>
    </div>
  );
}

interface EditSheetMeta {
  invoiceDate?: string;
  supplier?: string;
  reference?: string;
  amountCents?: number;
  notes?: string;
}

interface EditSheetProps {
  invoice: Invoice;
  onSave: (meta: EditSheetMeta) => void;
  onDownload: (meta: EditSheetMeta) => void;
  onClose: () => void;
  onDelete: () => void;
}

function InvoiceEditSheet({ invoice, onSave, onDownload, onClose, onDelete }: EditSheetProps) {
  const [supplier, setSupplier] = useState(invoice.supplier ?? "");
  const [invoiceDate, setInvoiceDate] = useState(invoice.invoiceDate ?? "");
  const [reference, setReference] = useState(invoice.reference ?? "");
  const [amountStr, setAmountStr] = useState(
    invoice.amountCents !== undefined ? (invoice.amountCents / 100).toFixed(2).replace(".", ",") : "",
  );
  const [notes, setNotes] = useState(invoice.notes ?? "");

  const collectMeta = (): EditSheetMeta => ({
    supplier: supplier.trim() || undefined,
    invoiceDate: invoiceDate.trim() || undefined,
    reference: reference.trim() || undefined,
    amountCents: amountStr.trim() ? parseAmount(amountStr) : undefined,
    notes: notes.trim() || undefined,
  });
  const save = () => onSave(collectMeta());
  const download = () => onDownload(collectMeta());

  const fieldStyle: React.CSSProperties = {
    width: "100%", padding: "11px 12px", fontSize: 14,
    border: "1.5px solid #E5E7EB", borderRadius: 9,
    background: "#FFFFFF", outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 600,
    color: "#4B5563", marginBottom: 4,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(17,24,39,0.6)", zIndex: 100,
        display: "flex", alignItems: "stretch",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1, background: "#FFFFFF",
          display: "flex", flexDirection: "column",
          paddingTop: "var(--safe-top)",
          paddingBottom: "var(--safe-bottom)",
        }}
      >
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            type="button"
            onClick={onClose}
            style={{ width: 40, height: 40, border: "none", background: "transparent", color: "#111827", padding: 0 }}
            aria-label="Fermer"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Vérifier la facture</h3>
          <button
            type="button"
            onClick={save}
            style={{
              padding: "8px 16px", fontSize: 13, fontWeight: 700,
              borderRadius: 8, border: "1.5px solid #111827",
              background: "#FFFFFF", color: "#111827",
            }}
          >
            Enregistrer
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 20px" }}>
          {/* Image preview */}
          <div
            style={{
              background: "#F3F4F6",
              borderRadius: 10,
              overflow: "hidden",
              marginBottom: 14,
              maxHeight: 250,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={`data:${invoice.imageMimeType};base64,${invoice.imageBase64}`}
              alt="Facture"
              style={{ maxWidth: "100%", maxHeight: 250, objectFit: "contain" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle}>Fournisseur</label>
              <input type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Ex: Schneider" style={fieldStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>N°</label>
                <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="FA-001" style={fieldStyle} />
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
                rows={2}
                placeholder="Mention libre"
                style={{ ...fieldStyle, resize: "vertical", fontFamily: "inherit" }}
              />
            </div>
            <button
              type="button"
              onClick={download}
              style={{
                marginTop: 12, padding: "14px",
                fontSize: 14, fontWeight: 700,
                borderRadius: 10, border: "none",
                background: "linear-gradient(135deg, #E63946, #C0303C)", color: "#FFF",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 4px 12px rgba(230,57,70,0.35)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Télécharger / Partager le PDF
            </button>
            <button
              type="button"
              onClick={onDelete}
              style={{
                marginTop: 8, padding: "10px",
                fontSize: 13, fontWeight: 600,
                borderRadius: 8, border: "1.5px solid #FECACA",
                background: "#FFFFFF", color: "#DC2626",
              }}
            >
              Supprimer cette facture
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Form de vérification AVANT enregistrement ──
// Affichée immédiatement après la prise de photo + OCR. L'utilisateur valide
// pour enregistrer dans le store + cloud, ou annule pour tout jeter.
function PendingInvoiceSheet({
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
    width: "100%", padding: "11px 12px", fontSize: 14,
    border: "1.5px solid #E5E7EB", borderRadius: 9,
    background: "#FFFFFF", outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 600,
    color: "#4B5563", marginBottom: 4,
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(17,24,39,0.6)", zIndex: 100,
        display: "flex", alignItems: "stretch",
      }}
    >
      <div
        style={{
          flex: 1, background: "#FFFFFF",
          display: "flex", flexDirection: "column",
          paddingTop: "var(--safe-top)",
          paddingBottom: "var(--safe-bottom)",
        }}
      >
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={onDiscard}
            style={{ width: 40, height: 40, border: "none", background: "transparent", color: "#111827", padding: 0 }}
            aria-label="Annuler — la facture ne sera pas enregistrée"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Nouvelle facture</h3>
            <p style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}>
              Vérifie les infos puis valide
            </p>
          </div>
          <div style={{ width: 40 }} />
        </div>

        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "14px 16px 20px" }}>
          {/* Image preview */}
          <div
            style={{
              background: "#F3F4F6",
              borderRadius: 10,
              overflow: "hidden",
              marginBottom: 14,
              maxHeight: 220,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={`data:${pending.imageMimeType};base64,${pending.imageBase64}`}
              alt="Facture"
              style={{ maxWidth: "100%", maxHeight: 220, objectFit: "contain" }}
            />
          </div>

          <div
            style={{
              padding: "8px 10px",
              background: "#EEF2FF",
              border: "1px solid #C7D2FE",
              borderRadius: 8,
              fontSize: 11,
              color: "#3730A3",
              marginBottom: 14,
              lineHeight: 1.4,
            }}
          >
            ℹ Les champs ci-dessous ont été pré-remplis par l'OCR. Corrige si nécessaire avant d'enregistrer.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={labelStyle}>Fournisseur</label>
              <input
                type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)}
                placeholder="Ex: Schneider Electric" style={fieldStyle} autoFocus
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>N°</label>
                <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="FA-001" style={fieldStyle} />
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
                rows={2}
                placeholder="Mention libre"
                style={{ ...fieldStyle, resize: "vertical", fontFamily: "inherit" }}
              />
            </div>
          </div>
        </div>

        {/* Boutons d'action en bas, toujours visibles */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid #E5E7EB",
            background: "#FFFFFF",
            display: "flex",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            style={{
              flex: 1,
              padding: "13px",
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 11,
              border: "1.5px solid #E5E7EB",
              background: "#FFFFFF",
              color: "#4B5563",
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
              flex: 2,
              padding: "13px",
              fontSize: 14,
              fontWeight: 700,
              borderRadius: 11,
              border: "none",
              background: saving ? "#9CA3AF" : "linear-gradient(135deg, #E63946, #C0303C)",
              color: "#FFFFFF",
              cursor: saving ? "wait" : "pointer",
              boxShadow: saving ? "none" : "0 4px 14px rgba(230,57,70,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
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
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
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
        textAlign: "center", padding: "40px 20px",
        background: "#FFF", borderRadius: 12, border: "1px dashed #E5E7EB",
      }}
    >
      <div style={{ fontSize: 36, opacity: 0.4, marginBottom: 12 }}>🧾</div>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
        Aucune facture
      </h3>
      <p style={{ fontSize: 12, color: "#6B7280" }}>
        Prends une facture en photo, l'OCR remplit fournisseur/montant/date automatiquement.
      </p>
    </div>
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

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") return reject(new Error("FileReader failed"));
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.readAsDataURL(blob);
  });
}

// Sauvegarde le ZIP dans Documents/ puis ouvre le partage natif (web : download direct)
async function saveAndShareZip(blob: Blob, filename: string): Promise<void> {
  if (!isNative()) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const base64 = await blobToBase64(blob);
  const writeResult = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Documents,
  });
  try {
    await Share.share({
      title: filename,
      text: "Archive ZIP des factures du mois — générée par ElecLabel.",
      url: writeResult.uri,
      dialogTitle: "Partager les factures",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/cancel/i.test(msg)) console.warn("Share failed:", msg);
  }
}
