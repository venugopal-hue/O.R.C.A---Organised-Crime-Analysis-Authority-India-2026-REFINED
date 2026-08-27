"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
} from "d3-force";
import { Download } from "lucide-react";

/**
 * The relation graph renderer.
 *
 * It used to hard-code a criminal network — four named suspects, a burner
 * phone, a bank account "ending 2041", labelled edges like "Digital Cash
 * Routing" — rendered identically for every officer. That is gone. This
 * component now draws WHATEVER graph it is handed and makes no claim about the
 * data: the truth lives in the record-backed builders in src/lib/networkGraph.ts.
 *
 * A node's `verified` flag is the one honesty signal it renders: solid means a
 * real record, hollow-and-dashed means "from the officer's notes, unconfirmed".
 *
 * Layout is d3-force, ticked to rest synchronously before the first paint so
 * the graph appears settled rather than exploding into place. Positions, pan
 * and zoom are cached per graph so re-selecting a node (which recolours it)
 * does not throw the layout away.
 */

export interface GraphNodeData {
  id: string;
  label: string;
  kind: string;
  verified: boolean;
  detail?: { label: string; value: string }[];
  crimeNo?: string;
  caseMasterId?: string;
}
export interface GraphLinkData {
  source: string;
  target: string;
  label: string;
}
export interface NetworkProps {
  data: { nodes: GraphNodeData[]; links: GraphLinkData[] };
  selectedId?: string | null;
  onSelect?: (node: GraphNodeData) => void;
}

interface Positioned extends GraphNodeData {
  x: number;
  y: number;
}

const KIND_STYLE: Record<string, { fill: string; icon: string; shape: "circle" | "rect" }> = {
  case: { fill: "#FF9933", icon: "📁", shape: "rect" },
  accused: { fill: "#ef4444", icon: "👤", shape: "circle" },
  victim: { fill: "#10b981", icon: "🛡️", shape: "circle" },
  complainant: { fill: "#38bdf8", icon: "📣", shape: "circle" },
  officer: { fill: "#6366f1", icon: "🚔", shape: "circle" },
  station: { fill: "#94a3b8", icon: "🏢", shape: "rect" },
};
const styleOf = (kind: string) => KIND_STYLE[kind] || { fill: "#64748b", icon: "●", shape: "circle" as const };

/** Cache key over structure only (ids + edges), so a recolour reuses the layout. */
const cacheKey = (data: NetworkProps["data"]) =>
  data.nodes.map((n) => n.id).sort().join("|") +
  "::" +
  data.links.map((l) => `${l.source}-${l.target}`).sort().join("|");

const layoutCache = new Map<string, { nodes: Positioned[]; transform: { x: number; y: number; scale: number } }>();

function computeForceLayout(
  nodes: GraphNodeData[],
  links: GraphLinkData[],
  width: number,
  height: number
): Positioned[] {
  // d3-force mutates in place, so clone. Seed near centre with jitter so
  // coincident start points do not blow the simulation apart.
  const simNodes: any[] = nodes.map((n) => ({
    ...n,
    x: width / 2 + (Math.random() - 0.5) * 60,
    y: height / 2 + (Math.random() - 0.5) * 60,
  }));
  const simLinks: any[] = links.map((l) => ({ source: l.source, target: l.target }));

  const sim = forceSimulation(simNodes)
    .force("link", forceLink(simLinks).id((d: any) => d.id).distance(150))
    .force("charge", forceManyBody().strength(-1200))
    .force("center", forceCenter(width / 2, height / 2))
    .force("collide", forceCollide().radius((d: any) => (d.kind === "case" ? 60 : 50)))
    .force("x", forceX(width / 2).strength(0.04))
    .force("y", forceY(height / 2).strength(0.04))
    .stop();

  for (let i = 0; i < 300; i++) sim.tick();
  return simNodes.map((n) => ({ ...(n as Positioned) }));
}

