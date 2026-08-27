"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useIntelligence } from "@/context/IntelligenceContext";
import { useDistrictStats, type DistrictStatRow } from "@/lib/useDistrictStats";

/**
 * Karnataka district case-density choropleth.
 *
 * A STATIC SVG. No tile layer, no pan, no zoom, no Leaflet.
 *
 * WHY IT STOPPED BEING A SLIPPY MAP
 *
 * The screen exists to show a number per district. A draggable basemap added
 * nothing to that and cost three things: pins with permanent name chips
 * collided into an unreadable pile wherever districts sit close together
 * (Bengaluru Urban / Rural / Ramanagara / Chikkaballapur / Kolar, and
 * Koppal / Vijayanagara / Ballari), every view sent tile requests to third
 * parties, and Leaflet came in from a CDN at runtime.
 *
 * Shading the district AREA removes the overlap structurally rather than
 * working around it — a label sits inside its own shape, and shapes cannot
 * collide. It also means the console now makes no external request to draw
 * this screen at all.
 *
 * BOUNDARIES
 *
 * `/geo/karnataka-districts.json`, derived from OpenStreetMap via Overpass
 * (boundary=administrative, admin_level=5), simplified to ~330 m tolerance.
 * ODbL, attributed on screen. Two districts were renamed in 2024 — Bangalore
 * Rural to Bengaluru North, Ramanagara to Bengaluru South — so the build
 * script maps every OSM name to its Catalyst name explicitly. A fuzzy match
 * would silently draw one district's case count inside another's outline.
 *
 * WHAT THE COLOUR MEANS
 *
 * The Threat Index from `threatIndex.ts`, computed from real `CaseMaster`
 * rows. A district with no cases is not shaded — it is left blank with a
 * hatch, because zero would read as "assessed, and calm" when the truth is
 * "nothing has been registered here".
 */

const BAND_COLOR: Record<string, string> = {
  Critical: "#b91c1c",
  Elevated: "#ea580c",
  Moderate: "#0369a1",
  None: "#e2e8f0",
};

const BAND_TEXT: Record<string, string> = {
  Critical: "#ffffff",
  Elevated: "#ffffff",
  Moderate: "#ffffff",
  None: "#64748b",
};

const BAND_LEGEND = [
  { band: "Critical", label: "Critical  (7.0 – 10)" },
  { band: "Elevated", label: "Elevated  (4.5 – 6.9)" },
  { band: "Moderate", label: "Moderate  (below 4.5)" },
  { band: "None", label: "No cases registered" },
];

type DistrictRow = DistrictStatRow;

interface Geo {
  attribution: string;
  districts: Record<string, [number, number][][]>;
}

/** Where a label goes, and whether it needs a leader line to get there. */
interface Placement {
  name: string;
  cx: number;
  cy: number;
  lx: number;
  ly: number;
  leader: boolean;
}

/*
 * The viewBox aspect is chosen to match the panel it sits in (roughly 1.6:1).
 * A squarer viewBox letterboxes inside a wide panel and shrinks the state to
 * fit the height, wasting the width the callouts need.
 */
const W = 1400;
const H = 840;

/**
 * The state is drawn in the middle band; the gutters either side hold the
 * label columns. Every district gets a callout, so the map itself has to give
 * up the width the labels need.
 */
const GUTTER = 380;
const PAD_Y = 20;

/*
 * SVG text scales with the viewBox, so these are NOT screen pixels. The 1400
 * unit viewBox renders into roughly 810 px, a factor of ~0.58 — a "13" here
 * arrived on screen at about 7.5 px, which is why the labels were unreadable.
 * Everything below is sized in viewBox units to land near its intended screen
 * size.
 */
const LABEL_H = 46;     // vertical slot one callout occupies
const LABEL_W = 340;
const FONT_NAME = 23;   // ~13.5 px on screen
const FONT_VALUE = 23;

