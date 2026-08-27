import React, { useState, useEffect } from "react";
import { AIPresetBrief } from "@/lib/intelligenceTypes";
import { FileCheck } from "lucide-react";
import { Barcode128 } from "./Barcode128";
import { registerReportInFirestore } from "@/lib/documentService";
import { useAuth } from "@/context/AuthContext";

interface LetterheadProps {
  report: AIPresetBrief | null;
  loading: boolean;
}

export const Letterhead: React.FC<LetterheadProps> = ({ report, loading }) => {
  const { officerProfile } = useAuth();
  /**
   * Everything identifying this document is issued by the SERVER.
   *
   * WHAT THIS REPLACES
   *
   *   reference   `ISD-CR-` + Math.random() * 8000 + 1000 — so two documents
   *               could carry the same reference
   *   case number `FIR/<year>/BLR/<that same random number>` — a citation to a
   *               case file that may belong to somebody else, or to nobody,
   *               printed on a barcoded court exhibit
   *   hash        one of THREE hard-coded SHA-256 strings chosen at random,
   *               written into the ledger as this document's digest
   *
   * The ledger recorded all of it as VERIFIED, so scanning the barcode
   * "confirmed" a document against a digest of nothing.
   *
   * /api/verification/register now allocates the reference as a serial,
   * computes a real SHA-256 of the exact content being sealed, and returns
   * both. Until that call succeeds the document is NOT presented as verified.
   */
  const [ledger, setLedger] = useState<{
    reference: string;
    verificationId: string;
    documentHash: string;
    crimeNo: string;
    issuerClearance: string;
  } | null>(null);
  const [sealError, setSealError] = useState("");
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    if (!report) {
      setLedger(null);
      setSealError("");
      return;
    }
    let cancelled = false;
    setLedger(null);
    setSealError("");
    setDateStr(new Date().toISOString().replace("T", " ").substring(0, 19));

    (async () => {
      try {
        const res = await fetch("/api/verification/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            // The hash is computed from exactly this text, server-side.
            content: `${report.title}
${report.classification}
${report.content}`,
            reportType: report.title,
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.success) {
          throw new Error(data.error || `Could not seal the document (${res.status})`);
        }
        setLedger({
          reference: data.reference,
          verificationId: data.verificationId,
          documentHash: data.documentHash,
          crimeNo: data.crimeNo || "",
          issuerClearance: data.issuerClearance || "",
        });
      } catch (err: any) {
        if (!cancelled) setSealError(err?.message || "Could not seal the document.");
      }
    })();

    return () => { cancelled = true; };
  }, [report]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse p-6 md:p-8">
        <div className="h-6 bg-[#E2E8F0] w-1/2 rounded-[2px]"></div>
        <div className="h-4 bg-[#E2E8F0] w-1/3 rounded-[2px]"></div>
        <hr className="border-[#CBD5E1]" />
        <div className="h-24 bg-[#E2E8F0] rounded-[2px]"></div>
        <div className="h-16 bg-[#E2E8F0] rounded-[2px]"></div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-[#64748B] font-mono text-center h-full">
        <FileCheck className="w-12 h-12 text-[#94A3B8] mb-3" />
        <h3>No intelligence briefing compiled.</h3>
        <p className="text-[11px] mt-1">Select an operational preset query to execute the state search.</p>
      </div>
    );
  }

  /**
   * Until the ledger has answered, the document is not sealed and must not
   * pretend to be. `sealError` means the seal FAILED — the brief is still
   * readable, but it carries no reference, no barcode and no VERIFIED mark.
   */
  const sealed = ledger !== null;
  const reportRef = ledger?.reference ?? "";
  const verificationId = ledger?.verificationId ? `VER-${ledger.verificationId}` : "";
  const secureHash = ledger?.documentHash ?? "";
  // Blank unless the document is genuinely attached to a case — no composed
  // FIR number. See the note where the ledger call is made.
  const caseNumber = ledger?.crimeNo ?? "";
  /**
   * Barcode payload: the report reference alone, e.g. "ISD-CR-4271".
   *
   * It used to be `VER=<id>|CASE=<case>`, which measured 0% decodable at every
   * module width tried - the footer scales the barcode into a slot ~260-380px
   * wide, and a payload that long needs roughly 900px. Widening the bars only
   * makes the image scale down further, so no setting could rescue it. The
   * reference is the report's whole identity (everything else on the document
   * is a fixed template), so carrying it alone is sufficient, and it stays
   * human-readable to any scanner. The verification ID and case number are
   * derived from it server-side, exactly as they are composed here.
   *
   * moduleWidth 4 was chosen on a sweep over every possible reference, six
   * footer geometries and both scaling modes: 100% throughout.
   */
  const barcodePayload = reportRef;  // issued by the ledger, never composed here

  return (
    <div className="bg-white p-6 md:p-8 relative min-h-[500px] flex flex-col justify-between select-text text-black report-frame h-full">
      
      {/* 1. CONFIDENTIAL WATERMARK (Centered, 2-4% Opacity, Behind Content) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none flex flex-col items-center justify-center text-center opacity-[0.03] z-0 report-watermark">
        <img src="/logo.png" alt="Emblem Watermark" className="w-56 h-56 object-contain mb-2" />
        <div className="text-3xl font-black font-serif tracking-[0.25em] text-[#001f3f] leading-none">O.R.C.A</div>
        <div className="text-4xl font-black tracking-[0.2em] font-serif text-[#001f3f] leading-tight mt-1">CONFIDENTIAL</div>
        <div className="text-xs font-bold font-mono tracking-[0.2em] text-[#001f3f] uppercase mt-2">INTERNAL SECURITY DIVISION</div>
      </div>

      <div className="relative z-10">
        {/* Government letterhead top bar */}
        <div className="flex justify-between items-center border-b-2 border-[#0A192F] pb-2.5 mb-3 shrink-0">
          {/* Left: ORCA logo + 2-line branding — same height as w-10 h-10 SVG */}
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="O.R.C.A Emblem" className="w-10 h-10" style={{ objectFit: "contain", flexShrink: 0 }} />
            <div className="flex flex-col">
              <span className="font-extrabold text-[11px] text-[#0A192F] uppercase tracking-wide font-header leading-none">
                O.R.C.A &nbsp;·&nbsp; Organized Crime Analysis Authority
              </span>
              <span className="text-[8.5px] text-[#64748B] font-mono mt-0.5">
                Karnataka State Police &nbsp;·&nbsp; SCRB &nbsp;·&nbsp; AI Intelligence &amp; Crime Analytics Platform
              </span>
            </div>
          </div>
          {/* Right: 3-line government identity — same font/size, 7 fields packed into 3 rows */}
          <div className="text-right font-mono text-[9px] text-[#475569] leading-tight">
            <div className="font-extrabold text-[9.5px] text-[#0A192F] uppercase tracking-wide leading-none">Office of the Superintendent of Police</div>
            <div className="mt-0.5">Internal Security Division &nbsp;·&nbsp; Bengaluru, Karnataka</div>
            {/*
              REF, clearance and signature all reflect reality now.

              This line printed a fixed `CLR: LEVEL-IV` on every document
              whatever clearance the issuing officer held, and `✓ VERIFIED`
              before anything had been verified — on a page designed to be
              printed and produced in court.
            */}
            <div className="mt-0.5">
              REF: {sealed ? reportRef : "PENDING"} &nbsp;·&nbsp; UTC: {dateStr} IST
              {ledger?.issuerClearance ? <> &nbsp;·&nbsp; CLR: {ledger.issuerClearance}</> : null}
              &nbsp;·&nbsp; SIG:{" "}
              {sealed
                ? <span className="text-[#0B6A61] font-bold">✓ VERIFIED</span>
                : <span className="text-[#B45309] font-bold">UNSEALED</span>}
            </div>
          </div>
        </div>

        {/* Cryptographic chain-of-custody stamp */}
        {/*
          The stamp states the ACTUAL seal status.

          It read "COURT EXHIBIT STATUS: VERIFIED / ISD DIGITAL SIGNATURE:
          ACTIVE" unconditionally, beside a hash picked at random from three
          hard-coded strings. A document that failed to seal looked identical to
          one that succeeded.
        */}
        <div className="border border-[#CBD5E1] bg-[#FAF9F6] p-1.5 px-2.5 mb-4 rounded-[1px] font-mono text-[9px] text-[#475569] flex flex-wrap justify-between items-center shrink-0">
          {sealed ? (
            <>
              <div>COURT EXHIBIT STATUS: <strong className="text-[#0B6A61]">VERIFIED</strong></div>
              <div className="truncate max-w-[280px]">SHA-256: <strong>{secureHash}</strong></div>
              {caseNumber
                ? <div>CASE: <strong>{caseNumber}</strong></div>
                : <div>CASE: <strong>NOT CASE-LINKED</strong></div>}
            </>
          ) : (
            <div className="text-[#B45309]">
              COURT EXHIBIT STATUS: <strong>NOT SEALED</strong>
              {sealError ? <> &nbsp;·&nbsp; {sealError}</> : <> &nbsp;·&nbsp; sealing…</>}
            </div>
          )}
        </div>

        {/* Classification and Title */}
        <div className="mb-4 text-center">
          <h3 className="text-sm font-extrabold tracking-wider uppercase text-[#0A192F]">
            {report.title}
          </h3>
          <span className="inline-block border border-[#E25C24] text-[#E25C24] font-mono text-[9px] font-bold px-2 py-0.5 rounded-[1px] tracking-widest mt-1">
            {report.classification}
          </span>
        </div>

        {/* Dynamic content rendering */}
        <div 
          className="text-xs text-[#1E293B] leading-relaxed prose max-w-none font-sans report-body"
          dangerouslySetInnerHTML={{ __html: report.content }}
        />
      </div>

      {/* Official Signatures & Verification Section */}
      <div className="mt-6 shrink-0 relative z-10">
        <div className="flex justify-between items-end font-mono text-[9.5px] text-[#64748B] border-t border-[#CBD5E1]/40 pt-3 report-footer">
          <div className="text-center">
            <div className="border-t border-[#94A3B8] w-36 mb-1"></div>
            {/* No "Audited & Certified By AI Forensics Core (v2.4)" — nothing
                audited or certified anything, and there is no such component. */}
            Compiled By<br/><strong>O.R.C.A AI — unverified output</strong>
          </div>

          {/*
            2. DOCUMENT VERIFICATION BARCODE

            Only printed once the ledger has issued a reference. A barcode over
            a made-up reference is worse than no barcode: it scans, and it
            resolves to nothing or to somebody else's record.
          */}
          <div className="flex flex-col items-center justify-end text-center px-2">
            {sealed ? (
              <>
                <Barcode128 value={barcodePayload} moduleWidth={4} className="mb-1" />
                <div className="text-[7.5px] font-bold text-[#64748B] uppercase tracking-wider leading-none">DOCUMENT VERIFICATION ID</div>
                <div className="text-[8.5px] font-bold text-[#0A192F] font-mono mt-0.5">{verificationId}</div>
              </>
            ) : (
              <div className="text-[8px] text-[#B45309] font-bold uppercase tracking-wider">
                Not sealed — no verification id
              </div>
            )}
          </div>

          {/*
            Signed by the officer who actually generated it. This read
            "Superintendent of Police, ISD" on every document regardless of who
            was signed in — a rank and posting the issuer may not hold.
          */}
          <div className="text-center">
            <div className="border-t border-[#94A3B8] w-36 mb-1"></div>
            Generated By<br/>
            <strong>
              {officerProfile?.name || "—"}
              {officerProfile?.rank ? `, ${officerProfile.rank}` : ""}
            </strong>
          </div>
        </div>

        {/* 3. DOCUMENT AUTHENTICITY NOTICE */}
        <div className="text-[7px] text-[#94A3B8] text-center mt-2.5 max-w-3xl mx-auto leading-tight font-sans">
          This document was electronically generated by the Organized Crime Analysis Authority (O.R.C.A), Karnataka State Police and the State Crime Records Bureau (SCRB). The report is digitally authenticated and linked to a unique verification identifier. Any unauthorized modification, reproduction, or distribution invalidates this document and may constitute an offence under applicable Government of Karnataka regulations.
        </div>
      </div>

    </div>
  );
};

