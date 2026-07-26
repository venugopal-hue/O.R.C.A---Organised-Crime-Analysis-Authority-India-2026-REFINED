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
  Trash2,
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
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, query, orderBy, limit, deleteDoc } from "firebase/firestore";

interface VerificationResult {
  success: boolean;
  primaryDecoderUsed?: boolean;
  fallbackDecoderUsed?: boolean;
  errorTitle?: string;
  errorMessage?: string;
  data?: {
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
  };
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
}

const initialDemoHistory: HistoryRecord[] = [
  {
    id: "hist-1",
    timestamp: "2026-06-28 17:30:12 IST",
    verificationId: "VER-2026-ISD-CR-8852",
    caseNumber: "FIR/2026/BLR/8852",
    documentName: "ORCA_Briefing_8852.pdf",
    status: "VERIFIED",
    verifiedBy: "Command Officer",
    issuingAuthority: "Karnataka State Police • SCRB (ORCA)",
    processingTime: "1.2s",
    reportReference: "ISD-CR-8852",
    officerName: "DSP R.K. SHASTRY",
    officerRank: "IPS, Superintendent of Police",
    policeStation: "Internal Security Division (ISD)",
    district: "Bengaluru City",
    classification: "CONFIDENTIAL",
    generatedAt: "2026-06-28 15:30 IST",
    barcodePayload: "STATUS=VERIFIED|CASE=FIR/2026/BLR/8852"
  },
  {
    id: "hist-2",
    timestamp: "2026-06-28 16:15:44 IST",
    verificationId: "VER-2026-ISD-CR-4572",
    caseNumber: "FIR/2026/BLR/4572",
    documentName: "State_Crime_Brief_4572.pdf",
    status: "VERIFIED",
    verifiedBy: "Command Officer",
    issuingAuthority: "Karnataka State Police • SCRB (ORCA)",
    processingTime: "0.9s",
    reportReference: "ISD-CR-4572",
    officerName: "DSP R.K. SHASTRY",
    officerRank: "IPS, Superintendent of Police",
    policeStation: "Internal Security Division (ISD)",
    district: "Bengaluru City",
    classification: "CONFIDENTIAL",
    generatedAt: "2026-06-28 16:15 IST",
    barcodePayload: "STATUS=VERIFIED|CASE=FIR/2026/BLR/4572"
  },
  {
    id: "hist-3",
    timestamp: "2026-06-28 15:10:05 IST",
    verificationId: "VER-2026-ISD-CR-9999",
    caseNumber: "FIR/2026/BLR/9999",
    documentName: "tkt_new_1.pdf",
    status: "DOCUMENT NOT FOUND",
    verifiedBy: "Command Officer",
    issuingAuthority: "Unverified Entity",
    processingTime: "1.5s",
    errorDetails: "No record matching VER-2026-ISD-CR-9999 exists in Firebase Firestore database."
  },
  {
    id: "hist-4",
    timestamp: "2026-06-28 14:22:30 IST",
    verificationId: "VER-UNKNOWN",
    caseNumber: "N/A",
    documentName: "grocery_receipt.png",
    status: "INVALID",
    verifiedBy: "Command Officer",
    issuingAuthority: "N/A",
    processingTime: "0.7s",
    errorDetails: "The uploaded file does not contain valid O.R.C.A document verification headers."
  }
];

