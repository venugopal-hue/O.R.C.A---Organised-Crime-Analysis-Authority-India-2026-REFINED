import React, { useRef, useEffect, useState } from "react";
import { useIntelligence } from "@/context/IntelligenceContext";

export const Network: React.FC = () => {
  const { selectedSuspectId, setSelectedSuspectId } = useIntelligence();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 480 });

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width || 600,
          height: entry.contentRect.height || 480
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const width = dimensions.width;
  const height = dimensions.height;

  // Nodes positioning relative to container size
  const nodes = [
    { id: "sus-01", label: "Vikram Hegde", type: "suspect", color: "#FF3B30", x: width * 0.5, y: height * 0.45, info: "Intrusion Expert" },
    { id: "sus-02", label: "Ramesh Gowda", type: "suspect", color: "#FF9500", x: width * 0.3, y: height * 0.68, info: "Logistics Mule" },
    { id: "sus-03", label: "Priyanka Shenoy", type: "suspect", color: "#FF9500", x: width * 0.7, y: height * 0.68, info: "Shell Broker" },
    { id: "sus-04", label: "Gurudev Patil", type: "suspect", color: "#FF3B30", x: width * 0.25, y: height * 0.25, info: "Syndicate Kingpin" },
    { id: "phone-1", label: "Burner Ph: 99450", type: "item", color: "#007AFF", x: width * 0.5, y: height * 0.18, info: "Cell Node" },
    { id: "account-1", label: "SBI ending 2041", type: "item", color: "#34C759", x: width * 0.75, y: height * 0.35, info: "Escrow Ledger" },
    { id: "car-1", label: "KA-03-MM-8924", type: "item", color: "#8E8E93", x: width * 0.12, y: height * 0.52, info: "Bolero SUV" }
  ];

  const links = [
    { source: "sus-01", target: "sus-02", label: "Direct Coordination", flow: "forward" },
    { source: "sus-01", target: "sus-03", label: "Digital Cash Routing", flow: "forward" },
    { source: "sus-02", target: "car-1", label: "Operates Vehicle", flow: "reverse" },
    { source: "sus-01", target: "phone-1", label: "Device Registered", flow: "forward" },
    { source: "sus-03", target: "account-1", label: "Account Signatory", flow: "forward" },
    { source: "sus-04", target: "sus-02", label: "Sponsors Network", flow: "forward" },
    { source: "sus-04", target: "sus-01", label: "Infiltration Funding", flow: "forward" }
  ];

  const handleNodeClick = (nodeId: string) => {
    setSelectedSuspectId(nodeId);
  };

  return (
    <div 
      ref={containerRef} 
      style={{
        background: "#080f1e", // Tactical dark obsidian
        border: "1px solid #1e293b",
        borderRadius: 8,
        minHeight: 520,
        boxShadow: "inset 0 0 40px rgba(0, 0, 0, 0.85)",
        position: "relative",
        overflow: "hidden",
        height: "100%",
        width: "100%"
      }}
    >
      {/* Background glow vignette */}
      <div style={{
        position: "absolute",
        top: 0, left: 0, right: 0, bottom: 0,
        background: "radial-gradient(circle at 50% 50%, rgba(0, 122, 255, 0.1) 0%, transparent 80%)",
        pointerEvents: "none"
      }} />

      <svg 
        width="100%" 
        height="100%" 
        className="select-none"
        style={{
          width: "100%",
          height: "100%",
          userSelect: "none"
        }}
      >
        <defs>
          {/* Tactical grid pattern */}
          <pattern id="grid-tactical" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(30, 41, 59, 0.7)" strokeWidth="1" />
          </pattern>
          <pattern id="grid-tactical-large" width="150" height="150" patternUnits="userSpaceOnUse">
            <rect width="150" height="150" fill="url(#grid-tactical)" />
            <path d="M 150 0 L 0 0 0 150" fill="none" stroke="rgba(51, 65, 85, 0.5)" strokeWidth="1.5" />
          </pattern>
          
          {/* Glow Filters for Neon Contrast */}
          <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <style>
          {`
            @keyframes packetFlow {
              to {
                stroke-dashoffset: -30;
              }
            }
            .packet-line {
              stroke-dasharray: 10, 5;
              animation: packetFlow 0.8s linear infinite;
            }
            .node-interactive {
              transition: transform 0.2s cubic-bezier(0.1, 0.8, 0.3, 1);
            }
            .node-interactive:hover {
              transform: scale(1.1);
            }
          `}
        </style>

        {/* Blueprint tactical grid background */}
        <rect width="100%" height="100%" fill="url(#grid-tactical-large)" />

        {/* Draw Links */}
        {links.map((link, idx) => {
          const srcNode = nodes.find(n => n.id === link.source);
          const tgtNode = nodes.find(n => n.id === link.target);
          if (!srcNode || !tgtNode) return null;
          
          const midX = (srcNode.x + tgtNode.x) / 2;
          const midY = (srcNode.y + tgtNode.y) / 2;
          const isSelected = selectedSuspectId === link.source || selectedSuspectId === link.target;

          return (
            <g key={`link-${idx}`}>
              {/* Thick blurred glow background path */}
              <line 
                x1={srcNode.x} 
                y1={srcNode.y} 
                x2={tgtNode.x} 
                y2={tgtNode.y} 
                stroke={isSelected ? "rgba(255, 149, 0, 0.3)" : "rgba(0, 122, 255, 0.2)"} 
                strokeWidth={isSelected ? "8" : "5"} 
                filter="url(#neon-glow)"
              />
              {/* Sharp primary flow line */}
              <line 
                x1={srcNode.x} 
                y1={srcNode.y} 
                x2={tgtNode.x} 
                y2={tgtNode.y} 
                className="packet-line"
                stroke={isSelected ? "#FF9500" : "#007AFF"} 
                strokeWidth={isSelected ? "2.5" : "1.8"} 
                style={{
                  animationDirection: link.flow === "forward" ? "normal" : "reverse"
                }}
              />
              
              {/* Link label badge - LARGER and MORE CONTRASTING */}
              <g transform={`translate(${midX}, ${midY})`}>
                <rect 
                  x={-65} 
                  y={-10} 
                  width={130} 
                  height={20} 
                  fill="#060b13" 
                  stroke={isSelected ? "#FF9500" : "#334155"} 
                  strokeWidth="1.5"
                  rx={6} 
                />
                <text 
                  x={0} 
                  y={4} 
                  textAnchor="middle" 
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "9px",
                    fontWeight: 800,
                    fill: isSelected ? "#FF9500" : "#cbd5e1",
                    letterSpacing: "0.5px"
                  }}
                >
                  {link.label.toUpperCase()}
                </text>
              </g>
            </g>
          );
        })}

        {/* Draw Nodes */}
        {nodes.map(node => {
          const isSelected = selectedSuspectId === node.id;
          // Increased outer circle sizes for better prominence
          const rValue = node.type === "suspect" ? 22 : 16;
          const dotR = node.type === "suspect" ? 5.5 : 3.5;

          return (
            <g 
              key={`node-${node.id}`} 
              onClick={() => handleNodeClick(node.id)}
              className="node-interactive cursor-pointer"
              style={{
                transformBox: "fill-box",
                transformOrigin: "center"
              }}
            >
              {/* Node solid backdrop */}
              <circle 
                cx={node.x} 
                cy={node.y} 
                r={rValue} 
                fill="#050a14" 
                stroke={isSelected ? "#FF9500" : "#334155"} 
                strokeWidth="2.5"
              />

              {/* Glowing outer target indicators */}
              <circle 
                cx={node.x} 
                cy={node.y} 
                r={rValue - 4} 
                fill="none" 
                stroke={node.color} 
                strokeWidth={isSelected ? 2.5 : 1.5}
                filter="url(#neon-glow)"
              />

              {/* Center core dot */}
              <circle 
                cx={node.x} 
                cy={node.y} 
                r={dotR} 
                fill={isSelected ? "#FF9500" : node.color} 
                filter="url(#neon-glow)"
              />

              {/* Outer target crosshair tabs */}
              {node.type === "suspect" && (
                <g stroke={node.color} strokeWidth="1.5" opacity={isSelected ? 1 : 0.75}>
                  <line x1={node.x - rValue - 5} y1={node.y} x2={node.x - rValue + 1} y2={node.y} />
                  <line x1={node.x + rValue - 1} y1={node.y} x2={node.x + rValue + 5} y2={node.y} />
                  <line x1={node.x} y1={node.y - rValue - 5} x2={node.x} y2={node.y - rValue + 1} />
                  <line x1={node.x} y1={node.y + rValue - 1} x2={node.x} y2={node.y + rValue + 5} />
                </g>
              )}

              {/* Node Label Text Box - LARGER and MORE CONTRASTING */}
              <g transform={`translate(${node.x}, ${node.y + rValue + 15})`}>
                <rect 
                  x={-75} 
                  y={-8} 
                  width={150} 
                  height={32} 
                  fill="#040810" 
                  stroke={isSelected ? "#FF9500" : "#334155"} 
                  strokeWidth="1.8" 
                  rx={6}
                  style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.65))" }}
                />
                
                {/* Main Label - Bold 11.5px Text */}
                <text 
                  x={0} 
                  y={4} 
                  textAnchor="middle" 
                  style={{
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    fill: isSelected ? "#FFFFFF" : "#f1f5f9"
                  }}
                >
                  {node.label}
                </text>
                
                {/* Details subtitle - Bold 8px Text */}
                <text 
                  x={0} 
                  y={15} 
                  textAnchor="middle" 
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "8px",
                    fontWeight: 800,
                    fill: isSelected ? "#FF9500" : "#94a3b8",
                    letterSpacing: "0.5px"
                  }}
                >
                  {node.info.toUpperCase()}
                </text>
              </g>
            </g>
          );
        })}

      </svg>
    </div>
  );
};
