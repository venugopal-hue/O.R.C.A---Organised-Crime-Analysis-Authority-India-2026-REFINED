import React from "react";

interface EmblemProps {
  className?: string;
  size?: number;
}

export const Emblem: React.FC<EmblemProps> = ({ className, size = 42 }) => {
  return (
    <div className={`flex items-center justify-center ${className || ""}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <circle cx="50" cy="50" r="46" fill="none" stroke="#E25C24" strokeWidth="2"/>
        <circle cx="50" cy="50" r="42" fill="#0A192F" stroke="#E25C24" strokeWidth="0.8"/>
        {/* Ashoka Lion Capital Emblem structure representation */}
        <path d="M50 16 L54 28 L66 28 L56 35 L60 47 L50 40 L40 47 L44 35 L34 28 L46 28 Z" fill="#E25C24"/>
        {/* Double-headed mythical eagle (Ganda Bherunda) representation */}
        <path d="M42 50 C42 42, 58 42, 58 50 C58 58, 42 58, 42 50 Z" fill="none" stroke="#FFFFFF" strokeWidth="1.8"/>
        <path d="M46 50 H54 M50 46 V54" stroke="#FFFFFF" strokeWidth="1.2"/>
        {/* Text descriptions */}
        <text x="50" y="80" textAnchor="middle" fontFamily="'Manrope', sans-serif" fontSize="6" fill="#F8F9FA" fontWeight="700" letterSpacing="0.05em">KARNATAKA POLICE</text>
        <text x="50" y="87" textAnchor="middle" fontFamily="'Manrope', sans-serif" fontSize="5" fill="#94A3B8" fontWeight="600">ರಾಜ್ಯ ಪೊಲೀಸ್</text>
      </svg>
    </div>
  );
};
