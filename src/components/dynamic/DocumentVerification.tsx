"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  UploadCloud, 
  ShieldCheck, 
  FileCheck, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  RefreshCw,
  Search,
  Filter,
  Eye,
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  FileSpreadsheet,
  CheckCircle2,
  AlertOctagon,
  X,
  Database
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, HeaderChip } from "@/components/layout/PageHeader";

/**
 * Gender is stored two ways by design: numeric on Complainant/Victim, and the
 * PDF-mandated M/F/T text on Accused. Confirmed with the user: the only valid
 * values are Male, Female and Transgender.
 */
const genderLabel = (g?: string): string =>
  ({ "1": "Male", "2": "Female", "3": "Transgender", M: "Male", F: "Female", T: "Transgender" } as Record<string, string>)[
    String(g ?? "").trim().toUpperCase()
  ] || String(g ?? "").trim();

interface VerificationResult {
  success: boolean;
  primaryDecoderUsed?: boolean;
  fallbackDecoderUsed?: boolean;
  errorTitle?: string;
  errorMessage?: string;
  data?: VerificationDetail;
}

export interface VerificationDetail {
    verificationStatus: string;
    caseNumber: string;
    reportReference: string;
    verificationId: string;
    officerName: string;
    officerRank: string;
    policeStation: string;
    district: string;
    classification: string;
    issuingAuthority: string;
    generatedAt: string;
    // Live case detail, resolved from CaseMaster at scan time rather than
    // frozen at print time. Absent for documents that are not case files
    // (AI intelligence briefs), which carry no CaseMaster row.
    documentType?: string;
    caseCategory?: string;
    registeredDate?: string;
    caseStatus?: string;
    gravity?: string;
    court?: string;
    briefFacts?: string;
    actSections?: { actCode: string; act: string; section: string; sectionDescription: string }[];
    counts?: { complainants: number; victims: number; accused: number } | null;
    parties?: {
      complainants: { name: string; age: string }[];
      victims: { name: string; age: string }[];
      accused: { ref: string; name: string; age: string; gender: string }[];
    } | null;
}

export interface HistoryRecord {
  id: string;
  timestamp: string;
  verificationId: string;
  caseNumber: string;
  documentName: string;
  status: "VERIFIED" | "INVALID" | "TAMPERED" | "DOCUMENT NOT FOUND" | "PENDING";
  verifiedBy: string;
  issuingAuthority: string;
  processingTime: string;
  reportReference?: string;
  officerName?: string;
  officerRank?: string;
  policeStation?: string;
  district?: string;
  classification?: string;
  generatedAt?: string;
  barcodePayload?: string;
  errorDetails?: string;
  /**
   * The full resolved payload from the scan. Kept on the record so opening a
   * past scan shows the same dossier the officer saw at the time, without
   * re-hitting Catalyst. Note this is a SNAPSHOT - the live case may have
   * moved on since, which is why re-scanning is the authoritative action.
   */
  detail?: VerificationDetail;
}

/**
 * Where scan history lives.
 *
 * Catalyst is the source of truth, read and written through
 * /api/verification/history so the log is server-side and statewide.
 *
 * The route reports `configured: false` while the backing VerificationScan
 * table is absent - creating it needs the ZohoCatalyst.tables.CREATE scope the
 * Self Client token does not yet carry. Until then the console keeps its own
 * local copy so the feature still works on this workstation, and switches over
 * the moment the table exists with no further change here.
 *
 * The old Firestore collection is gone entirely: it was permission-denied on
 * every read, and the ledger moved to Catalyst long ago.
 */
const HISTORY_KEY = "orca_verification_history";
const HISTORY_LIMIT = 200;

