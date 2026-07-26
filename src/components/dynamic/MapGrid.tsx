"use client";
import React, { useEffect, useRef, useState } from "react";
import { useIntelligence } from "@/context/IntelligenceContext";
import { ShieldAlert } from "lucide-react";

type TileLayer = "street" | "satellite" | "terrain";

const TILE_LAYERS: Record<TileLayer, { url: string; label: string }> = {
  street: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    label: "Map",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    label: "Satellite",
  },
  terrain: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    label: "Terrain",
  },
};

// Karnataka bounding box
const KA_BOUNDS: [[number, number], [number, number]] = [
  [11.5, 74.0],
  [18.5, 78.6],
];
const KA_CENTER: [number, number] = [14.8, 75.5];


const districtCoords: Record<string, { lat: number; lng: number; label: string; short: string }> = {
  "BLR_U": { lat: 12.9716, lng: 77.5946, label: "Bengaluru Urban",   short: "BLR" },
  "MYS":   { lat: 12.2958, lng: 76.6394, label: "Mysuru",            short: "MYS" },
  "MNG":   { lat: 12.9141, lng: 74.8560, label: "Mangaluru",         short: "MNG" },
  "HUB_D": { lat: 15.3647, lng: 75.1240, label: "Hubballi-Dharwad",  short: "HUB" },
  "BEL":   { lat: 15.8497, lng: 74.4977, label: "Belagavi",          short: "BEL" },
  "KAL":   { lat: 17.3297, lng: 76.8343, label: "Kalaburagi",        short: "KAL" },
};

