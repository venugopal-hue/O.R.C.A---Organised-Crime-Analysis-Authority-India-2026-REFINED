"use client";

import React, { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import {
  Code128Reader,
  HTMLCanvasElementLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
  DecodeHintType
} from "@zxing/library";

interface Barcode128Props {
  value: string;
  className?: string;
  showDebug?: boolean;
}

export const Barcode128: React.FC<Barcode128Props> = ({ value, className = "", showDebug = false }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imgSrc, setImgSrc] = useState<string>("");
  const [isValidated, setIsValidated] = useState<boolean | null>(null);
  const [decodedTextResult, setDecodedTextResult] = useState<string>("");
  const [errorDetails, setErrorDetails] = useState<string>("");
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  useEffect(() => {
    if (canvasRef.current && value) {
      try {
        const canvas = canvasRef.current;

        // Step 1 & Step 6 — High-precision CODE128 generation
        // Module Width: 2.2px (high resolution crisp bars)
        // Height: 75px (ample vertical optical clearance)
        // Quiet Zone Margin: 24px on both left and right sides
        JsBarcode(canvas, value, {
          format: "CODE128",
          displayValue: false,
          margin: 24,
          height: 75,
          width: 2.2,
          background: "#ffffff",
          lineColor: "#000000",
        });

        const w = canvas.width;
        const h = canvas.height;
        setDimensions({ width: w, height: h });

        const dataUrl = canvas.toDataURL("image/png");
        setImgSrc(dataUrl);

        // Step 6 — Automated Pre-Verification Test (ZXing Code128Reader)
        try {
          const hints = new Map();
          hints.set(DecodeHintType.TRY_HARDER, true);
          const reader = new Code128Reader();

          const luminanceSource = new HTMLCanvasElementLuminanceSource(canvas);
          const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
          const result = reader.decode(binaryBitmap, hints);
          const text = result.getText();

          setDecodedTextResult(text);
          if (text === value || text.includes(value) || value.includes(text)) {
            setIsValidated(true);
            setErrorDetails("");
          } else {
            setIsValidated(false);
            setErrorDetails(`Mismatch: Expected "${value}", Decoded "${text}"`);
          }
        } catch (decodeErr: any) {
          console.warn("[Barcode Automated Pre-Verification Failed]:", decodeErr.message || decodeErr);
          setIsValidated(false);
          setErrorDetails(decodeErr.message || "Failed to decode generated Code128 pattern");
        }

      } catch (err: any) {
        console.error("[JsBarcode Generation Exception]:", err);
        setIsValidated(false);
        setErrorDetails(err.message || "JsBarcode rendering exception");
      }
    }
  }, [value]);

  return (
    <div className={`inline-block text-center ${className}`} style={{ textIndent: 0 }}>
      {/* Hidden canvas for native pixel rendering */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Render crisp uncompressed barcode */}
      {isValidated === false ? (
        <div className="border border-red-500 bg-red-50 text-red-700 p-2 rounded text-[10px] font-mono font-bold my-1">
          ❌ Barcode generation failed: {errorDetails}
        </div>
      ) : imgSrc ? (
        <img
          src={imgSrc}
          alt={`Code 128 Barcode: ${value}`}
          style={{
            display: "block",
            maxWidth: "100%",
            height: "65px",
            objectFit: "contain",
            margin: "0 auto",
            imageRendering: "pixelated", // Crisp unblurred lines for optical scanning
          }}
        />
      ) : (
        <div style={{ height: "65px", width: "280px", background: "#ffffff" }} />
      )}

      {/* Developer Debug Panel */}
      {showDebug && (
        <div className="mt-2 text-[9px] font-mono bg-slate-900 text-slate-200 p-2 rounded text-left border border-slate-700">
          <div><strong>Format:</strong> CODE128</div>
          <div><strong>Payload:</strong> {value}</div>
          <div><strong>Canvas Dim:</strong> {dimensions.width}px × {dimensions.height}px</div>
          <div><strong>Pre-Verification:</strong> {isValidated ? "✅ PASSED" : "❌ FAILED"}</div>
          {decodedTextResult && <div><strong>Decoded Text:</strong> {decodedTextResult}</div>}
          {errorDetails && <div className="text-red-400"><strong>Error:</strong> {errorDetails}</div>}
        </div>
      )}
    </div>
  );
};
