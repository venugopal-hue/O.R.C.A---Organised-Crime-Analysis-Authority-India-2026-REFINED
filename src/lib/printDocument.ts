/**
 * O.R.C.A printable document builder.
 *
 * Extracted from the Reports tab's inline print routine so every document the
 * console issues — security briefs, FIRs — shares one letterhead, one watermark
 * and one print stylesheet. Opens a window, writes a self-contained HTML
 * document, prints it, and closes.
 *
 * Unlike the original inline version, the verification checksum here is a real
 * SHA-256 digest over the document's own content rather than a random string.
 */

export interface PrintTable {
  heading: string;
  headers: string[];
  rows: (string | number)[][];
}

export interface PrintDocumentOptions {
  /** Browser tab title and document heading. */
  documentTitle: string;
  /** Left-hand letterhead line, e.g. "O.R.C.A. CASE REGISTRATION". */
  headerTitle: string;
  /** Right-hand red badge text. */
  classification: string;
  /** Label/value rows for the metadata panel. */
  metadata: [string, string | number][];
  /** Zero or more tables. Empty tables are skipped. */
  tables?: PrintTable[];
  /** Optional free-text block rendered after the tables. */
  narrative?: { heading: string; body: string };
  /** Issuing authority line. */
  authority?: string;
}

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

async function sha256(text: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  } catch {
    return "UNAVAILABLE";
  }
}

export async function buildOrcaPrintDocument(opts: PrintDocumentOptions): Promise<boolean> {
  const {
    documentTitle,
    headerTitle,
    classification,
    metadata,
    tables = [],
    narrative,
    authority = "Organized Crime Analysis Authority (O.R.C.A)",
  } = opts;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;

  // Digest covers the substantive content, so the printed checksum is verifiable.
  const digestSource = JSON.stringify({ documentTitle, metadata, tables, narrative });
  const digest = await sha256(digestSource);
  const shortDigest = `${digest.slice(0, 8)}...${digest.slice(-8)}`;

  const generatedAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  const tablesHtml = tables
    .filter((t) => t.rows.length > 0)
    .map(
      (t) => `
        <h3>${esc(t.heading)}</h3>
        <table class="table">
          <thead><tr>${t.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
          <tbody>
            ${t.rows
              .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
              .join("")}
          </tbody>
        </table>`
    )
    .join("");

  const narrativeHtml =
    narrative && narrative.body.trim()
      ? `<h3>${esc(narrative.heading)}</h3>
         <p class="narrative">${esc(narrative.body).replace(/\n/g, "<br/>")}</p>`
      : "";

  printWindow.document.write(`
    <html>
      <head>
        <title>${esc(documentTitle)}</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 24px; color: #1e293b; line-height: 1.5; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #001f3f; padding-bottom: 12px; margin-bottom: 16px; }
          .logo { font-size: 20px; font-weight: 800; color: #001f3f; letter-spacing: 1px; }
          .classification { background: rgba(239, 68, 68, 0.08); color: #ef4444; border: 1px solid #fca5a5; padding: 4px 10px; font-size: 10px; font-weight: 700; border-radius: 4px; font-family: monospace; }
          .title { font-size: 18px; font-weight: 700; color: #001f3f; margin-bottom: 10px; }
          .metadata { margin-bottom: 16px; font-size: 11.5px; color: #64748b; background: #f8fafc; padding: 10px 12px; border-radius: 6px; border: 1px solid #e2e8f0; line-height: 1.5; }
          h3 { font-size: 13px; color: #001f3f; text-transform: uppercase; letter-spacing: 0.05em; margin: 18px 0 8px; }
          .table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          .table th { background: #001f3f; color: #fff; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; font-weight: 700; }
          .table td { padding: 8px 10px; border-bottom: 1px solid #cbd5e1; font-size: 11px; }
          .table tr:nth-child(even) { background: #f8fafc; }
          .narrative { font-size: 12px; text-align: justify; white-space: pre-wrap; }
          .footer { margin-top: 24px; border-top: 1px solid #cbd5e1; padding-top: 10px; font-size: 9px; color: #94a3b8; text-align: center; }
          .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 0;
            pointer-events: none;
            text-align: center;
          }
          .watermark img { width: 180px; opacity: 0.08; margin-bottom: 12px; }
          @media print {
            @page { size: auto; margin: 12mm 15mm; }
            body { padding: 0; background: #fff; }
            .footer { position: fixed; bottom: 0; left: 0; right: 0; margin-top: 0; border-top: 1px solid #cbd5e1; padding-top: 8px; }
          }
        </style>
      </head>
      <body>
        <div class="watermark">
          <img src="/logo.png" alt="Emblem"/>
          <div style="font-size: 3.5rem; font-weight: 900; color: rgba(0, 31, 63, 0.08); letter-spacing: 0.08em; line-height: 1;">O.R.C.A</div>
          <div style="font-size: 1.8rem; margin-top: 6px; color: rgba(0, 31, 63, 0.08); font-weight: bold; letter-spacing: 0.12em; line-height: 1;">CONFIDENTIAL</div>
        </div>

        <div style="position: relative; z-index: 1;">
          <div class="header">
            <div class="logo">${esc(headerTitle)}</div>
            <div class="classification">${esc(classification)}</div>
          </div>
          <div class="title">${esc(documentTitle)}</div>
          <div class="metadata">
            ${metadata.map(([k, v]) => `<strong>${esc(k)}:</strong> ${esc(v)}`).join("<br/>")}
            <br/><strong>ISSUING AUTHORITY:</strong> ${esc(authority)}
            <br/><strong>GENERATED:</strong> ${esc(generatedAt)} IST
            <br/><strong>VERIFICATION CHECKSUM:</strong> SHA-256 [${shortDigest}]
          </div>
          ${tablesHtml}
          ${narrativeHtml}
          <div class="footer">
            CONFIDENTIAL STATE GOVERNMENT PROPERTY • DISCLOSURE OR DISTRIBUTION PROHIBITED
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
  return true;
}
