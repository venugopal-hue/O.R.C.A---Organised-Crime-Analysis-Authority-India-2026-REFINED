import React from "react";

interface OrcaBrandProps {
  href?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const OrcaBrand: React.FC<OrcaBrandProps> = ({
  href = "#",
  className = "",
  style
}) => {
  return (
    <a href={href} className={`nav-brand ${className}`.trim()} style={style}>
      <img
        src="/logo.png"
        alt="KSP Logo"
        style={{ width: "48px", height: "56px", objectFit: "contain" }}
      />
      <div className="nav-brand-text">
        <span className="nav-brand-main" data-i18n="nav_brand" style={{ color: "#FF9933" }}>
          O.R.C.A
        </span>
        <span className="nav-brand-sub" data-i18n="nav_sub">
          ORGANIZED CRIME ANALYSIS AUTHORITY
        </span>
      </div>
    </a>
  );
};
