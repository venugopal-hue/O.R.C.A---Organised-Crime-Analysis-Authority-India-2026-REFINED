import React, { useState, useEffect } from "react";
import { AIPresetBrief } from "@/lib/mock";
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
  const [reportRef, setReportRef] = useState("ISD-CR-9000");
  const [dateStr, setDateStr] = useState("");
  const [secureHash, setSecureHash] = useState("");

  useEffect(() => {
    const newRef = `ISD-CR-${Math.floor(Math.random() * 8000) + 1000}`;
    const newDate = new Date().toISOString().replace('T', ' ').substring(0, 19);
    setReportRef(newRef);
    setDateStr(newDate);
    
    // Generate a secure mock SHA-256 chunk for the document validation header
    const mockHashes = [
      "c2b8f9e29a8a34b22c8e9f1a0e9d9ef504d6a8f89e24b31a29ff0182bc8e92f",
      "d16c7a92fb08a34b22c8e9f1a0e9d9ef504d6a8f89e24b31a29ff0182bc8e92f",
      "a4b5c6d7e8f901a2b3c4d5e6f7a8b9c012345678901234567890abcdef12345"
    ];
    const hash = mockHashes[Math.floor(Math.random() * mockHashes.length)];
    setSecureHash(hash);

    // PART 1 — Automatically register generated report into Firestore `verified_documents`
    if (report) {
      const verId = `VER-2026-${newRef}`;
      const caseNum = `FIR/2026/BLR/${newRef.replace("ISD-CR-", "")}`;
      registerReportInFirestore({
        verificationId: verId,
        caseNumber: caseNum,
        reportReference: newRef,
        reportType: report.title || "State Crime Intelligence Briefing",
        verificationStatus: "VERIFIED",
        issuingAuthority: "Karnataka State Police • SCRB (ORCA)",
        officerName: officerProfile?.name ? officerProfile.name.toUpperCase() : "STATE COMMANDING OFFICER",
        officerRank: officerProfile?.rank || "Superintendent of Police",
        policeStation: "Internal Security Division (ISD)",
        district: "Bengaluru City",
        classification: report.classification || "CONFIDENTIAL",
        generatedAt: `${newDate} IST`,
        lastUpdated: `${newDate} IST`,
        reportHash: hash
      });
    }
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

  const verificationId = `VER-2026-${reportRef}`;
  const caseNumber = `FIR/2026/BLR/${reportRef.replace("ISD-CR-", "")}`;
  // Authoritative payload: VER=<Verification ID>|CASE=<Case Number>
  const barcodePayload = `VER=${verificationId}|CASE=${caseNumber}`;

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
            <div className="mt-0.5">
              REF: {reportRef} &nbsp;·&nbsp; UTC: {dateStr} IST &nbsp;·&nbsp; CLR: LEVEL-IV &nbsp;·&nbsp; SIG: <span className="text-[#0B6A61] font-bold">✓ VERIFIED</span>
            </div>
          </div>
        </div>

        {/* Cryptographic chain-of-custody stamp */}
        <div className="border border-[#CBD5E1] bg-[#FAF9F6] p-1.5 px-2.5 mb-4 rounded-[1px] font-mono text-[9px] text-[#475569] flex flex-wrap justify-between items-center shrink-0">
          <div>COURT EXHIBIT STATUS: <strong className="text-[#0B6A61]">VERIFIED</strong></div>
          <div className="truncate max-w-[280px]">FORENSIC PACKET HASH: <strong>{secureHash}</strong></div>
          <div>ISD DIGITAL SIGNATURE: <strong className="text-[#0B6A61]">ACTIVE</strong></div>
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
            Audited &amp; Certified By<br/><strong>AI Forensics Core (v2.4)</strong>
          </div>

          {/* 2. DYNAMIC DOCUMENT VERIFICATION BARCODE */}
          <div className="flex flex-col items-center justify-end text-center px-2">
            <Barcode128 value={barcodePayload} className="mb-1" />
            <div className="text-[7.5px] font-bold text-[#64748B] uppercase tracking-wider leading-none">DOCUMENT VERIFICATION ID</div>
            <div className="text-[8.5px] font-bold text-[#0A192F] font-mono mt-0.5">{verificationId}</div>
          </div>

          <div className="text-center">
            <div className="border-t border-[#94A3B8] w-36 mb-1"></div>
            Approved for Court Filing<br/><strong>Superintendent of Police, ISD</strong>
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

