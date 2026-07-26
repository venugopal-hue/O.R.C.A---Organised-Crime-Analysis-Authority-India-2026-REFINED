import React from "react";
import { useIntelligence } from "@/context/IntelligenceContext";

export const Intercepts: React.FC = () => {
  const { telemetryLogs } = useIntelligence();

  return (
    <div className="flex flex-col gap-1.5 h-full overflow-y-auto">
      {telemetryLogs.map((log, idx) => {
        let borderClass = "border-l-[#CBD5E1] bg-[#FAF9F6]";
        if (log.type === "danger") borderClass = "border-l-[#990000] bg-[#990000]/5";
        else if (log.type === "alert") borderClass = "border-l-[#E25C24] bg-[#E25C24]/5";
        else if (log.type === "success") borderClass = "border-l-[#0B6A61] bg-[#0B6A61]/5";

        return (
          <div 
            key={`log-${idx}`}
            className={`font-mono text-[11px] p-2 px-2.5 border-l-2.5 ${borderClass} border-t border-r border-b border-[#CBD5E1]/20 flex flex-col gap-0.5 rounded-[1px] animate-in fade-in slide-in-from-top-1 duration-150`}
          >
            <div className="flex justify-between text-[9px] text-[#64748B] uppercase font-semibold">
              <span>LOG-ID: {log.source}</span>
              <span>{log.timestamp} IST</span>
            </div>
            <div className="text-[#1E293B] leading-relaxed">
              {log.message}
            </div>
          </div>
        );
      })}
    </div>
  );
};
