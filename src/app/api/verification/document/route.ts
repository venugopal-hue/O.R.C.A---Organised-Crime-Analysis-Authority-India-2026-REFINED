import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import catalyst from "zcatalyst-sdk-node";
import { getReportFromFirestore } from "@/lib/documentService";
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

import { checkAdminAuth } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  // 1. Enforce RBAC Session Check for Document Verification
  const activeOfficer = await checkAdminAuth(req, "Document Verification");
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

    if (decodedContent.includes("VER=") || decodedContent.includes("CASE=")) {
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
    } else if (decodedContent.startsWith("VER-2026-")) {
      verId = decodedContent;
      const ref = verId.replace("VER-2026-", "");
      caseNum = `FIR/2026/BLR/${ref.replace("ISD-CR-", "")}`;
    }

    console.log(`Parsed Verification ID: ${verId || "NONE"}`);
    console.log(`Parsed Case Number:     ${caseNum || "NONE"}`);

    if (!verId || !caseNum) {
      console.log("Final Verification Result: ❌ NOT AN ORCA DOCUMENT");
      console.log("=======================================================\n");
      return NextResponse.json({
        success: false,
        errorTitle: "❌ NOT AN ORCA DOCUMENT",
        errorMessage: "The decoded barcode does not contain valid O.R.C.A document headers (VER and CASE)."
      });
    }

    // STAGE 4 — FIRESTORE LOOKUP VIA ADMIN SDK
    let firestoreRecord = null;
    try {
      firestoreRecord = await getReportFromFirestore(verId);
      console.log(`Firestore Lookup Result: ${firestoreRecord ? "FOUND" : "NOT FOUND"}`);
    } catch (dbErr: any) {
      console.log(`Firestore Lookup Exception: ${dbErr.message}`);
      console.log("=======================================================\n");
      return NextResponse.json({
        success: false,
        errorTitle: "❌ DATABASE LOOKUP FAILED",
        errorMessage: `Unable to query Firebase Firestore document registry: ${dbErr.message}`
      });
    }

    if (!firestoreRecord) {
      console.log("Final Verification Result: ❌ DOCUMENT NOT FOUND");
      console.log("=======================================================\n");
      return NextResponse.json({
        success: false,
        errorTitle: "❌ DOCUMENT NOT FOUND",
        errorMessage: `No record matching ${verId} exists in Firebase Firestore. This document was never registered in ORCA.`
      });
    }

    // STAGE 5 — DOCUMENT COMPARISON
    if (firestoreRecord.verificationId !== verId || firestoreRecord.caseNumber !== caseNum || firestoreRecord.verificationStatus !== "VERIFIED") {
      console.log("Final Verification Result: ❌ DOCUMENT TAMPERED");
      console.log("=======================================================\n");
      return NextResponse.json({
        success: false,
        errorTitle: "❌ DOCUMENT TAMPERED",
        errorMessage: `Cryptographic mismatch detected. Scanned barcode payload (${caseNum}) conflicts with authoritative Firestore master record (${firestoreRecord.caseNumber}).`
      });
    }

    // STAGE 6 — VERIFIED SUCCESS
    console.log("Final Verification Result: 🟢 VERIFIED");
    console.log("=======================================================\n");
    return NextResponse.json({
      success: true,
      primaryDecoderUsed,
      fallbackDecoderUsed,
      data: {
        verificationStatus: firestoreRecord.verificationStatus,
        caseNumber: firestoreRecord.caseNumber,
        reportReference: firestoreRecord.reportReference,
        verificationId: firestoreRecord.verificationId,
        officerName: firestoreRecord.officerName,
        officerRank: firestoreRecord.officerRank,
        policeStation: firestoreRecord.policeStation,
        district: firestoreRecord.district,
        classification: firestoreRecord.classification,
        issuingAuthority: firestoreRecord.issuingAuthority,
        generatedAt: firestoreRecord.generatedAt
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
