"use client";

import React, { useId, useState } from "react";

/**
 * Charts for the analytics panels — SVG, written by hand.
 *
 * No charting library is installed and none is added. Every other visual on
 * this platform (the district choropleth, the barcode, the letterhead) is
 * drawn directly, and a dependency that ships its own colour system, its own
 * fonts and its own tooltip markup would be the largest single source of UI
 * drift in a console whose whole rule is that new screens look like the old
 * ones.
 *
 * TWO THINGS EVERY CHART HERE DOES
 *
 *  1. An empty dataset renders as a stated empty state, never as an axis with
 *     nothing on it or a zero-radius circle. A blank chart reads as "loading"
 *     or "broken"; the words "no cases in this range" read as an answer.
 *
 *  2. Values are printed as well as drawn. An officer acting on a figure needs
 *     the figure, not an inference from a bar's length — the drawing is the
 *     summary, the number is the fact.
 */

const NAVY = "#001f3f";
const SAFFRON = "#FF9933";
const BORDER = "#cbd5e1";
const TEXT = "#1e293b";
const GRAY = "#475569";
const MUTED = "#94a3b8";
const MONO = "JetBrains Mono, monospace";

/**
 * Ordered so adjacent slices stay distinguishable, and so the first colour is
 * the platform's own navy rather than an arbitrary hue.
 */
export const SERIES_COLOURS = [
  "#1E3A8A", // navy blue
  "#FF9933", // saffron
  "#0E7490", // teal
  "#B91C1C", // red
  "#7C3AED", // violet
  "#047857", // green
  "#B45309", // amber
  "#BE185D", // rose
  "#4338CA", // indigo
  "#0F766E", // deep teal
  "#92400E", // brown
  "#475569", // slate
];

export const colourAt = (i: number) => SERIES_COLOURS[i % SERIES_COLOURS.length];

const EmptyChart: React.FC<{ height: number; message: string }> = ({ height, message }) => (
  <div
    style={{
      height,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: `1px dashed ${BORDER}`,
      borderRadius: 8,
      color: MUTED,
      fontSize: 12.5,
      textAlign: "center",
      padding: 16,
    }}
  >
    {message}
  </div>
);

export interface Datum {
  label: string;
  count: number;
  share?: number;
}

/* ── Donut ───────────────────────────────────────────────────────────────── */

const polar = (cx: number, cy: number, r: number, angle: number) => ({
  x: cx + r * Math.cos(angle - Math.PI / 2),
  y: cy + r * Math.sin(angle - Math.PI / 2),
});

/**
 * A donut, not a full pie: the hole carries the total, which is the number
 * most often wanted and would otherwise need its own caption.
 */