export const DocumentVerification: React.FC = () => {
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

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setIsRefreshing(true);
    let loaded: HistoryRecord[] = [];

    // Try Firestore
    try {
      const q = query(collection(db, "verification_history"), orderBy("timestamp", "desc"), limit(50));
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((docSnap) => {
        loaded.push({ id: docSnap.id, ...docSnap.data() } as HistoryRecord);
      });
    } catch (err) {
      console.warn("[Firestore History Read] Using local cache / fallback:", err);
    }

    // LocalStorage fallback / merge
    if (loaded.length === 0 && typeof window !== "undefined") {
      const local = localStorage.getItem("orca_verification_history");
      if (local) {
        try {
          loaded = JSON.parse(local);
        } catch (e) {}
      }
    }

    if (loaded.length === 0) {
      loaded = initialDemoHistory;
    }

    setHistory(loaded);
    setIsRefreshing(false);
  };

  const saveRecordToHistory = async (newRecord: HistoryRecord) => {
    setHistory(prev => [newRecord, ...prev]);

    // Save to LocalStorage
    if (typeof window !== "undefined") {
      try {
        const existing = localStorage.getItem("orca_verification_history");
        const parsed = existing ? JSON.parse(existing) : initialDemoHistory;
        localStorage.setItem("orca_verification_history", JSON.stringify([newRecord, ...parsed]));
      } catch (e) {}
    }

    // Save to Firestore
    try {
      await addDoc(collection(db, "verification_history"), newRecord);
    } catch (err) {
      console.warn("[Firestore History Write] Cached locally:", err);
    }
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
        verifiedBy: "Command Officer",
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
        errorDetails: data.errorMessage
      };

      saveRecordToHistory(newHistItem);

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

  // Statistics Metrics
  const stats = useMemo(() => {
    const total = history.length;
    const verified = history.filter(h => h.status === "VERIFIED").length;
    const failed = total - verified;
    const avgTime = total > 0 ? "1.1s" : "0.0s";
    return { total, verified, failed, avgTime };
  }, [history]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div style={{ animation: "fadeIn 0.3s ease", display: "flex", flexDirection: "column", gap: 24 }}>
      
      {/* Header Banner */}
      <div style={{
        background: "linear-gradient(135deg, #001f3f 0%, #002855 100%)",
        padding: "24px 32px",
        borderRadius: 8,
        color: "white",
        boxShadow: "0 4px 15px rgba(0,31,63,0.15)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ShieldCheck style={{ width: 28, height: 28, color: "#FF9933" }} />
            <h2 style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--font-serif, serif)" }}>
              Official Document Verification Console
            </h2>
          </div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
            Verify ORCA-generated intelligence briefings by scanning embedded Code 128 barcode cryptographic signatures.
          </p>
        </div>
        <div style={{
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.2)",
          padding: "8px 16px",
          borderRadius: 4,
          fontFamily: "monospace",
          fontSize: 11,
          color: "#FF9933",
          fontWeight: 700
        }}>
          ZIA BARCODE ENGINE // CODE 128
        </div>
      </div>

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

              {/* Structured Metadata Card (Populated strictly from Firestore Data) */}
              {isVerified && result.data && (
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace", marginBottom: 12 }}>
                    Authoritative Firestore Record Dossier
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12, fontFamily: "sans-serif" }}>
                    <div>
                      <span style={{ fontSize: 10, color: "#64748b", display: "block", fontFamily: "monospace" }}>VERIFICATION STATUS</span>
                      <strong style={{ color: "#10b981" }}>🟢 {result.data.verificationStatus}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: "#64748b", display: "block", fontFamily: "monospace" }}>VERIFICATION ID</span>
                      <strong style={{ color: "#003a75", fontFamily: "monospace" }}>{result.data.verificationId}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: "#64748b", display: "block", fontFamily: "monospace" }}>CASE NUMBER</span>
                      <strong style={{ color: "#001f3f" }}>{result.data.caseNumber}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: "#64748b", display: "block", fontFamily: "monospace" }}>REPORT REFERENCE</span>
                      <strong style={{ color: "#002855" }}>{result.data.reportReference}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: "#64748b", display: "block", fontFamily: "monospace" }}>INVESTIGATING OFFICER</span>
                      <strong style={{ color: "#1e293b" }}>{result.data.officerName}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: "#64748b", display: "block", fontFamily: "monospace" }}>OFFICER RANK</span>
                      <strong style={{ color: "#475569" }}>{result.data.officerRank}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: "#64748b", display: "block", fontFamily: "monospace" }}>POLICE STATION / UNIT</span>
                      <strong style={{ color: "#334155" }}>{result.data.policeStation}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: "#64748b", display: "block", fontFamily: "monospace" }}>DISTRICT / JURISDICTION</span>
                      <strong style={{ color: "#334155" }}>{result.data.district}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: "#64748b", display: "block", fontFamily: "monospace" }}>ISSUING AUTHORITY</span>
                      <strong style={{ color: "#002855" }}>{result.data.issuingAuthority}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: "#64748b", display: "block", fontFamily: "monospace" }}>GENERATED DATE &amp; TIME</span>
                      <strong style={{ color: "#334155" }}>{result.data.generatedAt}</strong>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #cbd5e1", fontSize: 11, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#64748b", fontFamily: "monospace" }}>SECURITY CLASSIFICATION:</span>
                    <span style={{ background: "#001f3f", color: "#FF9933", padding: "2px 8px", borderRadius: 2, fontWeight: 700, fontSize: 10, fontFamily: "monospace" }}>
                      {result.data.classification}
                    </span>
                  </div>
                </div>
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
        
        {/* Verification History Banner - Under Active Development */}
        <div style={{
          background: "rgba(255, 153, 51, 0.06)",
          border: "1px dashed rgba(255, 153, 51, 0.35)",
          borderRadius: 8,
          padding: "24px 28px",
          marginTop: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#001f3f"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "rgba(255, 153, 51, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              flexShrink: 0
            }}>
              ⚡
            </div>
            <div>
              <strong style={{ display: "block", fontSize: 14, color: "#001f3f", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.02em" }}>
                HISTORICAL VERIFICATION LEDGER & AUDIT ARCHIVE — COMING SOON
              </strong>
              <span style={{ fontSize: 12, color: "#475569", marginTop: 4, display: "block", lineHeight: 1.5 }}>
                Statewide archival history & automated cryptographic ledger integration is currently under active deployment for SCRB Level-3 Nodes.
              </span>
            </div>
          </div>
          <span style={{
            background: "#FF9933",
            color: "#001f3f",
            fontSize: 10.5,
            fontWeight: 800,
            padding: "5px 12px",
            borderRadius: 12,
            fontFamily: "JetBrains Mono, monospace",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            whiteSpace: "nowrap"
          }}>
            UNDER DEVELOPMENT
          </span>
        </div>

      </div>

      {/* ============================================================ */}
      {/* VERIFICATION DETAILS MODAL                                   */}
      {/* ============================================================ */}
      {selectedRecord && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: 24,
          animation: "fadeIn 0.2s ease"
        }}>
          <div style={{
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
                  <strong style={{ color: "#003a75", fontFamily: "monospace" }}>{selectedRecord.verificationId}</strong>
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
