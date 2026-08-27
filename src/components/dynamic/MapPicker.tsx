"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X, Crosshair, Plus, Minus, MapPin, Loader2 } from "lucide-react";

/**
 * Click-to-pick location map.
 *
 * Built directly on OpenStreetMap raster tiles rather than pulling in Leaflet:
 * the project has no map library, and the whole requirement is "show a map, let
 * the officer click a point". That is a few lines of Web Mercator maths, so a
 * dependency is not worth the weight.
 *
 * PRIVACY NOTE, worth knowing before this ships: tiles are fetched from
 * tile.openstreetmap.org, and the search box queries nominatim.openstreetmap.org.
 * Both therefore learn roughly WHERE the officer is looking — i.e. the area of a
 * crime scene. The project already does this in the AI chatbot's map branch, so
 * this is not a new category of egress, but it IS worth a departmental decision
 * before it is used on live cases. Nothing about the evidence itself is sent.
 */

const NAVY = "#001f3f";
const SAFFRON = "#FF9933";
const BORDER = "#cbd5e1";
const OFFWHITE = "#f8fafc";
const TEXT = "#1e293b";
const GRAY = "#475569";
const MUTED = "#94a3b8";
const MONO = "JetBrains Mono, monospace";

const TILE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 19;

/** Bengaluru — a sane fallback when nothing else is known. */
const FALLBACK = { lat: 12.9716, lon: 77.5946 };

// ── Web Mercator ────────────────────────────────────────────────────────────
const worldSize = (z: number) => TILE * Math.pow(2, z);

