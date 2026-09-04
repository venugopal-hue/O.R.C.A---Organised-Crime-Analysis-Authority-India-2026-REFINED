"use client";

import React from "react";

const CSS = `
@keyframes __orca_l4 { to { clip-path: inset(0 -1ch 0 0); } }
.__orca_loader {
  width: fit-content;
  font-weight: bold;
  font-family: monospace;
  font-size: 18px;
  color: #001f3f;
  clip-path: inset(0 3ch 0 0);
  animation: __orca_l4 1s steps(4) infinite;
}
.__orca_loader::before { content: "Loading..."; }
`;

interface Props {
  padding?: string | number;
}

export function OrcaLoader({ padding = "48px 24px" }: Props) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding }}>
      <style>{CSS}</style>
      <div className="__orca_loader" />
    </div>
  );
}