export const Network: React.FC<NetworkProps> = ({ data, selectedId, onSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dim, setDim] = useState({ width: 700, height: 520 });

  const [nodes, setNodes] = useState<Positioned[]>([]);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });

  const draggingRef = useRef<string | null>(null);
  const panningRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setDim({ width: e.contentRect.width || 700, height: e.contentRect.height || 520 });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const key = useMemo(() => cacheKey(data), [data]);

  // Lay out on structural change; reuse cached positions/pan/zoom otherwise, but
  // re-merge the incoming node fields (colour/verified/detail can change).
  useEffect(() => {
    const cached = layoutCache.get(key);
    if (cached) {
      const byId = new Map(data.nodes.map((n) => [n.id, n]));
      setNodes(cached.nodes.map((c) => ({ ...c, ...(byId.get(c.id) || {}) }) as Positioned));
      setTransform(cached.transform);
      return;
    }
    const laid = computeForceLayout(data.nodes, data.links, dim.width, dim.height);

    // Auto-fit: frame the whole graph, never zooming in past 1:1.
    const xs = laid.map((n) => n.x), ys = laid.map((n) => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 80;
    const gw = maxX - minX + pad * 2, gh = maxY - minY + pad * 2;
    const scale = Math.min(1, Math.min(dim.width / gw, dim.height / gh)) || 1;
    const tx = dim.width / 2 - ((minX + maxX) / 2) * scale;
    const ty = dim.height / 2 - ((minY + maxY) / 2) * scale;
    const tf = { x: tx, y: ty, scale };

    setNodes(laid);
    setTransform(tf);
    layoutCache.set(key, { nodes: laid, transform: tf });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, dim.width, dim.height]);

  // Persist dragged positions / pan / zoom back into the cache for this graph.
  const persist = useCallback((nextNodes: Positioned[], nextTf: { x: number; y: number; scale: number }) => {
    layoutCache.set(key, { nodes: nextNodes, transform: nextTf });
  }, [key]);

  /* ── Zoom: native non-passive wheel, so preventDefault actually works ───── */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setTransform((t) => {
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        const scale = Math.max(0.2, Math.min(4, t.scale * factor));
        const rect = svg.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        // Zoom toward the cursor.
        const nx = mx - (mx - t.x) * (scale / t.scale);
        const ny = my - (my - t.y) * (scale / t.scale);
        const next = { x: nx, y: ny, scale };
        persist(nodesRef.current, next);
        return next;
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [persist]);

  // Keep a ref of current nodes for use inside imperative handlers.
  const nodesRef = useRef<Positioned[]>([]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  const onNodePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    draggingRef.current = id;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const node = nodes.find((n) => n.id === id);
    if (node && onSelect) onSelect(node);
  };
  const onSvgPointerDown = (e: React.PointerEvent) => {
    panningRef.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (draggingRef.current) {
      const svg = svgRef.current!;
      const rect = svg.getBoundingClientRect();
      const gx = (e.clientX - rect.left - transform.x) / transform.scale;
      const gy = (e.clientY - rect.top - transform.y) / transform.scale;
      setNodes((prev) => {
        const next = prev.map((n) => (n.id === draggingRef.current ? { ...n, x: gx, y: gy } : n));
        persist(next, transform);
        return next;
      });
    } else if (panningRef.current) {
      const next = { ...transform, x: e.clientX - panningRef.current.x, y: e.clientY - panningRef.current.y };
      setTransform(next);
      persist(nodesRef.current, next);
    }
  };
  const endInteraction = () => { draggingRef.current = null; panningRef.current = null; };

  const nodePos = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  /* ── PNG export ──────────────────────────────────────────────────────────── */
  const exportImage = () => {
    const svg = svgRef.current;
    if (!svg || !nodes.length) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;

    const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
    const pad = 100;
    const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
    const w = Math.max(...xs) - Math.min(...xs) + pad * 2;
    const h = Math.max(...ys) - Math.min(...ys) + pad * 2;
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    clone.setAttribute("viewBox", `${minX} ${minY} ${w} ${h}`);
    // Strip the pan/zoom transform from the master group so the crop is by
    // content, not by wherever the user last panned. The master group is
    // tagged explicitly so this can never grab a nested label group by mistake.
    clone.querySelector('[data-role="master"]')?.removeAttribute("transform");
    clone.querySelectorAll("rect[data-role='grid']").forEach((r) => r.removeAttribute("transform"));

    const svgStr = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#080f1e";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = "relation-graph.png";
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgStr)));
  };

  return (
    <div ref={containerRef} style={{ background: "#080f1e", border: "1px solid #1e293b", borderRadius: 8, position: "relative", overflow: "hidden", height: "100%", width: "100%", minHeight: 520 }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 50%, rgba(0,122,255,0.1) 0%, transparent 80%)", pointerEvents: "none" }} />

      <button
        onClick={exportImage}
        style={{ position: "absolute", top: 12, right: 12, zIndex: 5, background: "rgba(255,153,51,0.9)", color: "#001f3f", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
      >
        <Download style={{ width: 13, height: 13 }} /> Export Image
      </button>

      <svg
        ref={svgRef}
        width="100%" height="100%"
        style={{ userSelect: "none", cursor: panningRef.current ? "grabbing" : "grab", display: "block" }}
        onPointerDown={onSvgPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endInteraction}
        onPointerLeave={endInteraction}
      >
        <defs>
          <pattern id="grid-net" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(30,41,59,0.7)" strokeWidth="1" />
          </pattern>
          <marker id="arrow-net" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(148,163,184,0.7)" />
          </marker>
        </defs>
        <rect data-role="grid" width="100%" height="100%" fill="url(#grid-net)" />

        <g data-role="master" transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {/* Links */}
          {data.links.map((l, i) => {
            const a = nodePos.get(l.source), b = nodePos.get(l.target);
            if (!a || !b) return null;
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            const w = Math.max(70, l.label.length * 6.5 + 16);
            return (
              <g key={`l-${i}`}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(148,163,184,0.45)" strokeWidth={1.5} markerEnd="url(#arrow-net)" />
                <g transform={`translate(${mx},${my})`}>
                  <rect x={-w / 2} y={-9} width={w} height={18} rx={9} fill="rgba(8,15,30,0.92)" stroke="rgba(148,163,184,0.35)" />
                  <text textAnchor="middle" dy={4} fontSize={10} fill="#cbd5e1" fontFamily="Inter, sans-serif">{l.label}</text>
                </g>
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((n) => {
            const st = styleOf(n.kind);
            const selected = n.id === selectedId;
            const r = n.kind === "case" ? 30 : 26;
            const labelW = Math.max(90, n.label.length * 7 + 20);
            return (
              <g key={n.id} transform={`translate(${n.x},${n.y})`} style={{ cursor: "pointer" }}
                 onPointerDown={(e) => onNodePointerDown(e, n.id)}>
                {selected && (
                  st.shape === "rect"
                    ? <rect x={-r - 6} y={-r - 6} width={(r + 6) * 2} height={(r + 6) * 2} rx={12} fill="none" stroke="#FF9933" strokeWidth={2.5} />
                    : <circle r={r + 6} fill="none" stroke="#FF9933" strokeWidth={2.5} />
                )}
                {st.shape === "rect" ? (
                  <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={10}
                        fill={n.verified ? st.fill : "transparent"}
                        stroke={st.fill} strokeWidth={n.verified ? 0 : 2}
                        strokeDasharray={n.verified ? undefined : "5 4"} opacity={n.verified ? 1 : 0.9} />
                ) : (
                  <circle r={r}
                          fill={n.verified ? st.fill : "transparent"}
                          stroke={st.fill} strokeWidth={n.verified ? 0 : 2}
                          strokeDasharray={n.verified ? undefined : "5 4"} opacity={n.verified ? 1 : 0.9} />
                )}
                <text textAnchor="middle" dy={6} fontSize={20}>{st.icon}</text>

                {/* Name pill under the node */}
                <g transform={`translate(0,${r + 16})`}>
                  <rect x={-labelW / 2} y={-11} width={labelW} height={22} rx={11}
                        fill="rgba(8,15,30,0.9)" stroke={selected ? "#FF9933" : "rgba(148,163,184,0.3)"} />
                  <text textAnchor="middle" dy={4} fontSize={11} fontWeight={600}
                        fill={n.verified ? "#f1f5f9" : "#94a3b8"} fontFamily="Inter, sans-serif">
                    {n.label.length > 22 ? n.label.slice(0, 21) + "…" : n.label}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Legend */}
      <div style={{ position: "absolute", bottom: 10, left: 12, display: "flex", flexWrap: "wrap", gap: 10, fontSize: 10, color: "#94a3b8", fontFamily: "Inter, sans-serif", background: "rgba(8,15,30,0.7)", padding: "6px 10px", borderRadius: 6 }}>
        {Object.entries(KIND_STYLE).map(([k, v]) => (
          <span key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 9, height: 9, borderRadius: v.shape === "rect" ? 2 : "50%", background: v.fill, display: "inline-block" }} /> {k}
          </span>
        ))}
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", border: "1.5px dashed #94a3b8", display: "inline-block" }} /> unverified
        </span>
      </div>
    </div>
  );
};