export const DonutChart: React.FC<{
  data: Datum[];
  height?: number;
  centreLabel?: string;
  emptyMessage?: string;
}> = ({ data, height = 240, centreLabel = "TOTAL", emptyMessage = "No cases in this range." }) => {
  const [active, setActive] = useState<number | null>(null);
  const slices = data.filter((d) => d.count > 0);
  const total = slices.reduce((sum, d) => sum + d.count, 0);

  if (!total) return <EmptyChart height={height} message={emptyMessage} />;

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const outer = 84;
  const inner = 52;

  let cursor = 0;
  const arcs = slices.map((d, i) => {
    const from = cursor;
    const sweep = (d.count / total) * Math.PI * 2;
    cursor += sweep;
    const to = cursor;

    // A single category is a complete ring; an arc path cannot express 360°
    // (start and end coincide) and collapses to nothing.
    const full = slices.length === 1;
    const p0 = polar(cx, cy, outer, from);
    const p1 = polar(cx, cy, outer, to);
    const p2 = polar(cx, cy, inner, to);
    const p3 = polar(cx, cy, inner, from);
    const large = to - from > Math.PI ? 1 : 0;

    const path = full
      ? `M ${cx} ${cy - outer} A ${outer} ${outer} 0 1 1 ${cx - 0.01} ${cy - outer} Z ` +
        `M ${cx} ${cy - inner} A ${inner} ${inner} 0 1 0 ${cx + 0.01} ${cy - inner} Z`
      : `M ${p0.x} ${p0.y} A ${outer} ${outer} 0 ${large} 1 ${p1.x} ${p1.y} ` +
        `L ${p2.x} ${p2.y} A ${inner} ${inner} 0 ${large} 0 ${p3.x} ${p3.y} Z`;

    return { ...d, path, colour: colourAt(i), index: i };
  });

  const shown = active !== null ? arcs[active] : null;

  return (
    <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        style={{ width: size, height, maxWidth: "100%", flexShrink: 0 }}
        role="img"
        aria-label={`Distribution across ${slices.length} categories, ${total} cases total`}
      >
        {arcs.map((a) => (
          <path
            key={a.label}
            d={a.path}
            fill={a.colour}
            fillRule="evenodd"
            opacity={active === null || active === a.index ? 1 : 0.28}
            stroke="#fff"
            strokeWidth={1}
            onMouseEnter={() => setActive(a.index)}
            onMouseLeave={() => setActive(null)}
            style={{ cursor: "default", transition: "opacity 120ms" }}
          />
        ))}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 0.6, fill: MUTED }}
        >
          {shown ? shown.label.slice(0, 16).toUpperCase() : centreLabel}
        </text>
        <text
          x={cx}
          y={cy + 16}
          textAnchor="middle"
          style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, fill: NAVY }}
        >
          {shown ? shown.count : total}
        </text>
      </svg>

      <div style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 6 }}>
        {arcs.map((a) => (
          <div
            key={a.label}
            onMouseEnter={() => setActive(a.index)}
            onMouseLeave={() => setActive(null)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12.5,
              opacity: active === null || active === a.index ? 1 : 0.5,
            }}
          >
            <span
              style={{ width: 10, height: 10, borderRadius: 2, background: a.colour, flexShrink: 0 }}
            />
            <span style={{ color: TEXT, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {a.label}
            </span>
            <span style={{ fontFamily: MONO, color: NAVY, fontWeight: 700 }}>{a.count}</span>
            <span style={{ fontFamily: MONO, color: MUTED, fontSize: 11, width: 46, textAlign: "right" }}>
              {Math.round((a.count / total) * 1000) / 10}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Waveform ────────────────────────────────────────────────────────────── */

/**
 * Smooth path through the points, with the curve CLAMPED so it cannot dip
 * below the data.
 *
 * An uncontrolled spline overshoots after a spike and draws a dip that is not
 * in the register — on a crime trend that is an invented quiet period. The
 * control points are held flat at local minima and maxima to stop it.
 */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  const d: string[] = [`M ${points[0].x} ${points[0].y}`];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const t = 0.2;
    let c1y = p1.y + ((p2.y - p0.y) / 6) * (t * 3);
    let c2y = p2.y - ((p3.y - p1.y) / 6) * (t * 3);

    const lo = Math.min(p1.y, p2.y);
    const hi = Math.max(p1.y, p2.y);
    c1y = Math.max(lo, Math.min(hi, c1y));
    c2y = Math.max(lo, Math.min(hi, c2y));

    const c1x = p1.x + (p2.x - p1.x) / 3;
    const c2x = p1.x + ((p2.x - p1.x) * 2) / 3;
    d.push(`C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`);
  }
  return d.join(" ");
}

export const WaveformChart: React.FC<{
  data: { bucket: string; count: number }[];
  height?: number;
  emptyMessage?: string;
  formatLabel?: (bucket: string) => string;
}> = ({ data, height = 220, emptyMessage = "No registrations in this range.", formatLabel }) => {
  const gradientId = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);

  if (!data.length) return <EmptyChart height={height} message={emptyMessage} />;

  const W = 720;
  const H = 220;
  const padL = 40;
  const padR = 12;
  const padT = 16;
  const padB = 34;

  const peak = Math.max(...data.map((d) => d.count));
  // A flat line of zeroes still needs a scale, or every y collapses onto the axis.
  const top = peak > 0 ? peak : 1;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xAt = (i: number) =>
    data.length === 1 ? padL + innerW / 2 : padL + (i / (data.length - 1)) * innerW;
  const yAt = (v: number) => padT + innerH - (v / top) * innerH;

  const points = data.map((d, i) => ({ x: xAt(i), y: yAt(d.count) }));
  const line = smoothPath(points);
  const area = line
    ? `${line} L ${points[points.length - 1].x} ${padT + innerH} L ${points[0].x} ${padT + innerH} Z`
    : "";

  // At most six gridline values, and only whole numbers — half a case is not a
  // thing that can be registered.
  const ticks = Array.from({ length: Math.min(5, top) + 1 }, (_, i) =>
    Math.round((top / Math.min(5, top)) * i)
  ).filter((v, i, a) => a.indexOf(v) === i);

  const labelEvery = Math.ceil(data.length / 8);
  /*
   * The final tick is always worth showing — it is the end of the window the
   * officer selected — but only when it does not land on top of the previous
   * one. At 30 daily points the regular ticks fall on index 28 and the forced
   * last on 29, and the two dates overprint.
   */
  const lastIndex = data.length - 1;
  const lastRegularTick = Math.floor(lastIndex / labelEvery) * labelEvery;
  const showLast = lastIndex - lastRegularTick >= Math.max(1, labelEvery * 0.6);
  const showLabelAt = (i: number) => (i === lastIndex ? showLast : i % labelEvery === 0);

  const active = hover !== null ? data[hover] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height, display: "block" }}
        role="img"
        aria-label={`Registration trend across ${data.length} periods, peak ${peak}`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SAFFRON} stopOpacity={0.45} />
            <stop offset="100%" stopColor={SAFFRON} stopOpacity={0.03} />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={yAt(t)} y2={yAt(t)} stroke={BORDER} strokeWidth={0.7} />
            <text
              x={padL - 8}
              y={yAt(t) + 4}
              textAnchor="end"
              style={{ fontFamily: MONO, fontSize: 10, fill: MUTED }}
            >
              {t}
            </text>
          </g>
        ))}

        {area && <path d={area} fill={`url(#${gradientId})`} />}
        {line && <path d={line} fill="none" stroke={SAFFRON} strokeWidth={2.2} strokeLinecap="round" />}

        {points.map((p, i) => (
          <g key={data[i].bucket}>
            {/* A wide invisible target: the dots are 3px and unhittable. */}
            <rect
              x={p.x - innerW / Math.max(data.length, 1) / 2}
              y={padT}
              width={Math.max(6, innerW / Math.max(data.length, 1))}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
            {(data.length <= 40 || hover === i) && (
              <circle
                cx={p.x}
                cy={p.y}
                r={hover === i ? 4.5 : 2.6}
                fill={hover === i ? NAVY : SAFFRON}
                stroke="#fff"
                strokeWidth={1.2}
              />
            )}
          </g>
        ))}

        {hover !== null && (
          <line
            x1={points[hover].x}
            x2={points[hover].x}
            y1={padT}
            y2={padT + innerH}
            stroke={NAVY}
            strokeWidth={0.8}
            strokeDasharray="3 3"
          />
        )}

        {data.map((d, i) =>
          showLabelAt(i) ? (
            <text
              key={`${d.bucket}-label`}
              x={xAt(i)}
              y={H - 12}
              textAnchor="middle"
              style={{ fontFamily: MONO, fontSize: 9.5, fill: MUTED }}
            >
              {formatLabel ? formatLabel(d.bucket) : d.bucket.slice(5)}
            </text>
          ) : null
        )}
      </svg>

      {active && (
        <div
          style={{
            position: "absolute",
            top: 4,
            right: 8,
            background: NAVY,
            color: "white",
            padding: "6px 10px",
            borderRadius: 6,
            fontSize: 11.5,
            fontFamily: MONO,
            pointerEvents: "none",
          }}
        >
          {formatLabel ? formatLabel(active.bucket) : active.bucket} — {active.count}
        </div>
      )}
    </div>
  );
};