function lonToWorldX(lon: number, z: number) {
  return ((lon + 180) / 360) * worldSize(z);
}
function latToWorldY(lat: number, z: number) {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = (clamped * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * worldSize(z);
}
function worldXToLon(x: number, z: number) {
  return (x / worldSize(z)) * 360 - 180;
}
function worldYToLat(y: number, z: number) {
  const n = Math.PI - (2 * Math.PI * y) / worldSize(z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

interface Props {
  /** Starting point, if the form already has one. */
  lat?: number | null;
  lon?: number | null;
  onPick: (lat: number, lon: number) => void;
  onClose: () => void;
}

export const MapPicker: React.FC<Props> = ({ lat, lon, onPick, onClose }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: 380 });
  const [zoom, setZoom] = useState(lat != null && lon != null ? 16 : 11);
  const [centre, setCentre] = useState({
    lat: lat ?? FALLBACK.lat,
    lon: lon ?? FALLBACK.lon,
  });
  const [marker, setMarker] = useState<{ lat: number; lon: number } | null>(
    lat != null && lon != null ? { lat, lon } : null
  );

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState<string | null>(null);

  // Drag state kept in a ref so panning does not re-render on every mousemove.
  const drag = useRef<{ active: boolean; startX: number; startY: number; moved: number }>({
    active: false, startX: 0, startY: 0, moved: 0,
  });

  useEffect(() => {
    const measure = () => {
      const r = boxRef.current?.getBoundingClientRect();
      if (r) setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const topLeft = useMemo(() => ({
    x: lonToWorldX(centre.lon, zoom) - size.w / 2,
    y: latToWorldY(centre.lat, zoom) - size.h / 2,
  }), [centre, zoom, size]);

  const tiles = useMemo(() => {
    const max = Math.pow(2, zoom);
    const x0 = Math.floor(topLeft.x / TILE);
    const y0 = Math.floor(topLeft.y / TILE);
    const x1 = Math.floor((topLeft.x + size.w) / TILE);
    const y1 = Math.floor((topLeft.y + size.h) / TILE);
    const out: { key: string; url: string; left: number; top: number }[] = [];
    for (let ty = y0; ty <= y1; ty++) {
      if (ty < 0 || ty >= max) continue;         // no tiles above the pole
      for (let tx = x0; tx <= x1; tx++) {
        const wrapped = ((tx % max) + max) % max; // wrap around the date line
        out.push({
          key: `${zoom}/${tx}/${ty}`,
          url: `https://tile.openstreetmap.org/${zoom}/${wrapped}/${ty}.png`,
          left: tx * TILE - topLeft.x,
          top: ty * TILE - topLeft.y,
        });
      }
    }
    return out;
  }, [topLeft, zoom, size]);

  const screenOf = useCallback(
    (p: { lat: number; lon: number }) => ({
      left: lonToWorldX(p.lon, zoom) - topLeft.x,
      top: latToWorldY(p.lat, zoom) - topLeft.y,
    }),
    [topLeft, zoom]
  );

  const onMouseDown = (e: React.MouseEvent) => {
    drag.current = { active: true, startX: e.clientX, startY: e.clientY, moved: 0 };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    const dy = e.clientY - drag.current.startY;
    drag.current.moved += Math.abs(dx) + Math.abs(dy);
    drag.current.startX = e.clientX;
    drag.current.startY = e.clientY;
    setCentre((c) => ({
      lat: worldYToLat(latToWorldY(c.lat, zoom) - dy, zoom),
      lon: worldXToLon(lonToWorldX(c.lon, zoom) - dx, zoom),
    }));
  };

  const endDrag = () => { drag.current.active = false; };

  const onClick = (e: React.MouseEvent) => {
    // A drag that happens to end over the map is not a pin drop.
    if (drag.current.moved > 4) { drag.current.moved = 0; return; }
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    setMarker({
      lat: worldYToLat(topLeft.y + py, zoom),
      lon: worldXToLon(topLeft.x + px, zoom),
    });
  };

  const zoomBy = (d: number) => setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + d)));

  const useMyLocation = () => {
    if (!navigator.geolocation) { setSearchNote("This browser cannot provide a location."); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const here = { lat: p.coords.latitude, lon: p.coords.longitude };
        setCentre(here); setMarker(here); setZoom(17);
        setSearchNote(`Centred on your location (±${Math.round(p.coords.accuracy)} m).`);
      },
      (err) => setSearchNote(`Location unavailable: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true); setSearchNote(null);
    try {
      // Same public geocoder the AI chatbot already uses. Biased to India,
      // since every station in this system is in Karnataka.
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=in`,
        { headers: { Accept: "application/json" } }
      );
      const hits = await res.json();
      if (!Array.isArray(hits) || !hits.length) { setSearchNote(`Nothing found for “${q}”.`); return; }
      const found = { lat: Number(hits[0].lat), lon: Number(hits[0].lon) };
      setCentre(found); setMarker(found); setZoom(16);
      setSearchNote(String(hits[0].display_name || "").slice(0, 120));
    } catch {
      setSearchNote("Search is unavailable — drag the map instead.");
    } finally {
      setSearching(false);
    }
  };

  const markerPos = marker ? screenOf(marker) : null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,15,31,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
      onMouseUp={endDrag}
    >
      <div style={{ background: "#fff", borderRadius: 10, width: "min(860px, 100%)", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${BORDER}`, background: OFFWHITE }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Mark the Collection Point
            </div>
            <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>
              Click the map to drop a pin. Drag to move, scroll buttons to zoom.
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, display: "flex" }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Search */}
        <div style={{ display: "flex", gap: 8, padding: "10px 16px", borderBottom: `1px solid ${BORDER}`, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 240px" }}>
            <Search style={{ width: 14, height: 14, color: MUTED, position: "absolute", left: 10, top: 11 }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") search(); }}
              placeholder="Search a place, e.g. Silk Board Junction"
              style={{ width: "100%", padding: "8px 10px 8px 30px", border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 13, fontFamily: "inherit", color: TEXT }}
            />
          </div>
          <button onClick={search} disabled={searching}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: GRAY, cursor: "pointer" }}>
            {searching ? <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} /> : <Search style={{ width: 13, height: 13 }} />}
            Find
          </button>
          <button onClick={useMyLocation}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 12.5, fontWeight: 600, color: GRAY, cursor: "pointer" }}>
            <Crosshair style={{ width: 13, height: 13 }} /> My location
          </button>
        </div>

        {/* Map */}
        <div
          ref={boxRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseLeave={endDrag}
          onClick={onClick}
          style={{ position: "relative", height: 380, overflow: "hidden", cursor: drag.current.active ? "grabbing" : "crosshair", background: "#e8e4dd", userSelect: "none" }}
        >
          {tiles.map((t) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={t.key}
              src={t.url}
              alt=""
              draggable={false}
              /*
               * The tile host learns which square of the map is being viewed —
               * that is unavoidable with a public tile service. What it does
               * NOT need is the O.R.C.A page that requested it. Without this,
               * the Referer header carries the console's URL to a third party
               * on every tile, on every pan, alongside the coordinates.
               */
              referrerPolicy="no-referrer"
              style={{ position: "absolute", left: t.left, top: t.top, width: TILE, height: TILE, pointerEvents: "none" }}
            />
          ))}

          {markerPos && (
            <MapPin
              style={{
                position: "absolute",
                left: markerPos.left - 13,
                top: markerPos.top - 26,
                width: 26, height: 26,
                color: SAFFRON,
                filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.45))",
                pointerEvents: "none",
              }}
            />
          )}

          {/* Zoom controls */}
          <div style={{ position: "absolute", right: 10, top: 10, display: "flex", flexDirection: "column", gap: 4 }}>
            {[["+", 1], ["-", -1]].map(([label, d]) => (
              <button key={String(label)} onClick={(e) => { e.stopPropagation(); zoomBy(Number(d)); }}
                style={{ width: 30, height: 30, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: NAVY }}>
                {Number(d) > 0 ? <Plus style={{ width: 14, height: 14 }} /> : <Minus style={{ width: 14, height: 14 }} />}
              </button>
            ))}
          </div>

          {/* OSM requires attribution. */}
          <div style={{ position: "absolute", right: 4, bottom: 3, fontSize: 10, background: "rgba(255,255,255,0.75)", padding: "1px 5px", borderRadius: 3, color: GRAY }}>
            © OpenStreetMap contributors
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: marker ? TEXT : MUTED, fontFamily: MONO }}>
            {marker
              ? `${marker.lat.toFixed(6)}, ${marker.lon.toFixed(6)}`
              : "No point marked yet"}
            {searchNote && (
              <div style={{ fontFamily: "inherit", fontSize: 11.5, color: MUTED, marginTop: 3, maxWidth: 460 }}>{searchNote}</div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose}
              style={{ padding: "9px 16px", background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 4, fontSize: 13, fontWeight: 600, color: GRAY, cursor: "pointer" }}>
              Cancel
            </button>
            <button
              onClick={() => { if (marker) { onPick(marker.lat, marker.lon); onClose(); } }}
              disabled={!marker}
              style={{ padding: "9px 18px", background: NAVY, border: "none", borderRadius: 4, fontSize: 13, fontWeight: 700, color: "#fff", cursor: marker ? "pointer" : "default", opacity: marker ? 1 : 0.5 }}>
              Use this point
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapPicker;
