import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import catalyst from "zcatalyst-sdk-node";
import { findLedgerEntry, resolveCase } from "@/lib/verificationLedger";
import { 
  Code128Reader,
  RGBLuminanceSource, 
  BinaryBitmap, 
  HybridBinarizer, 
  DecodeHintType
} from "@zxing/library";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";

function decodeLuminanceRegion(
  rgbaPixels: Uint8Array | Buffer, 
  fullWidth: number, 
  fullHeight: number, 
  cropX: number, 
  cropY: number, 
  cropW: number, 
  cropH: number
): { text: string; format: string } {
  try {
    const luminanceData = new Uint8ClampedArray(cropW * cropH);
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const srcIdx = ((cropY + y) * fullWidth + (cropX + x)) * 4;
        const r = rgbaPixels[srcIdx] !== undefined ? rgbaPixels[srcIdx] : 255;
        const g = rgbaPixels[srcIdx + 1] !== undefined ? rgbaPixels[srcIdx + 1] : 255;
        const b = rgbaPixels[srcIdx + 2] !== undefined ? rgbaPixels[srcIdx + 2] : 255;
        luminanceData[y * cropW + x] = (r * 30 + g * 59 + b * 11) / 100;
      }
    }
    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new Code128Reader();
    const luminanceSource = new RGBLuminanceSource(luminanceData, cropW, cropH);
    const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));

    const result = reader.decode(binaryBitmap, hints);
    return {
      text: result.getText() || "",
      format: "CODE_128"
    };
  } catch (e) {
    return { text: "", format: "" };
  }
}

/**
 * Server-side ZXing image decoder for full-page reports and cropped barcode images
 */
function decodeBufferWithZXing(buffer: Buffer, fileName: string): { text: string; format: string; error?: string } {
  try {
    let width = 0;
    let height = 0;
    let rgbaPixels: Uint8Array | Buffer;

    const lowerName = fileName.toLowerCase();
    if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
      const rawImageData = jpeg.decode(buffer, { tolerantDecoding: true });
      width = rawImageData.width;
      height = rawImageData.height;
      rgbaPixels = rawImageData.data;
    } else {
      try {
        const png = PNG.sync.read(buffer);
        width = png.width;
        height = png.height;
        rgbaPixels = png.data;
      } catch (pngErr) {
        const rawImageData = jpeg.decode(buffer, { tolerantDecoding: true });
        width = rawImageData.width;
        height = rawImageData.height;
        rgbaPixels = rawImageData.data;
      }
    }

    if (!width || !height || !rgbaPixels) return { text: "", format: "", error: "Invalid pixel buffer dimensions" };

    // 1. Full image pass
    let res = decodeLuminanceRegion(rgbaPixels, width, height, 0, 0, width, height);
    if (res.text) return res;

    // 2. Bottom 40% footer region pass
    const b40Y = Math.floor(height * 0.6);
    const b40H = height - b40Y;
    res = decodeLuminanceRegion(rgbaPixels, width, height, 0, b40Y, width, b40H);
    if (res.text) return res;

    // 3. Bottom 60% region pass
    const b60Y = Math.floor(height * 0.4);
    const b60H = height - b60Y;
    res = decodeLuminanceRegion(rgbaPixels, width, height, 0, b60Y, width, b60H);
    if (res.text) return res;

    return { text: "", format: "", error: "ZXing pattern match not found across multi-region scan passes" };
  } catch (err: any) {
    return { text: "", format: "", error: err.message || String(err) };
  }
}