export const MapGrid: React.FC = () => {
  const { selectedDistrictCode, setSelectedDistrictCode } = useIntelligence();

  // Shared with DistrictDossier, so the panel always explains the colour the
  // map is currently showing rather than a second, independently fetched copy.
  const { rows, loaded: statsLoaded, error: statsError } = useDistrictStats();

  const [geo, setGeo] = useState<Geo | null>(null);
  const [geoLoaded, setGeoLoaded] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [hover, setHover] = useState("");

  const loaded = statsLoaded && geoLoaded;
  const loadError = statsError || geoError;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/geo/karnataka-districts.json");
        if (!res.ok) throw new Error("District outlines could not be loaded.");
        const shapes = (await res.json()) as Geo;
        if (!cancelled) setGeo(shapes);
      } catch (e: any) {
        if (!cancelled) setGeoError(e?.message || "Could not load the district outlines.");
      } finally {
        if (!cancelled) setGeoLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /**
   * Selecting the district that is already selected clears the selection.
   *
   * Without this there is no way back to "nothing selected" once a district
   * has been clicked — the dossier stays pinned to whichever district was
   * touched last, and the saffron outline stays on the map with no way to
   * dismiss it.
   */
  const toggleDistrict = useCallback(
    (id: string) => setSelectedDistrictCode(selectedDistrictCode === id ? "" : id),
    [selectedDistrictCode, setSelectedDistrictCode]
  );

  const byName = useMemo(() => {
    const m = new Map<string, DistrictRow>();
    for (const r of rows) m.set(r.districtName, r);
    return m;
  }, [rows]);

  /**
   * Paint order: 0 = normal, 1 = hovered, 2 = selected. Sorting by this draws
   * highlighted shapes last, so a neighbour's border cannot overpaint them.
   */
  const highlightRank = useCallback(
    (name: string): number => {
      const row = byName.get(name);
      if (row && String(row.districtId) === selectedDistrictCode) return 2;
      if (hover === name) return 1;
      return 0;
    },
    [byName, selectedDistrictCode, hover]
  );

  /**
   * Project lon/lat into the viewBox.
   *
   * Longitude is scaled by cos(mid-latitude) so the state is not stretched
   * sideways — at 15°N that is a ~3.5% correction, visible on a shape as tall
   * as Karnataka. One state is small enough that a full map projection would
   * buy nothing over this.
   */
  const projected = useMemo(() => {
    if (!geo) return null;

    const all = Object.values(geo.districts).flat().flat();
    if (!all.length) return null;

    const lngs = all.map((p) => p[0]);
    const lats = all.map((p) => p[1]);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const kx = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);

    const spanX = (maxLng - minLng) * kx;
    const spanY = maxLat - minLat;
    const innerW = W - GUTTER * 2;
    const scale = Math.min(innerW / spanX, (H - PAD_Y * 2) / spanY);
    const offX = (W - spanX * scale) / 2;
    const offY = (H - spanY * scale) / 2;

    const px = (lng: number) => offX + (lng - minLng) * kx * scale;
    const py = (lat: number) => offY + (maxLat - lat) * scale;

    const shapes: { name: string; d: string; rings: [number, number][][] }[] = [];
    for (const [name, rings] of Object.entries(geo.districts)) {
      const projectedRings = rings.map((r) => r.map(([lng, lat]) => [px(lng), py(lat)] as [number, number]));
      const d = projectedRings
        .map((r) => "M" + r.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L") + "Z")
        .join("");
      shapes.push({ name, d, rings: projectedRings });
    }
    return shapes;
  }, [geo]);

  /**
   * Label placement — every district gets a callout in the side gutters.
   *
   * WHY NOT LABEL INSIDE THE SHAPES
   *
   * Only the big districts can hold two lines of text, so labelling in place
   * gave a map where most names sat inside their district and a handful hung
   * off leader lines — inconsistent, and the in-shape text had to be knocked
   * out white over the fill, which fights the colour it is sitting on.
   *
   * Putting all 31 in the gutters means no text ever covers a shaded area, the
   * treatment is the same for Bengaluru Urban and Belagavi, and the labels can
   * be read as a list down each side.
   *
   * The columns are packed by "desired y, then pushed apart" rather than by
   * even spacing: each label starts level with its own district and only moves
   * as far as it must to clear its neighbour, so leader lines stay short and
   * mostly avoid crossing.
   */
  const placements = useMemo<Placement[]>(() => {
    if (!projected) return [];

    const anchors = projected.map((shape) => {
      const [cx, cy] = centroid(shape.rings[0]);
      return { name: shape.name, cx, cy };
    });

    const midX = W / 2;
    const left = anchors.filter((a) => a.cx < midX).sort((a, b) => a.cy - b.cy);
    const right = anchors.filter((a) => a.cx >= midX).sort((a, b) => a.cy - b.cy);

    /**
     * Assign non-overlapping y positions inside the column.
     *
     * Sweep down enforcing a minimum gap, then sweep back up if the column
     * overran the bottom. Without the second pass a crowded column pushes
     * every label downward and the last few fall off the map.
     */
    const layout = (col: typeof anchors, lx: number): Placement[] => {
      const top = PAD_Y + LABEL_H / 2;
      const bottom = H - PAD_Y - LABEL_H / 2;
      const ys: number[] = [];
      let prev = -Infinity;
      for (const a of col) {
        const y = Math.max(a.cy, prev + LABEL_H, top);
        ys.push(y);
        prev = y;
      }
      for (let i = ys.length - 1; i >= 0; i--) {
        const limit = i === ys.length - 1 ? bottom : ys[i + 1] - LABEL_H;
        if (ys[i] > limit) ys[i] = limit;
      }
      return col.map((a, i) => ({
        name: a.name, cx: a.cx, cy: a.cy, lx, ly: ys[i], leader: true,
      }));
    };

    return [
      ...layout(left, GUTTER / 2 + 8),
      ...layout(right, W - GUTTER / 2 - 8),
    ];
  }, [projected]);


  const withCases = rows.filter((r) => r.total > 0).length;
  const mapped = projected?.length ?? 0;
  const unmapped = rows.filter((r) => !geo?.districts[r.districtName]).length;

  return (
    <div style={{
      position: "relative", display: "flex", flexDirection: "column",
      background: "white", border: "1px solid #cbd5e1",
      borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      // A fixed height, not minHeight. The SVG has no intrinsic size to push
      // back against, so an unbounded container let the map grow past the
      // bottom of the panel and off the screen.
      // Karnataka is portrait and this panel is landscape, so the state's
      // drawn width is capped by the panel HEIGHT, not by the gutters. Height
      // is the only lever that makes the map bigger.
      height: 660, width: "100%", overflow: "hidden",
    }}>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", borderBottom: "1px solid #cbd5e1",
        background: "#fafbfc", flexShrink: 0, gap: 12, flexWrap: "wrap",
      }}>
        <div>
          <span style={{
            fontFamily: "JetBrains Mono, monospace", fontWeight: 700,
            fontSize: 12.5, color: "#001f3f", textTransform: "uppercase", letterSpacing: 0.5,
          }}>
            Karnataka District Case Density
          </span>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
            {!loaded
              ? "Reading registered cases…"
              : loadError
              ? loadError
              : `${mapped} districts · ${withCases} with registered cases` +
                (unmapped > 0 ? ` · ${unmapped} without an outline` : "")}
          </div>
        </div>
          {/* Legend lives in the header: the map area is now callouts on
              both sides, and a floating legend covered them. */}
          <div style={{
            display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
            fontSize: 11, fontFamily: "JetBrains Mono, monospace", color: "#475569",
          }}>
            <span style={{ fontWeight: 700, color: "#001f3f" }}>THREAT INDEX</span>
            {BAND_LEGEND.map(({ band, label }) => (
              <span key={band} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{
                  width: 13, height: 13, borderRadius: 3,
                  background: band === "None" ? "#f1f5f9" : BAND_COLOR[band],
                  border: `1px solid ${band === "None" ? "#cbd5e1" : BAND_COLOR[band]}`,
                  display: "inline-block",
                }} />
                {label}
              </span>
            ))}
            {/*
              This qualifier moved with the legend and must not get lost: the
              index is a workload and severity indicator drawn from registered
              cases, and a shaded state map invites being read as a crime rate.
            */}
            <span style={{ color: "#94a3b8" }}>
              Workload and severity from registered cases — not a crime rate.
            </span>
          </div>
      </div>

      {/*
        minHeight:0 lets this flex child shrink. Without it the SVG — which has
        no intrinsic size to push back with — dictates the height and the map
        runs off the bottom of the panel.
      */}
      <div style={{
        flex: 1, minHeight: 0, position: "relative", padding: 8,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {!loaded || !projected ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            height: "100%", minHeight: 400,
            color: "#94a3b8", fontFamily: "JetBrains Mono, monospace",
            fontSize: 13.5, letterSpacing: 1,
          }}>
            {loadError ? loadError.toUpperCase() : "DRAWING DISTRICT MAP…"}
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: "100%", height: "100%", display: "block" }}
            role="img"
            aria-label="Karnataka districts shaded by registered case load"
          >
            <defs>
              {/* Districts with nothing registered are hatched, never shaded. */}
              <pattern id="orca-empty" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                <rect width="7" height="7" fill="#f8fafc" />
                <line x1="0" y1="0" x2="0" y2="7" stroke="#dbe3ec" strokeWidth="2.5" />
              </pattern>
            </defs>

            {/*
              PAINT ORDER MATTERS.
              Neighbours share a border, and SVG paints in document order — so
              every district drawn AFTER the selected one laid its own white
              stroke over half of the selected district's highlight. The
              highlight came out thick along the state's outer edge, where no
              later neighbour overlaps it, and thin everywhere it met a
              district drawn later. It read as a wobbly, uneven outline.

              Highlighted shapes are therefore drawn LAST, in a second pass, so
              nothing can paint over them.
            */}
            {[...projected]
              .sort((a, b) => Number(highlightRank(a.name)) - Number(highlightRank(b.name)))
              .map((shape) => {
                const row = byName.get(shape.name);
                const band = row?.threat.band ?? "None";
                const empty = !row || row.total === 0;
                const isSelected = row ? String(row.districtId) === selectedDistrictCode : false;
                const isHover = hover === shape.name;
                return (
                  <path
                    key={shape.name}
                    d={shape.d}
                    fill={empty ? "url(#orca-empty)" : BAND_COLOR[band]}
                    stroke={isSelected ? "#FF9933" : isHover ? "#7c8ea3" : "#ffffff"}
                    strokeWidth={isSelected ? 4 : isHover ? 2.6 : 1.8}
                    strokeLinejoin="round"
                    // Uniform join geometry: without this a sharp spike on a
                    // coastline gets mitred out into a long spur that looks
                    // like a thicker patch of border.
                    strokeMiterlimit={2}
                    opacity={isHover && !isSelected ? 0.85 : 1}
                    style={{ cursor: row ? "pointer" : "default", transition: "opacity .12s" }}
                    onMouseEnter={() => setHover(shape.name)}
                    onMouseLeave={() => setHover("")}
                    onClick={() => row && toggleDistrict(String(row.districtId))}
                  >
                    <title>
                      {shape.name}
                      {row ? ` — ${row.total} case${row.total === 1 ? "" : "s"}${row.total ? `, ${band}` : ""}` : ""}
                    </title>
                  </path>
                );
              })}

            {/*
              Leader lines, drawn under every label. Each runs from the
              district centroid to a short horizontal stub at the callout, so
              the line meets the text squarely instead of at an angle.
            */}
            {placements.map((p) => {
              const onLeft = p.lx < W / 2;
              const stub = onLeft ? p.lx + LABEL_W / 2 - 6 : p.lx - LABEL_W / 2 + 6;
              const isActive = hover === p.name ||
                (byName.get(p.name) && String(byName.get(p.name)!.districtId) === selectedDistrictCode);
              return (
                <g key={`l-${p.name}`} style={{ pointerEvents: "none" }}>
                  <polyline
                    points={`${stub},${p.ly} ${(stub + p.cx) / 2},${p.ly} ${p.cx},${p.cy}`}
                    fill="none"
                    stroke={isActive ? "#FF9933" : "#b8c4d2"}
                    strokeWidth={isActive ? 3 : 1.8}
                  />
                  <circle
                    cx={p.cx} cy={p.cy} r={isActive ? 6 : 4}
                    fill={isActive ? "#FF9933" : "#64748b"}
                  />
                </g>
              );
            })}

            {placements.map((p) => {
              const row = byName.get(p.name);
              const empty = !row || row.total === 0;
              const band = row?.threat.band ?? "None";
              const isSelected = row ? String(row.districtId) === selectedDistrictCode : false;
              const isActive = hover === p.name || isSelected;
              const onLeft = p.lx < W / 2;
              const value = !row ? "—" : String(row.total);
              return (
                <g
                  key={`t-${p.name}`}
                  style={{ cursor: row ? "pointer" : "default" }}
                  onMouseEnter={() => setHover(p.name)}
                  onMouseLeave={() => setHover("")}
                  onClick={() => row && toggleDistrict(String(row.districtId))}
                >
                  <rect
                    x={p.lx - LABEL_W / 2} y={p.ly - LABEL_H / 2 + 3}
                    width={LABEL_W} height={LABEL_H - 6} rx="6"
                    fill={isActive ? "rgba(255,153,51,0.12)" : "rgba(255,255,255,0.9)"}
                    stroke={isSelected ? "#FF9933" : "#dbe3ec"}
                    strokeWidth={isSelected ? 1.6 : 0.8}
                  />
                  {/* Band swatch — ties the callout to the colour on the map. */}
                  <rect
                    x={onLeft ? p.lx - LABEL_W / 2 + 12 : p.lx + LABEL_W / 2 - 28}
                    y={p.ly - 8}
                    width="16" height="16" rx="3"
                    fill={empty ? "#f1f5f9" : BAND_COLOR[band]}
                    stroke={empty ? "#cbd5e1" : BAND_COLOR[band]}
                    strokeWidth="1"
                  />
                  <text
                    x={onLeft ? p.lx - LABEL_W / 2 + 36 : p.lx + LABEL_W / 2 - 36}
                    y={p.ly + 7}
                    textAnchor={onLeft ? "start" : "end"}
                    style={{ fontSize: FONT_NAME, fontWeight: 600, fill: "#001f3f", fontFamily: "Inter, sans-serif" }}
                  >
                    {p.name}
                  </text>
                  <text
                    x={onLeft ? p.lx + LABEL_W / 2 - 12 : p.lx - LABEL_W / 2 + 12}
                    y={p.ly + 7}
                    textAnchor={onLeft ? "end" : "start"}
                    style={{
                      fontSize: FONT_VALUE, fontWeight: 800,
                      fill: empty ? "#b0bccb" : BAND_COLOR[band],
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    {value}
                    {row?.threat.provisional && row.total > 0 ? "*" : ""}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* ODbL requires the boundary source to be credited wherever it is shown. */}
      <div style={{
        position: "absolute", bottom: 6, left: 12, zIndex: 20,
        fontSize: 10, fontFamily: "JetBrains Mono, monospace", color: "#b6c2d1",
      }}>
        {geo?.attribution}
      </div>
    </div>
  );
};

/** Area-weighted centroid of a projected ring. */
function centroid(ring: [number, number][]): [number, number] {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[j];
    const [x1, y1] = ring[i];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  // A degenerate ring has zero signed area; fall back to the mean point rather
  // than dividing by zero and placing the label at NaN.
  if (Math.abs(a) < 1e-9) {
    const n = ring.length || 1;
    return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
  }
  a *= 3;
  return [cx / a, cy / a];
}
