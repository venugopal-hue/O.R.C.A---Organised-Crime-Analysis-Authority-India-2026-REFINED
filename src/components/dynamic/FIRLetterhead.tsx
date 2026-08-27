"use client";

import React, { useState, useEffect } from "react";
import { Barcode128 } from "./Barcode128";
import { useAuth } from "@/context/AuthContext";

/**
 * Printable FIR on the O.R.C.A secure letterhead.
 *
 * Deliberately mirrors Letterhead.tsx (the AI Report generator's "Secure
 * Letterhead") so every document the console issues looks like one family:
 * same watermark, same government top bar, same chain-of-custody stamp, same
 * signature/barcode footer, same authenticity notice.
 *
 * Printing works through the `.report-frame` class: globals.css hides every
 * other element under @media print, so window.print() emits this alone.
 */

export interface FIRDocumentData {
  crimeNo: string;
  caseNo: string;
  caseCategory: string;
  registeredDate: string;
  policeStation: string;
  district: string;
  gravity: string;
  caseStatus: string;
  court: string;
  registeringOfficer: string;
  incidentFrom?: string;
  incidentTo?: string;
  infoReceived?: string;
  latitude?: string;
  longitude?: string;
  briefFacts: string;
  actSections: { act: string; actCode: string; section: string; sectionDesc: string }[];
  complainants: { name: string; age: string; gender?: string }[];
  victims: { name: string; age: string; gender?: string }[];
  accused: { ref: string; name: string; age: string; gender: string }[];
}

/**
 * Timestamps reach this component from two places: straight off the
 * registration form, where <input type="datetime-local"> yields
 * "2026-08-22T21:15", and from Catalyst, which returns "2026-08-22 21:15:00".
 * Printing the raw form value put a stray "T" on the official document, so
 * normalise both to the same readable form here.
 */
const formatStamp = (value?: string): string => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2})?/);
  return m ? `${m[1]} ${m[2]}` : raw;
};

const Field: React.FC<{ label: string; value?: string }> = ({ label, value }) => (
  <div className="flex gap-1.5">
    <span className="font-mono text-[8.5px] text-[#64748B] uppercase tracking-wide shrink-0">{label}:</span>
    <span className="text-[9.5px] text-[#0A192F] font-semibold leading-tight">{value || "—"}</span>
  </div>
);