/* ── Bars ────────────────────────────────────────────────────────────────── */

export const BarChart: React.FC<{
  data: Datum[];
  height?: number;
  emptyMessage?: string;
  onSelect?: (label: string) => void;
  colour?: string;
}> = ({ data, height, emptyMessage = "Nothing to show for this range.", onSelect, colour }) => {
  const rows = data.filter((d) => d.count > 0);
  if (!rows.length) return <EmptyChart height={height || 200} message={emptyMessage} />;

  const peak = Math.max(...rows.map((d) => d.count));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((d, i) => (
        <div
          key={d.label}
          onClick={onSelect ? () => onSelect(d.label) : undefined}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(90px, 30%) 1fr auto",
            alignItems: "center",
            gap: 10,
            cursor: onSelect ? "pointer" : "default",
          }}
        >
          <div
            title={d.label}
            style={{
              fontSize: 12,
              color: TEXT,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {d.label}
          </div>
          <div style={{ background: "#f1f5f9", borderRadius: 3, height: 16, overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.max(2, (d.count / peak) * 100)}%`,
                height: "100%",
                background: colour || colourAt(i),
                borderRadius: 3,
                transition: "width 200ms",
              }}
            />
          </div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: NAVY, fontWeight: 700, minWidth: 34, textAlign: "right" }}>
            {d.count}
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Vertical columns, for a fixed small set where the axis is the point — the
 * days of the week, where the shape of the week is what is being read.
 */
export const ColumnChart: React.FC<{
  data: Datum[];
  height?: number;
  emptyMessage?: string;
}> = ({ data, height = 180, emptyMessage = "No registrations in this range." }) => {
  const peak = Math.max(...data.map((d) => d.count), 0);
  if (!peak) return <EmptyChart height={height} message={emptyMessage} />;

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height, paddingTop: 18 }}>
      {data.map((d) => (
        <div
          key={d.label}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}
        >
          <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
            <div
              title={`${d.label}: ${d.count}`}
              style={{
                width: "100%",
                height: `${Math.max(2, (d.count / peak) * 100)}%`,
                background: d.count === peak ? SAFFRON : "#1E3A8A",
                borderRadius: "3px 3px 0 0",
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: -17,
                  left: 0,
                  right: 0,
                  textAlign: "center",
                  fontFamily: MONO,
                  fontSize: 10.5,
                  color: NAVY,
                  fontWeight: 700,
                }}
              >
                {d.count}
              </span>
            </div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: GRAY, marginTop: 6 }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
};