import { verifyOfficerRequest } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  // 1. Any active officer may verify a document. Gating this on administrator
  //    rights locked out the investigation officers the module is granted to.
  const activeOfficer = await verifyOfficerRequest(req);
  if (!activeOfficer) {
    return NextResponse.json({ 
      success: false, 
      errorTitle: "❌ ACCESS DENIED", 
      errorMessage: "Insufficient security clearance for Document Verification." 
    }, { status: 403 });
  }

  console.log("\n=======================================================");
  console.log("=== DOCUMENT VERIFICATION REQUEST ===");
  console.log("ZXing pipeline version: ACTIVE");
  console.log(`Request URL:     ${req.url}`);
  console.log(`HTTP Method:     ${req.method}`);

  let tempFilePath = "";
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      console.log("Uploaded filename: NONE (No file provided)");
      console.log("=======================================================\n");
      return NextResponse.json({ 
        success: false, 
        errorTitle: "❌ No Code128 barcode detected", 
        errorMessage: "No document or barcode image file provided." 
      }, { status: 400 });
    }

    console.log(`Uploaded filename: ${file.name}`);
    console.log(`MIME type:         ${file.type || "application/octet-stream"}`);
    console.log(`File size:         ${file.size} bytes`);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    tempFilePath = path.join(os.tmpdir(), `orca_doc_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`);
    fs.writeFileSync(tempFilePath, buffer);

    let decodedContent = "";
    let detectedFormat = "CODE_128";
    let primaryDecoderUsed = false;
    let fallbackDecoderUsed = false;

    // PIPELINE STAGE 1 — ZXing Primary Server-side Barcode Decoder
    console.log("ZXing started");
    const zxingResult = decodeBufferWithZXing(buffer, file.name);
    if (zxingResult.text && zxingResult.text.trim() !== "") {
      decodedContent = zxingResult.text.trim();
      detectedFormat = zxingResult.format || "CODE_128";
      primaryDecoderUsed = true;
      console.log("ZXing success");
      console.log(`Barcode format:    ${detectedFormat}`);
      console.log(`Decoded payload:   ${decodedContent}`);
    } else {
      console.log("ZXing failed");
      console.log(`ZXing exception:   ${zxingResult.error || "No pattern match found"}`);
    }

    // PIPELINE STAGE 2 — Zoho Catalyst Zia Optional Fallback
    if (!decodedContent) {
      console.log("Zoho Zia fallback invoked: YES");
      try {
        const app = catalyst.initialize(req as any);
        const zia = app.zia();
        let barcodeResult: any = null;
        try {
          barcodeResult = await zia.scanBarcode(fs.createReadStream(tempFilePath), { format: "CODE_128" });
        } catch (e1) {
          barcodeResult = await zia.scanBarcode(fs.createReadStream(tempFilePath), { format: "all" });
        }

        if (barcodeResult && (barcodeResult.content || barcodeResult.text || barcodeResult[0]?.content)) {
          decodedContent = barcodeResult.content || barcodeResult.text || barcodeResult[0]?.content;
          fallbackDecoderUsed = true;
          console.log("Zoho Zia fallback result: SUCCESS");
          console.log(`Decoded payload:   ${decodedContent}`);
        } else {
          console.log("Zoho Zia fallback result: FAILED (No barcode detected by Zia)");
        }
      } catch (ziaErr: any) {
        console.warn("Zoho Zia fallback exception:", ziaErr.message || ziaErr);
      }
    } else {
      console.log("Zoho Zia fallback invoked: NO (Primary ZXing succeeded)");
    }

    // Clean up temporary disk file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    // STAGE 2 CHECK — If both primary (ZXing) and fallback (Zia) fail
    if (!decodedContent || decodedContent.trim() === "") {
      console.log("Final Verification Result: ❌ No Code128 barcode detected");
      console.log("=======================================================\n");
      return NextResponse.json({
        success: false,
        errorTitle: "❌ No Code128 barcode detected",
        errorMessage: "No readable Code 128 barcode could be extracted from the uploaded report or document image."
      });
    }

    // STAGE 3 — PARSE ORCA PAYLOAD
    let verId = "";
    let caseNum = "";
    // Set when the payload carries only a document reference and no year, so
    // the verification ID and case number cannot be reconstructed from it.
    let reference = "";

    // Compact form printed on FIR letterheads: the bare 18-digit CrimeNo.
    // A longer key=value payload cannot be made to decode at the size the
    // footer renders the barcode, so case documents carry only the crime
    // number and the verification ID is derived from it. The shape is checked
    // here (category 1/3/4/8 + district + unit + a plausible year + serial);
    // the ledger lookup below is what actually authenticates the document.
    const compact = decodedContent.trim().match(/^([1348])(\d{4})(\d{4})(20\d{2})(\d{5})$/);
    if (compact) {
      caseNum = decodedContent.trim();
      // Year comes out of the crime number itself (offset 9..12), not a constant.
      verId = `VER-${compact[4]}-${caseNum}`;
    } else if (decodedContent.includes("VER=") || decodedContent.includes("CASE=")) {
      const parts = decodedContent.split("|");
      parts.forEach(part => {
        const [k, v] = part.split("=");
        if (k && v) {
          const key = k.trim().toUpperCase();
          const val = v.trim();
          if (key === "VER") verId = val;
          if (key === "CASE") caseNum = val;
        }
      });
    } else if (/^ISD-CR-\d{3,6}$/i.test(decodedContent.trim())) {
      // Compact form printed on AI intelligence briefs: the report reference
      // alone, e.g. "ISD-CR-4271". Same reason as the FIR above - the previous
      // VER=|CASE= payload was too long to decode at the printed size.
      // It carries no year, so the ledger is matched on the reference suffix
      // rather than by inventing a year that may not be the year of issue.
      reference = decodedContent.trim().toUpperCase();
    } else if (/^VER-\d{4}-/.test(decodedContent.trim())) {
      verId = decodedContent.trim();
      reference = verId.replace(/^VER-\d{4}-/, "");
    }

    console.log(`Parsed Verification ID: ${verId || "NONE"}`);
    console.log(`Parsed Case Number:     ${caseNum || "NONE"}`);

    if (!verId && !caseNum && !reference) {
      console.log("Final Verification Result: ❌ NOT AN ORCA DOCUMENT");
      console.log("=======================================================\n");
      return NextResponse.json({
        success: false,
        errorTitle: "❌ NOT AN ORCA DOCUMENT",
        errorMessage: "The decoded barcode is not an O.R.C.A document reference. Expected a crime number, a report reference (ISD-CR-nnnn), or a document carrying VER and CASE headers."
      });
    }

    // STAGE 4 — CATALYST VERIFICATION LEDGER LOOKUP
    let ledger: any = null;
    try {
      ledger = await findLedgerEntry({ verificationId: verId, crimeNo: caseNum, reference });
      console.log(`Catalyst Ledger Lookup: ${ledger ? "FOUND" : "NOT FOUND"}`);
    } catch (dbErr: any) {
      console.log(`Catalyst Lookup Exception: ${dbErr.message}`);
      console.log("=======================================================\n");
      return NextResponse.json({
        success: false,
        errorTitle: "❌ DATABASE LOOKUP FAILED",
        errorMessage: `Unable to query the Catalyst verification ledger: ${dbErr.message}`
      });
    }

    if (!ledger) {
      console.log("Final Verification Result: ❌ DOCUMENT NOT FOUND");
      console.log("=======================================================\n");
      return NextResponse.json({
        success: false,
        errorTitle: "❌ DOCUMENT NOT FOUND",
        errorMessage: `No record matching ${verId || reference || caseNum} exists in the O.R.C.A verification ledger. This document was never issued by the platform.`
      });
    }

    const entry = ledger.VerifiedDocument || ledger;

    // STAGE 5 — TAMPER CHECK: the scanned payload must agree with the ledger.
    // Only cross-check the case number when the barcode actually asserted one:
    // a reference-only payload has nothing to contradict, and the ledger row it
    // resolved to IS the assertion. Status must be VERIFIED either way.
    const caseNumberDisagrees = Boolean(caseNum) && String(entry.CrimeNo) !== String(caseNum);
    if (caseNumberDisagrees || String(entry.VerificationStatus) !== "VERIFIED") {
      console.log("Final Verification Result: ❌ DOCUMENT TAMPERED");
      console.log("=======================================================\n");
      return NextResponse.json({
        success: false,
        errorTitle: "❌ DOCUMENT TAMPERED",
        errorMessage: `Mismatch detected. The scanned barcode reports ${caseNum || reference}, but the authoritative ledger record holds ${entry.CrimeNo} with status ${entry.VerificationStatus}.`
      });
    }

    // Resolve the LIVE case so the portal reflects the current record rather
    // than a snapshot frozen at print time.
    // Not every ledger entry is an FIR — AI intelligence briefs are registered
    // here too and have no CaseMaster row. A missing case is therefore not a
    // failure; the document is still authentic, just without case detail.
    const liveCase = await resolveCase(String(entry.CrimeNo));

    // STAGE 6 — VERIFIED SUCCESS
    console.log("Final Verification Result: 🟢 VERIFIED");
    console.log("=======================================================\n");
    return NextResponse.json({
      success: true,
      primaryDecoderUsed,
      fallbackDecoderUsed,
      data: {
        verificationStatus: entry.VerificationStatus,
        verificationId: entry.VerificationID,
        caseNumber: liveCase?.crimeNo || entry.CrimeNo,
        reportReference: liveCase?.caseNo || entry.CrimeNo,
        officerName: entry.IssuedBy,
        officerRank: "",
        policeStation: liveCase?.policeStation || "",
        district: liveCase?.district || "",
        classification: "CONFIDENTIAL",
        issuingAuthority: "Karnataka State Police • SCRB (ORCA)",
        generatedAt: entry.IssuedAt,
        // Live case detail for the verification portal
        caseCategory: liveCase?.caseCategory || "",
        registeredDate: liveCase?.registeredDate || "",
        caseStatus: liveCase?.caseStatus || "",
        gravity: liveCase?.gravity || "",
        court: liveCase?.court || "",
        briefFacts: liveCase?.briefFacts || "",
        actSections: liveCase?.actSections || [],
        counts: liveCase?.counts || null,
        parties: liveCase?.parties || null,
        documentType: liveCase ? "FIR / CASE FILE" : "INTELLIGENCE DOCUMENT"
      }
    });

  } catch (error: any) {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    console.log(`Pipeline Exception: ${error.message}`);
    console.log("=======================================================\n");
    return NextResponse.json({ 
      success: false, 
      errorTitle: "❌ VERIFICATION FAILED", 
      errorMessage: error.message || "An unexpected error occurred during document verification." 
    }, { status: 500 });
  }
}