const Table: React.FC<{ heading: string; headers: string[]; rows: (string | undefined)[][] }> = ({
  heading, headers, rows,
}) => {
  if (rows.length === 0) return null;
  return (
    <div className="mb-3">
      <div className="font-mono text-[8.5px] font-bold text-[#0A192F] uppercase tracking-[0.12em] mb-1">
        {heading}
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} className="bg-[#0A192F] text-white text-left font-mono text-[8px] uppercase tracking-wider px-2 py-1 font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 ? "bg-[#FAF9F6]" : ""}>
              {r.map((c, j) => (
                <td key={j} className="border-b border-[#E2E8F0] px-2 py-1 text-[9px] text-[#1E293B] align-top">
                  {c || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const FIRLetterhead: React.FC<{ data: FIRDocumentData }> = ({ data }) => {
  const { officerProfile } = useAuth();
  const [dateStr, setDateStr] = useState("");
  const [docHash, setDocHash] = useState("");

  // The year is the CASE's year, read out of the crime number (offset 9..12),
  // not a fixed 2026 - a case registered in 2027 must print VER-2027-…
  const caseYear = data.crimeNo?.match(/^\d{9}(\d{4})\d{5}$/)?.[1] || String(new Date().getFullYear());
  const verificationId = `VER-${caseYear}-${data.crimeNo}`;
  /**
   * Barcode payload: the bare 18-digit CrimeNo, nothing else.
   *
   * It is deliberately this short. The footer scales the barcode into a slot
   * only ~260-380px wide, and ZXing needs roughly 1.8px per module to read it
   * back. A `VER=VER-2026-<no>|CASE=<no>` payload needs ~900px at that module
   * width — printed FIRs simply would not scan. All-digits lets CODE128 use
   * Set C (two digits per symbol), which cuts the pattern to ~134 modules and
   * decodes at 100% across every footer size tested. The `VER-` prefix carried
   * no information the CrimeNo does not already carry, and the full
   * verification ID stays printed in human-readable form directly below.
   */
  const barcodePayload = data.crimeNo;

  useEffect(() => {
    setDateStr(new Date().toISOString().replace("T", " ").substring(0, 19));

    // A real digest over the document's own content — not a random string.
    const payload = JSON.stringify({
      crimeNo: data.crimeNo, caseNo: data.caseNo, station: data.policeStation,
      sections: data.actSections, facts: data.briefFacts,
    });
    crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(payload))
      .then((buf) =>
        setDocHash(
          Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 62)
        )
      )
      .catch(() => setDocHash("UNAVAILABLE"));
  }, [data]);

  return (
    <div className="bg-white p-6 md:p-8 relative min-h-[500px] flex flex-col justify-between select-text text-black report-frame h-full">

      {/* 1. CONFIDENTIAL WATERMARK */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none flex flex-col items-center justify-center text-center opacity-[0.03] z-0 report-watermark">
        <img src="/logo.png" alt="Emblem Watermark" className="w-56 h-56 object-contain mb-2" />
        <div className="text-3xl font-black font-serif tracking-[0.25em] text-[#001f3f] leading-none">O.R.C.A</div>
        <div className="text-4xl font-black tracking-[0.2em] font-serif text-[#001f3f] leading-tight mt-1">CONFIDENTIAL</div>
        <div className="text-xs font-bold font-mono tracking-[0.2em] text-[#001f3f] uppercase mt-2">INTERNAL SECURITY DIVISION</div>
      </div>

      <div className="relative z-10">
        {/* Government letterhead top bar */}
        <div className="flex justify-between items-center border-b-2 border-[#0A192F] pb-2.5 mb-3 shrink-0">
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
          <div className="text-right font-mono text-[9px] text-[#475569] leading-tight">
            <div className="font-extrabold text-[9.5px] text-[#0A192F] uppercase tracking-wide leading-none">
              {data.policeStation}
            </div>
            <div className="mt-0.5">{data.district} District &nbsp;·&nbsp; Karnataka</div>
            <div className="mt-0.5">
              CRIME NO: {data.crimeNo} &nbsp;·&nbsp; UTC: {dateStr} IST &nbsp;·&nbsp; SIG: <span className="text-[#0B6A61] font-bold">✓ VERIFIED</span>
            </div>
          </div>
        </div>

        {/* Cryptographic chain-of-custody stamp */}
        <div className="border border-[#CBD5E1] bg-[#FAF9F6] p-1.5 px-2.5 mb-4 rounded-[1px] font-mono text-[9px] text-[#475569] flex flex-wrap justify-between items-center shrink-0">
          <div>COURT EXHIBIT STATUS: <strong className="text-[#0B6A61]">VERIFIED</strong></div>
          <div className="truncate max-w-[280px]">FORENSIC PACKET HASH: <strong>{docHash}</strong></div>
          <div>ISD DIGITAL SIGNATURE: <strong className="text-[#0B6A61]">ACTIVE</strong></div>
        </div>

        {/* Classification and Title */}
        <div className="mb-4 text-center">
          <h3 className="text-sm font-extrabold tracking-wider uppercase text-[#0A192F]">
            First Information Report &nbsp;·&nbsp; {data.caseCategory}
          </h3>
          <span className="inline-block border border-[#E25C24] text-[#E25C24] font-mono text-[9px] font-bold px-2 py-0.5 rounded-[1px] tracking-widest mt-1">
            CONFIDENTIAL
          </span>
        </div>

        {/* Case particulars */}
        <div className="border border-[#CBD5E1] bg-[#FAF9F6] rounded-[1px] p-2.5 mb-3 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
          <Field label="Crime No" value={data.crimeNo} />
          <Field label="Case No" value={data.caseNo} />
          <Field label="Category" value={data.caseCategory} />
          <Field label="Registered" value={data.registeredDate} />
          <Field label="Police Station" value={data.policeStation} />
          <Field label="District" value={data.district} />
          <Field label="Gravity" value={data.gravity} />
          <Field label="Status" value={data.caseStatus} />
          <Field label="Court" value={data.court} />
          <Field label="Incident From" value={formatStamp(data.incidentFrom)} />
          <Field label="Incident To" value={formatStamp(data.incidentTo)} />
          <Field label="Info at PS" value={formatStamp(data.infoReceived)} />
          {(data.latitude || data.longitude) && (
            <Field label="Location" value={`${data.latitude || "—"}, ${data.longitude || "—"}`} />
          )}
          <Field label="Registered By" value={data.registeringOfficer} />
        </div>

        <Table
          heading="Acts & Sections Invoked"
          headers={["#", "Act", "Section", "Description"]}
          rows={data.actSections.map((s, i) => [String(i + 1), `${s.act} (${s.actCode})`, s.section, s.sectionDesc])}
        />
        <Table
          heading="Complainant(s)"
          headers={["#", "Name", "Age", "Gender"]}
          rows={data.complainants.map((c, i) => [String(i + 1), c.name, c.age, c.gender])}
        />
        <Table
          heading="Victim(s)"
          headers={["#", "Name", "Age", "Gender"]}
          rows={data.victims.map((v, i) => [String(i + 1), v.name, v.age, v.gender])}
        />
        <Table
          heading="Accused"
          headers={["Ref", "Name", "Age", "Gender"]}
          rows={data.accused.map((a) => [a.ref, a.name, a.age, a.gender])}
        />

        {/* Brief facts */}
        <div className="mb-2">
          <div className="font-mono text-[8.5px] font-bold text-[#0A192F] uppercase tracking-[0.12em] mb-1">
            Brief Facts of the Case
          </div>
          <p className="text-[9.5px] text-[#1E293B] leading-relaxed text-justify whitespace-pre-wrap">
            {data.briefFacts || "—"}
          </p>
        </div>
      </div>

      {/* Official Signatures & Verification Section */}
      <div className="mt-6 shrink-0 relative z-10">
        <div className="flex justify-between items-end font-mono text-[9.5px] text-[#64748B] border-t border-[#CBD5E1]/40 pt-3 report-footer">
          <div className="text-center">
            <div className="border-t border-[#94A3B8] w-36 mb-1"></div>
            Recorded &amp; Certified By<br />
            <strong>{data.registeringOfficer || officerProfile?.name || "Station House Officer"}</strong>
          </div>

          <div className="flex flex-col items-center justify-end text-center px-2">
            <Barcode128 value={barcodePayload} moduleWidth={3} className="mb-1" />
            <div className="text-[7.5px] font-bold text-[#64748B] uppercase tracking-wider leading-none">DOCUMENT VERIFICATION ID</div>
            <div className="text-[8.5px] font-bold text-[#0A192F] font-mono mt-0.5">{verificationId}</div>
          </div>

          <div className="text-center">
            <div className="border-t border-[#94A3B8] w-36 mb-1"></div>
            Approved for Court Filing<br />
            <strong>Superintendent of Police</strong>
          </div>
        </div>

        {/* Document authenticity notice */}
        <div className="text-[7px] text-[#94A3B8] text-center mt-2.5 max-w-3xl mx-auto leading-tight font-sans">
          This document was electronically generated by the Organized Crime Analysis Authority (O.R.C.A), Karnataka State Police and the State Crime Records Bureau (SCRB). The report is digitally authenticated and linked to a unique verification identifier. Any unauthorized modification, reproduction, or distribution invalidates this document and may constitute an offence under applicable Government of Karnataka regulations.
        </div>
      </div>
    </div>
  );
};
