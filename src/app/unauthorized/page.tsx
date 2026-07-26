"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#001f3f] text-white p-6">
      <div className="max-w-md w-full bg-[#002855] border border-red-500/40 rounded-lg p-8 text-center shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-xl font-bold font-mono tracking-wide text-white uppercase mb-2">
          Clearance Level Denied
        </h1>
        <p className="text-sm text-slate-300 mb-6 leading-relaxed">
          Your current ISD Clearance Level or Dashboard Role does not authorize access to this command module. All access attempts are logged under ISD telemetry audits.
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FF9933] hover:bg-[#e88825] text-white font-semibold text-xs rounded uppercase tracking-wider transition"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Command Overview
        </button>
      </div>
    </div>
  );
}