export const MapGrid: React.FC = () => {
  const { selectedDistrictCode, setSelectedDistrictCode } = useIntelligence();
  const mapContainerRef  = useRef<HTMLDivElement>(null);
  const mapRef           = useRef<any>(null);
  const tileLayerRef     = useRef<any>(null);
  const markersRef       = useRef<Record<string, any>>({});
  const [leafletReady, setLeafletReady] = useState(false);
  const [activeLayer, setActiveLayer]   = useState<TileLayer>("street");

  // ── 1. Inject Leaflet CSS + JS once ──────────────────────────────────────
  useEffect(() => {
    const cssId = "leaflet-css-cdn";
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id   = cssId;
      link.rel  = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const styleId = "orca-map-styles";
    if (!document.getElementById(styleId)) {
      const s = document.createElement("style");
      s.id = styleId;
      s.innerHTML = `
        @keyframes orcaPing {
          0%   { transform: scale(1); opacity: 0.9; }
          100% { transform: scale(2.8); opacity: 0; }
        }
        .orca-mw  { background: transparent !important; border: none !important; }
        .orca-pin {
          display: flex; align-items: center; justify-content: center;
          width: 34px; height: 34px; border-radius: 50%;
          border: 2.5px solid #fff;
          box-shadow: 0 3px 10px rgba(0,0,0,0.45);
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px; font-weight: 700; color: #fff;
          position: relative; cursor: pointer;
          transition: transform 0.15s ease, background 0.15s ease;
          user-select: none;
        }
        .orca-pin.sel { transform: scale(1.25); border-color: #FF9933; }
        .orca-ring {
          position: absolute; top: -9px; left: -9px;
          width: 50px; height: 50px; border-radius: 50%;
          border: 2px solid #FF9933;
          animation: orcaPing 1.6s ease-out infinite;
          pointer-events: none;
        }
        .orca-lbl {
          position: absolute; top: 38px; left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px; font-weight: 700;
          padding: 2px 7px; border-radius: 4px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          pointer-events: none; letter-spacing: 0.3px;
        }
        .orca-lbl.def  { background: rgba(0,31,63,0.92); color: #fff; }
        .orca-lbl.sel  { background: rgba(226,92,36,0.95); color: #fff; }
        .leaflet-control-zoom { border: 1px solid #e2e8f0 !important; border-radius: 6px !important; overflow: hidden; }
        .leaflet-control-zoom a { color: #001f3f !important; font-weight: 700 !important; }
      `;
      document.head.appendChild(s);
    }

    const jsId = "leaflet-js-cdn";
    const existingScript = document.getElementById(jsId) as HTMLScriptElement | null;
    if (!existingScript) {
      const script  = document.createElement("script");
      script.id     = jsId;
      script.src    = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async  = true;
      script.onload = () => setLeafletReady(true);
      document.body.appendChild(script);
    } else {
      if ((window as any).L) {
        setLeafletReady(true);
      } else {
        existingScript.addEventListener("load", () => setLeafletReady(true));
      }
    }
  }, []);

  // ── 2. Build map ONCE after Leaflet loads ─────────────────────────────────
  useEffect(() => {
    if (!leafletReady || !mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L || mapRef.current) return;

    const el = document.createElement("div");
    el.style.cssText = "width:100%;height:100%;";
    mapContainerRef.current.innerHTML = "";
    mapContainerRef.current.appendChild(el);

    const map = L.map(el, {
      center: KA_CENTER,
      zoom:   7,
      minZoom: 6,
      maxZoom: 15,
      maxBounds: KA_BOUNDS,
      maxBoundsViscosity: 0.85,
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: true,
    });

    map.fitBounds(KA_BOUNDS, { padding: [10, 10] });

    tileLayerRef.current = L.tileLayer(TILE_LAYERS.street.url, { maxZoom: 19 }).addTo(map);
    mapRef.current = map;

    // Place markers
    Object.entries(districtCoords).forEach(([code, data]) => {
      const marker = L.marker([data.lat, data.lng], {
        icon: buildIcon(L, code, false),
      }).addTo(map);
      marker.on("click", () => setSelectedDistrictCode(code));
      markersRef.current[code] = marker;
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = {};
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafletReady]);

  // ── 3. Update markers when selection changes (NO map rebuild) ─────────────
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;
    Object.entries(markersRef.current).forEach(([code, marker]) => {
      const isSelected = code === selectedDistrictCode;
      marker.setIcon(buildIcon(L, code, isSelected));
    });
  }, [selectedDistrictCode]);

  // ── 4. Switch tile layer ──────────────────────────────────────────────────
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }
    tileLayerRef.current = L.tileLayer(TILE_LAYERS[activeLayer].url, { maxZoom: 19 }).addTo(mapRef.current);
    Object.values(markersRef.current).forEach((m: any) => m.bringToFront?.());
  }, [activeLayer]);

  return (
    <div style={{
      position: "relative", display: "flex", flexDirection: "column",
      background: "white", border: "1px solid #cbd5e1",
      borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      height: "100%", minHeight: 480, width: "100%", overflow: "hidden",
    }}>

      {/* Header bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", borderBottom: "1px solid #cbd5e1",
        background: "#fafbfc", flexShrink: 0,
      }}>
        <span style={{
          fontFamily: "JetBrains Mono, monospace", fontWeight: 700,
          fontSize: 11, color: "#001f3f", textTransform: "uppercase", letterSpacing: 0.5,
        }}>
          Karnataka District Threat Heatmap
        </span>

        {/* Layer switcher */}
        <div style={{ display: "flex", gap: 4 }}>
          {(Object.entries(TILE_LAYERS) as [TileLayer, { label: string }][]).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => setActiveLayer(key)}
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 9, fontWeight: 700,
                padding: "3px 9px", borderRadius: 4, cursor: "pointer",
                border: `1px solid ${activeLayer === key ? "#001f3f" : "#cbd5e1"}`,
                background: activeLayer === key ? "#001f3f" : "#f8fafc",
                color: activeLayer === key ? "#fff" : "#475569",
                transition: "all 0.15s ease",
                textTransform: "uppercase",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Geofence Alert */}
      {selectedDistrictCode === "MYS" && (
        <div style={{
          position: "absolute", top: 52, right: 12, zIndex: 1000,
          background: "#990000", color: "white",
          padding: "7px 12px", borderRadius: 6,
          boxShadow: "0 3px 8px rgba(0,0,0,0.3)",
          display: "flex", alignItems: "center", gap: 8,
          fontFamily: "JetBrains Mono, monospace", fontSize: 10, fontWeight: 700,
        }}>
          <ShieldAlert style={{ width: 14, height: 14, flexShrink: 0 }} />
          <div>
            <div>ALERT: GEOFENCE BREACH DETECTED</div>
            <div style={{ fontWeight: 400, opacity: 0.85, fontSize: 9, marginTop: 1 }}>
              Repeat offender device near Mysuru transport corridor
            </div>
          </div>
        </div>
      )}

      {/* Map tile area */}
      <div
        ref={mapContainerRef}
        style={{ flex: 1, minHeight: 400, position: "relative" }}
      >
        {!leafletReady && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: "100%", minHeight: 400,
            color: "#94a3b8", fontFamily: "JetBrains Mono, monospace",
            fontSize: 12, letterSpacing: 1,
          }}>
            LOADING MAP ENGINE…
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{
        position: "absolute", bottom: 12, right: 12, zIndex: 999,
        background: "rgba(255,255,255,0.96)", border: "1px solid #cbd5e1",
        borderRadius: 6, padding: "8px 10px",
        fontSize: 9, fontFamily: "JetBrains Mono, monospace", color: "#475569",
        boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
        display: "flex", flexDirection: "column", gap: 4,
      }}>
        {[
          { bg: "#FECACA", label: "Critical (9.0+)" },
          { bg: "#FED7AA", label: "High (6.5–8.9)" },
          { bg: "#E0F2FE", label: "Moderate (4.0–6.4)" },
          { bg: "#F1F5F9", label: "Safe Grid" },
        ].map(({ bg, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: bg, border: "1px solid #cbd5e1", display: "inline-block" }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
};

// Build a fresh DivIcon for a marker
function buildIcon(L: any, code: string, isSelected: boolean) {
  const bg    = isSelected ? "#E25C24" : "#001f3f";
  const short = districtCoords[code]?.short ?? code.slice(0, 3);
  const label = districtCoords[code]?.label ?? code;
  return L.divIcon({
    className: "orca-mw",
    html: `
      <div class="orca-pin ${isSelected ? "sel" : ""}" style="background:${bg}">
        ${short}
        ${isSelected ? '<div class="orca-ring"></div>' : ""}
        <span class="orca-lbl ${isSelected ? "sel" : "def"}">${label}</span>
      </div>
    `,
    iconSize:   [34, 78],
    iconAnchor: [17, 34],
  });
}