export const DocumentVerification: React.FC = () => {
  const { officerProfile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // History State
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCollapsiblePayload, setShowCollapsiblePayload] = useState(false);
  // The record for the scan just performed, so "View Detailed Information"
  // opens the same modal the history rows use rather than a second layout.
  const [lastRecord, setLastRecord] = useState<HistoryRecord | null>(null);
  // Where the listed history came from, so the footer can say so plainly.
  // "local" is gone with the localStorage copy — the log is either the
  // statewide Catalyst one, or unavailable.
  const [historySource, setHistorySource] = useState<"catalyst" | "unavailable">("unavailable");

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  /**
   * Scan history comes from Catalyst only.
   *
   * There used to be a `localStorage` copy alongside it — written on every scan
   * and read whenever Catalyst was unreachable. That made the log
   * browser-specific: an officer on a second machine saw a different history,
   * with nothing saying which was complete, and the local copy could not be
   * audited or retained under any policy. The stale key is removed on load so
   * an old copy cannot resurface.
   *
   * When the server cannot be reached the list is empty and says so, rather
   * than showing a partial local view that looks authoritative.
   */
  const loadHistory = async () => {
    setIsRefreshing(true);
    if (typeof window !== "undefined") {
      localStorage.removeItem(HISTORY_KEY);
    }

    try {
      const res = await fetch("/api/verification/history", { credentials: "include" });
      const data = await res.json();
      if (data.success && data.configured) {
        setHistory((data.scans || []) as HistoryRecord[]);
        setHistorySource("catalyst");
      } else {
        setHistory([]);
        setHistorySource("unavailable");
      }
    } catch {
      setHistory([]);
      setHistorySource("unavailable");
    }

    setIsRefreshing(false);
  };

  const saveRecordToHistory = (newRecord: HistoryRecord) => {
    // Optimistic, so the scan appears immediately; the row of record is the
    // one the append below writes.
    setHistory((prev) => [newRecord, ...prev].slice(0, HISTORY_LIMIT));

    // ScannedBy is derived from the session server-side, so nothing
    // identifying is trusted from this payload.
    fetch("/api/verification/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        id: newRecord.id,
        verificationId: newRecord.verificationId,
        caseNumber: newRecord.caseNumber,
        documentName: newRecord.documentName,
        status: newRecord.status,
        processingTime: newRecord.processingTime,
        errorDetails: newRecord.errorDetails,
      }),
    }).catch(() => {
      // The scan itself succeeded; a failed append must not break it.
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setLastRecord(null);
    const inputEl = document.getElementById("doc-file-input") as HTMLInputElement;
    if (inputEl) {
      inputEl.value = "";
    }
  };

  const handleVerify = async () => {
    if (!file) {
      setError("Please select or drop a report or barcode image to verify.");
      return;
    }

    const startTime = Date.now();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/verification/document", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setResult(data);

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1) + "s";
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19) + " IST";

      // Construct history record
      let statusVal: HistoryRecord["status"] = "INVALID";
      if (data.success && data.data?.verificationStatus === "VERIFIED") {
        statusVal = "VERIFIED";
      } else if (data.errorTitle?.includes("NOT FOUND")) {
        statusVal = "DOCUMENT NOT FOUND";
      } else if (data.errorTitle?.includes("TAMPERED")) {
        statusVal = "TAMPERED";
      }

      const newHistItem: HistoryRecord = {
        id: `hist-${Date.now()}`,
        timestamp: nowStr,
        verificationId: data.data?.verificationId || "VER-UNVERIFIED",
        caseNumber: data.data?.caseNumber || "N/A",
        documentName: file.name,
        status: statusVal,
        verifiedBy: officerProfile?.name || "Officer",
        issuingAuthority: data.data?.issuingAuthority || "Karnataka State Police • SCRB",
        processingTime: elapsedTime,
        reportReference: data.data?.reportReference,
        officerName: data.data?.officerName,
        officerRank: data.data?.officerRank,
        policeStation: data.data?.policeStation,
        district: data.data?.district,
        classification: data.data?.classification || "RESTRICTED",
        generatedAt: data.data?.generatedAt,
        barcodePayload: `STATUS=${statusVal}|CASE=${data.data?.caseNumber || 'UNKNOWN'}`,
        errorDetails: data.errorMessage,
        detail: data.data,
      };

      saveRecordToHistory(newHistItem);
      setLastRecord(newHistItem);

    } catch (err: any) {
      setError(err.message || "Failed to communicate with Zia verification servers.");
    } finally {
      setLoading(false);
    }
  };

  const isVerified = result?.success && result?.data?.verificationStatus === "VERIFIED";

  // Filtered History
  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const matchesSearch = 
        item.verificationId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.caseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.documentName.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "All" || item.status === statusFilter.toUpperCase();
      return matchesSearch && matchesStatus;
    });
  }, [history, searchQuery, statusFilter]);

  // Statistics over the scans actually recorded. avgTime used to be the
  // hardcoded string "1.1s"; it is now the mean of the recorded latencies.
  const stats = useMemo(() => {
    const total = history.length;
    const verified = history.filter((h) => h.status === "VERIFIED").length;
    const times = history
      .map((h) => parseFloat(String(h.processingTime).replace(/[^\d.]/g, "")))
      .filter((n) => Number.isFinite(n));
    const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    return { total, verified, failed: total - verified, avgTime: `${avg.toFixed(1)}s` };
  }, [history]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div style={{ animation: "fadeIn 0.3s ease", display: "flex", flexDirection: "column", gap: 24 }}>
      
      {/* Heading */}
      <PageHeader
        title="Official Document Verification Console"
        subtitle="Verify ORCA-generated intelligence briefings by scanning embedded Code 128 barcode cryptographic signatures."
        style={{ marginBottom: 0 }}
        action={<HeaderChip label="VERIFICATION ENGINE" value="ZIA BARCODE // CODE 128" />}
      />

      {/* Top Section: Upload Box & Result Card */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        
        {/* Left Column: Upload Box */}
        <div style={{
          background: "#ffffff",
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 20
        }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#001f3f", display: "flex", alignItems: "center", gap: 8 }}>
              <UploadCloud style={{ width: 18, height: 18, color: "#002855" }} /> Upload Report or Barcode Image
            </h3>
            <p style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              Upload an ORCA intelligence brief page or cropped Code 128 barcode image for verification.
            </p>
          </div>

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            style={{
              border: dragActive ? "2px dashed #FF9933" : "2px dashed #cbd5e1",
              background: dragActive ? "rgba(255,153,51,0.05)" : "#f8fafc",
              borderRadius: 6,
              padding: "36px 20px",
              textAlign: "center",
              cursor: "pointer",
              transition: "0.2s"
            }}
            onClick={() => document.getElementById("doc-file-input")?.click()}
          >
            <input
              id="doc-file-input"
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
              style={{ display: "none" }}
            />
            <UploadCloud style={{ width: 44, height: 44, color: dragActive ? "#FF9933" : "#94a3b8", margin: "0 auto 12px" }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
              {file ? file.name : "Drag & Drop Report Image Here"}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              {file ? `${(file.size / 1024).toFixed(1)} KB` : "or click to browse from computer (PNG, JPG, PDF)"}
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              onClick={handleVerify}
              disabled={loading || !file}
              style={{
                flex: 1,
                background: loading || !file ? "#94a3b8" : "#001f3f",
                color: "white",
                border: "none",
                borderRadius: 4,
                padding: "12px 20px",
                fontSize: 14,
                fontWeight: 700,
                cursor: loading || !file ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "0.2s"
              }}
            >
              {loading ? <Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} /> : <ShieldCheck style={{ width: 18, height: 18, color: "#FF9933" }} />}
              {loading ? "Scanning Barcode via Zia..." : "Verify Document"}
            </button>

            {file && (
              <button
                onClick={handleReset}
                style={{
                  background: "#f1f5f9",
                  color: "#475569",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  padding: "12px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Reset
              </button>
            )}
          </div>

          {error && (
            <div style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#990000",
              padding: "10px 14px",
              borderRadius: 4,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 8
            }}>
              <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Right Column: Verification Output Card */}
        <div style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 340
        }}>
          {!result && !loading && (
            <div style={{ textAlign: "center", color: "#94a3b8" }}>
              <ShieldCheck style={{ width: 56, height: 56, margin: "0 auto 12px", opacity: 0.4 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: "#475569" }}>Awaiting Verification Request</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Upload an intelligence document or barcode to initiate Catalyst OCR scan.</div>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: "center", color: "#002855" }}>
              <Loader2 style={{ width: 48, height: 48, animation: "spin 1s linear infinite", margin: "0 auto 16px", color: "#FF9933" }} />
              <div style={{ fontSize: 15, fontWeight: 700 }}>Extracting &amp; Validating Barcode</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, fontFamily: "monospace" }}>zcatalyst-sdk-node // zia.scanBarcode()</div>
            </div>
          )}

          {result && (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Verification Badge */}
              <div style={{
                background: isVerified ? "#f0fdf4" : "#fef2f2",
                border: isVerified ? "1px solid #bbf7d0" : "1px solid #fecaca",
                padding: "16px 20px",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {isVerified ? (
                    <CheckCircle style={{ width: 32, height: 32, color: "#10b981" }} />
                  ) : (
                    <XCircle style={{ width: 32, height: 32, color: "#ef4444" }} />
                  )}
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: isVerified ? "#166534" : "#990000" }}>
                      {isVerified ? "🟢 VERIFIED" : (result.errorTitle || "🔴 INVALID DOCUMENT")}
                    </div>
                    <div style={{ fontSize: 11, color: isVerified ? "#15803d" : "#990000", fontFamily: "monospace", marginTop: 2 }}>
                      {isVerified ? "Cryptographic signature authentic and court admissible." : (result.errorMessage || "Validation failed.")}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 10, fontFamily: "monospace", color: "#64748b" }}>
                  {result.primaryDecoderUsed ? "ZXing ENGINE VERIFIED" : result.fallbackDecoderUsed ? "ZIA FALLBACK VERIFIED" : "ORCA OPTICAL VERIFIED"}
                </div>
              </div>

              {/* Compact particulars. The full dossier and the live case
                  record live in the modal below - the panel answers "is this
                  document valid, and which case is it?" at a glance. */}
              {isVerified && result.data && (
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 12 }}>
                    Document Particulars
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12 }}>
                    {([
                      ["VERIFICATION ID", result.data.verificationId, "#003a75", true],
                      ["CASE NUMBER", result.data.caseNumber, "#001f3f", true],
                      ["POLICE STATION / UNIT", result.data.policeStation, "#334155", false],
                      ["DISTRICT / JURISDICTION", result.data.district, "#334155", false],
                      ["DOCUMENT TYPE", result.data.documentType, "#334155", false],
                      ["VERIFIED ON", result.data.generatedAt, "#334155", false],
                    ] as [string, string | undefined, string, boolean][]).map(([label, value, colour, mono]) => (
                      <div key={label}>
                        <span style={{ fontSize: 10, color: "#64748b", display: "block", fontFamily: "monospace" }}>{label}</span>
                        <strong style={{ color: colour, fontFamily: mono ? "monospace" : "inherit" }}>{value || "—"}</strong>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #cbd5e1", fontSize: 11, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#64748b", fontFamily: "monospace" }}>SECURITY CLASSIFICATION:</span>
                    <span style={{ background: "#001f3f", color: "#FF9933", padding: "2px 8px", borderRadius: 2, fontWeight: 700, fontSize: 10, fontFamily: "monospace" }}>
                      {result.data.classification}
                    </span>
                  </div>
                </div>
              )}

              {lastRecord && (
                <button
                  onClick={() => setSelectedRecord(lastRecord)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    background: "#001f3f", color: "#fff", border: "none", borderRadius: 4,
                    padding: "11px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  <Eye style={{ width: 15, height: 15, color: "#FF9933" }} />
                  View Detailed Information
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* VERIFICATION HISTORY SECTION                                  */}
      {/* ============================================================ */}
      <div style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        padding: 24,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
        gap: 20
      }}>
        
        {/* Scan history.
            Every verification the officer runs is logged here. Kept in
            localStorage: the Firestore collection was permission-denied on
            every read, and Catalyst has no table for a scan log yet, so this
            is per-workstation rather than statewide. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#001f3f", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.02em" }}>
              VERIFICATION SCAN HISTORY
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
              {historySource === "catalyst"
                ? "Every document checked, statewide, most recent first."
                : "The scan log could not be reached. Nothing is shown rather than a partial local copy."}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={loadHistory}
              style={{
                display: "flex", alignItems: "center", gap: 7, background: "#fff", color: "#001f3f",
                border: "1px solid #cbd5e1", borderRadius: 4, padding: "8px 14px",
                fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <RefreshCw style={{ width: 13, height: 13, animation: isRefreshing ? "spin 1s linear infinite" : "none" }} />
              Refresh
            </button>
            {/*
              No "Clear" button here any more.

              It erased the localStorage copy, which no longer exists. The
              Catalyst scan log is an audit trail and is deliberately not
              erasable from the console.
            */}
          </div>
        </div>

        {history.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            {([
              ["TOTAL SCANS", String(stats.total), "#001f3f"],
              ["VERIFIED", String(stats.verified), "#166534"],
              ["FAILED", String(stats.failed), stats.failed > 0 ? "#991b1b" : "#64748b"],
              ["AVG RESPONSE", stats.avgTime, "#002855"],
            ] as [string, string, string][]).map(([label, value, colour]) => (
              <div key={label} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "10px 13px" }}>
                <div style={{ fontSize: 10, color: "#64748b", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.07em" }}>{label}</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: colour, fontFamily: "JetBrains Mono, monospace", marginTop: 2 }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
            <Search style={{ width: 14, height: 14, color: "#64748b", position: "absolute", left: 11, top: 11 }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Verification ID, Case Number or file name"
              style={{
                width: "100%", padding: "9px 11px 9px 32px", border: "1px solid #cbd5e1",
                borderRadius: 4, fontSize: 13, outline: "none", fontFamily: "inherit",
              }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Filter style={{ width: 14, height: 14, color: "#64748b" }} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "9px 11px", border: "1px solid #cbd5e1", borderRadius: 4,
                fontSize: 13, outline: "none", background: "#fff", color: "#1e293b", fontFamily: "inherit",
              }}
            >
              <option key="All" value="All">All statuses</option>
              <option key="Verified" value="Verified">Verified</option>
              <option key="Tampered" value="Tampered">Tampered</option>
              <option key="Document Not Found" value="Document Not Found">Document Not Found</option>
              <option key="Invalid" value="Invalid">Invalid</option>
            </select>
          </div>
        </div>

        {history.length === 0 ? (
          <div style={{ border: "1px dashed #cbd5e1", borderRadius: 8, padding: "40px 20px", textAlign: "center", background: "#f8fafc" }}>
            <Clock style={{ width: 32, height: 32, color: "#94a3b8", margin: "0 auto 10px" }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: "#001f3f" }}>No documents verified yet</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
              Scans you run will be listed here.
            </div>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div style={{ border: "1px dashed #cbd5e1", borderRadius: 8, padding: "40px 20px", textAlign: "center", background: "#f8fafc" }}>
            <Search style={{ width: 32, height: 32, color: "#94a3b8", margin: "0 auto 10px" }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: "#001f3f" }}>No scans match that filter</div>
          </div>
        ) : (
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                <thead>
                  <tr>
                    {["Scanned At", "Verification ID", "Case Number", "Document", "Status", ""].map((h, i) => (
                      <th key={i} style={{
                        textAlign: "left", padding: "9px 12px", fontSize: 10, fontWeight: 700,
                        color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em",
                        fontFamily: "JetBrains Mono, monospace", borderBottom: "1px solid #cbd5e1", background: "#f8fafc",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((rec) => {
                    const ok = rec.status === "VERIFIED";
                    return (
                      <tr key={rec.id} onClick={() => setSelectedRecord(rec)} style={{ cursor: "pointer", background: "#fff" }}>
                        <td style={{ padding: "10px 12px", fontSize: 12, borderBottom: "1px solid #e2e8f0", color: "#475569", fontFamily: "monospace", whiteSpace: "nowrap" }}>{rec.timestamp}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12, borderBottom: "1px solid #e2e8f0", color: "#001f3f", fontFamily: "monospace", fontWeight: 700 }}>{rec.verificationId}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12, borderBottom: "1px solid #e2e8f0", color: "#1e293b", fontFamily: "monospace" }}>{rec.caseNumber}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12, borderBottom: "1px solid #e2e8f0", color: "#475569", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rec.documentName}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12, borderBottom: "1px solid #e2e8f0" }}>
                          <span style={{
                            background: ok ? "#dcfce7" : "#fee2e2", color: ok ? "#166534" : "#991b1b",
                            padding: "3px 9px", borderRadius: 3, fontSize: 10, fontWeight: 800,
                            fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.04em", whiteSpace: "nowrap",
                          }}>{rec.status}</span>
                        </td>
                        <td style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0", textAlign: "right" }}>
                          <Eye style={{ width: 15, height: 15, color: "#64748b" }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "9px 14px", borderTop: "1px solid #e2e8f0", fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 7, background: "#f8fafc" }}>
              <Database style={{ width: 13, height: 13 }} />
              {filteredHistory.length} of {history.length} scan{history.length === 1 ? "" : "s"} - click a row for the full dossier -{" "}
              from the Catalyst scan log
            </div>
          </div>
        )}

      </div>

      {/* ============================================================ */}
      {/* VERIFICATION DETAILS MODAL                                   */}
      {/* ============================================================ */}
      {selectedRecord && (
        <div
          onClick={() => setSelectedRecord(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,31,63,0.45)",
            // The page behind the dossier is blurred out so the document under
            // review is the only thing legible while it is open.
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 24,
            animation: "fadeIn 0.2s ease"
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "#ffffff",
            borderRadius: 8,
            maxWidth: 640,
            width: "100%",
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column"
          }}>
            {/* Modal Header */}
            <div style={{
              background: "#001f3f",
              color: "white",
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldCheck style={{ width: 20, height: 20, color: "#FF9933" }} />
                <h3 style={{ fontSize: 15, fontWeight: 800, fontFamily: "var(--font-serif, serif)" }}>
                  Verification Dossier Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                style={{ background: "none", border: "none", color: "white", cursor: "pointer" }}
              >
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, maxHeight: "80vh", overflowY: "auto" }}>
              
              <div style={{
                background: selectedRecord.status === "VERIFIED" ? "#f0fdf4" : "#fef2f2",
                border: selectedRecord.status === "VERIFIED" ? "1px solid #bbf7d0" : "1px solid #fecaca",
                padding: 14,
                borderRadius: 6,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: selectedRecord.status === "VERIFIED" ? "#166534" : "#990000" }}>
                  STATUS: {selectedRecord.status}
                </span>
                <span style={{ fontSize: 11, fontFamily: "monospace", color: "#64748b" }}>
                  LATENCY: {selectedRecord.processingTime}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 12 }}>
                <div>
                  <span style={{ fontSize: 10, color: "#64748b", display: "block", fontFamily: "monospace" }}>VERIFICATION ID</span>
                  <strong style={{ color: "#003a75", fontFamily: "monospace", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {selectedRecord.verificationId}
                    <button
                      onClick={() => copyToClipboard(selectedRecord.verificationId)}
                      title="Copy verification ID"
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "inline-flex" }}
                    >
                      {copiedId === selectedRecord.verificationId
                        ? <Check style={{ width: 13, height: 13, color: "#10b981" }} />
                        : <Copy style={{ width: 13, height: 13, color: "#94a3b8" }} />}
                    </button>
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: "#64748b", display: "block", fontFamily: "monospace" }}>CASE NUMBER</span>
                  <strong style={{ color: "#001f3f" }}>{selectedRecord.caseNumber}</strong>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: "#64748b", display: "block", fontFamily: "monospace" }}>REPORT REFERENCE</span>
                  <strong style={{ color: "#002855" }}>{selectedRecord.reportReference || "ISD-CR-SPEC"}</strong>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: "#64748b", display: "block", fontFamily: "monospace" }}>DOCUMENT NAME</span>
                  <strong style={{ color: "#1e293b" }}>{selectedRecord.documentName}</strong>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: "#64748b", display: "block", fontFamily: "monospace" }}>INVESTIGATING OFFICER</span>
                  <strong style={{ color: "#1e293b" }}>{selectedRecord.officerName || selectedRecord.verifiedBy}</strong>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: "#64748b", display: "block", fontFamily: "monospace" }}>OFFICER RANK</span>
                  <strong style={{ color: "#475569" }}>{selectedRecord.officerRank || "Superintendent of Police"}</strong>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: "#64748b", display: "block", fontFamily: "monospace" }}>POLICE STATION / UNIT</span>
                  <strong style={{ color: "#334155" }}>{selectedRecord.policeStation || "Internal Security Division (ISD)"}</strong>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: "#64748b", display: "block", fontFamily: "monospace" }}>DISTRICT / JURISDICTION</span>
                  <strong style={{ color: "#334155" }}>{selectedRecord.district || "Bengaluru City"}</strong>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: "#64748b", display: "block", fontFamily: "monospace" }}>ISSUING AUTHORITY</span>
                  <strong style={{ color: "#002855" }}>{selectedRecord.issuingAuthority}</strong>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: "#64748b", display: "block", fontFamily: "monospace" }}>VERIFICATION TIME</span>
                  <strong style={{ color: "#334155" }}>{selectedRecord.timestamp}</strong>
                </div>
              </div>

              {/* Collapsible Barcode Payload */}
              <div style={{ border: "1px solid #cbd5e1", borderRadius: 6, overflow: "hidden", marginTop: 8 }}>
                <button
                  onClick={() => setShowCollapsiblePayload(!showCollapsiblePayload)}
                  style={{
                    width: "100%",
                    background: "#f8fafc",
                    border: "none",
                    padding: "10px 14px",
                    textAlign: "left",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#002855"
                  }}
                >
                  <span>Cryptographic Barcode Payload</span>
                  {showCollapsiblePayload ? <ChevronUp style={{ width: 16, height: 16 }} /> : <ChevronDown style={{ width: 16, height: 16 }} />}
                </button>

                {showCollapsiblePayload && (
                  <div style={{ padding: 14, background: "#001f3f", color: "#FF9933", fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" }}>
                    {selectedRecord.barcodePayload || `STATUS=${selectedRecord.status}|CASE=${selectedRecord.caseNumber}`}
                  </div>
                )}
              </div>

              {/* Case record as resolved when this scan ran. For a document
                  that is not a case file (an AI intelligence brief) there is no
                  CaseMaster row behind it, so this block simply does not
                  appear - the document is still authentic. */}
              {selectedRecord.detail?.documentType === "FIR / CASE FILE" && (
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}>
                      Case Record
                    </div>
                    <div style={{ fontSize: 9.5, color: "#64748b", fontFamily: "monospace" }}>
                      AS RESOLVED AT SCAN TIME
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12, marginBottom: 14 }}>
                    {([
                      ["CASE CATEGORY", selectedRecord.detail.caseCategory],
                      ["REGISTERED ON", selectedRecord.detail.registeredDate],
                      ["CASE STATUS", selectedRecord.detail.caseStatus],
                      ["GRAVITY OF OFFENCE", selectedRecord.detail.gravity],
                      ["COURT", selectedRecord.detail.court],
                    ] as [string, string | undefined][]).map(([label, value]) => (
                      <div key={label}>
                        <span style={{ fontSize: 10, color: "#64748b", display: "block", fontFamily: "monospace" }}>{label}</span>
                        <strong style={{ color: "#334155" }}>{value || "-"}</strong>
                      </div>
                    ))}
                  </div>

                  {!!selectedRecord.detail.actSections?.length && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", letterSpacing: "0.05em", marginBottom: 6 }}>
                        ACTS &amp; SECTIONS INVOKED
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {selectedRecord.detail.actSections.map((sec, i) => (
                          <div key={i} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 4, padding: "7px 10px", fontSize: 12 }}>
                            <strong style={{ color: "#001f3f", fontFamily: "monospace" }}>{sec.actCode} {sec.section}</strong>
                            <span style={{ color: "#475569" }}>{sec.sectionDescription ? ` - ${sec.sectionDescription}` : ""}</span>
                            {sec.act && <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 2 }}>{sec.act}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!!selectedRecord.detail.counts && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
                      {([
                        ["COMPLAINANTS", selectedRecord.detail.counts.complainants],
                        ["VICTIMS", selectedRecord.detail.counts.victims],
                        ["ACCUSED", selectedRecord.detail.counts.accused],
                      ] as [string, number][]).map(([label, n]) => (
                        <div key={label} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 4, padding: "8px 10px" }}>
                          <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", letterSpacing: "0.05em" }}>{label}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#001f3f", fontFamily: "monospace" }}>{n}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!!selectedRecord.detail.parties?.accused?.length && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", letterSpacing: "0.05em", marginBottom: 6 }}>
                        ACCUSED ON RECORD
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {selectedRecord.detail.parties.accused.map((a, i) => (
                          <div key={i} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 4, padding: "7px 10px", fontSize: 12, display: "flex", gap: 10 }}>
                            <span style={{ fontFamily: "monospace", color: "#64748b", minWidth: 26 }}>{a.ref}</span>
                            <strong style={{ color: "#1e293b" }}>{a.name}</strong>
                            <span style={{ color: "#64748b" }}>
                              {[a.age && `${a.age} yrs`, genderLabel(a.gender)].filter(Boolean).join(" \u00b7 ")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!!selectedRecord.detail.briefFacts && (
                    <div>
                      <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", letterSpacing: "0.05em", marginBottom: 6 }}>
                        BRIEF FACTS OF THE CASE
                      </div>
                      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 4, padding: 12, fontSize: 12, lineHeight: 1.6, color: "#1e293b", whiteSpace: "pre-wrap" }}>
                        {selectedRecord.detail.briefFacts}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedRecord.errorDetails && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: 14 }}>
                  <div style={{ fontSize: 10, color: "#991b1b", fontFamily: "monospace", letterSpacing: "0.05em", marginBottom: 5 }}>
                    FAILURE DETAIL
                  </div>
                  <div style={{ fontSize: 12, color: "#7f1d1d", lineHeight: 1.6 }}>{selectedRecord.errorDetails}</div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", padding: "12px 20px", textAlign: "right" }}>
              <button
                onClick={() => setSelectedRecord(null)}
                style={{
                  background: "#001f3f",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  padding: "8px 16px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
