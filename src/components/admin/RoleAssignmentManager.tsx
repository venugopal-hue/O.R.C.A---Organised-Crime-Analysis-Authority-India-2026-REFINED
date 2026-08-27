"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Rank,
  RANKS,
  RANK_DEFAULTS,
  IsdLevel,
  DashboardRole,
  DASHBOARD_ROLES,
} from "@/lib/permissions";
import { clearanceForRole, DEPRECATED_ROLES } from "@/lib/rbac";
import { CLEARANCE_LABEL } from "@/lib/clearance";
import {
  ShieldCheck,
  UserPlus,
  UserCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Award,
  Lock,
} from "lucide-react";

export const RoleAssignmentManager: React.FC = () => {
  const { dashboardRole, refreshClaims } = useAuth();

  // Form Mode: 'create' or 'assign'
  const [mode, setMode] = useState<"create" | "assign">("assign");

  // Fields for Assign Role to existing officer UID
  const [targetUid, setTargetUid] = useState("");
  const [selectedRank, setSelectedRank] = useState<Rank>("Inspector");
  const [selectedIsdLevel, setSelectedIsdLevel] = useState<IsdLevel>("ISD-LEVEL-IV");
  const [selectedDashboardRole, setSelectedDashboardRole] = useState<DashboardRole>("field_officer_l4");

  // Fields for Create Officer Profile
  const [badgeNumber, setBadgeNumber] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [station, setStation] = useState("KSP Head Quarters");

  // UI status
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // When Rank dropdown changes, prefill ISD clearance level and dashboard role from RANK_DEFAULTS
  const handleRankChange = (rank: Rank) => {
    setSelectedRank(rank);
    const defaults = RANK_DEFAULTS[rank];
    if (defaults) {
      setSelectedDashboardRole(defaults.dashboardRole);
      // Clearance follows the ROLE, not the rank's stored level — the two can
      // disagree, and set-role rejects the pair when they do.
      setSelectedIsdLevel(
        (clearanceForRole(defaults.dashboardRole) || defaults.isdLevel) as IsdLevel
      );
    }
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setToast(null);

    try {
      const res = await fetch("/api/admin/rbac/set-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUid: targetUid.trim(),
          isdLevel: selectedIsdLevel,
          dashboardRole: selectedDashboardRole,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to assign RBAC role.");
      }

      // Force immediate client ID token refresh
      await refreshClaims();

      setToast({
        type: "success",
        message: `Clearance updated: UID ${targetUid} granted ${selectedIsdLevel} & ${selectedDashboardRole}. Token refreshed.`,
      });
      setTargetUid("");
    } catch (err: any) {
      setToast({
        type: "error",
        message: err.message || "An unexpected error occurred assigning role.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setToast(null);

    try {
      const res = await fetch("/api/admin/rbac/create-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          badgeNumber: badgeNumber.trim(),
          name: name.trim(),
          email: email.trim(),
          rank: selectedRank,
          station: station.trim(),
          overrideIsdLevel: selectedIsdLevel,
          overrideDashboardRole: selectedDashboardRole,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create officer profile.");
      }

      await refreshClaims();

      setToast({
        type: "success",
        message: `Officer profile provisioned successfully for ${name} (${selectedRank}) with ${selectedIsdLevel} clearance.`,
      });
      setBadgeNumber("");
      setName("");
      setEmail("");
    } catch (err: any) {
      setToast({
        type: "error",
        message: err.message || "An unexpected error occurred creating profile.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Derived from RBAC_CONFIG rather than listed by hand — a role added there
  // with role_assignment must not need a second edit here to work.
  const isAuthorized = Boolean(
    dashboardRole && DASHBOARD_ROLES[dashboardRole]?.modules.includes("role_assignment")
  );

  if (!isAuthorized) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-900 font-mono text-xs font-semibold">
        ACCESS DENIED: Three-Layer RBAC assignment requires Administrative Dashboard clearance (DGP Full Admin or Level 2 Admin).
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#001f3f] text-white p-5 rounded-lg border border-slate-700 shadow-md">
        <div>
          <div className="flex items-center gap-2 text-[#FF9933] font-mono text-xs font-bold uppercase tracking-wider">
            <Award className="w-4 h-4" /> Three-Layer RBAC Control Console
          </div>
          <h2 className="text-lg font-bold mt-1">Officer Clearance & Role Management</h2>
          <p className="text-xs text-slate-300">
            Configure layered organizational Rank, ISD Clearance Level, and functional Dashboard Role.
          </p>
        </div>

        <div className="flex bg-slate-800/80 p-1 rounded-md border border-slate-700">
          <button
            type="button"
            onClick={() => setMode("assign")}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
              mode === "assign"
                ? "bg-[#FF9933] text-white shadow"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Modify Existing Officer
          </button>
          <button
            type="button"
            onClick={() => setMode("create")}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
              mode === "create"
                ? "bg-[#FF9933] text-white shadow"
                : "text-slate-300 hover:text-white"
            }`}
          >
            Provision New Officer
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {toast && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg border text-xs font-mono ${
            toast.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300"
              : "bg-red-950/40 border-red-500/50 text-red-300"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Form Card */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
        <form onSubmit={mode === "assign" ? handleAssignRole : handleCreateProfile} className="space-y-6">
          {mode === "create" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-200">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Officer Badge ID / Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KSP-BLR-4092"
                  value={badgeNumber}
                  onChange={(e) => setBadgeNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-[#001f3f]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inspector Suresh Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-[#001f3f]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Official Police Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. officer@ksp.gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-[#001f3f]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Station / Division
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cyber Crime Unit Bengaluru"
                  value={station}
                  onChange={(e) => setStation(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-[#001f3f]"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Target Officer User ID (UID)
              </label>
              <input
                type="text"
                required
                placeholder="Enter exact Firebase Auth UID of target officer"
                value={targetUid}
                onChange={(e) => setTargetUid(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-[#001f3f]"
              />
            </div>
          )}

          {/* Three-Layer Attribute Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. RANK */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#001f3f] mb-1">
                1. Organizational Rank
              </label>
              <p className="text-[11px] text-slate-500 mb-3">
                Sets org-chart hierarchy & pre-fills default clearance level.
              </p>
              <select
                value={selectedRank}
                onChange={(e) => handleRankChange(e.target.value as Rank)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white font-medium focus:outline-none focus:border-[#001f3f]"
              >
                {RANKS.map((rank) => (
                  <option key={rank} value={rank}>
                    {rank}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. ISD CLEARANCE LEVEL */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#001f3f] mb-1">
                2. Security Clearance
              </label>
              <p className="text-[11px] text-slate-500 mb-3">
                Governs access to Forensic Copilot &amp; sensitive evidence. Set by the role.
              </p>
              {/*
                Shown, not chosen — see the same change in the approval modal.

                set-role derives the clearance from the role and REJECTS a
                disagreeing pair, so every combination the administrator did not
                match by hand came back a 400. The list here also only held ISD
                levels, which made the O.R.C.A and SCRB roles impossible to pair
                at all.
              */}
              <div className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-slate-100 font-medium text-slate-800">
                {selectedIsdLevel || "—"}
                {CLEARANCE_LABEL[selectedIsdLevel as keyof typeof CLEARANCE_LABEL]
                  ? ` — ${CLEARANCE_LABEL[selectedIsdLevel as keyof typeof CLEARANCE_LABEL]}`
                  : ""}
              </div>
            </div>

            {/* 3. DASHBOARD ROLE */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#001f3f] mb-1">
                3. Dashboard Functional Role
              </label>
              <p className="text-[11px] text-slate-500 mb-3">
                Governs sidebar tabs & rendered UI platforms.
              </p>
              <select
                value={selectedDashboardRole}
                onChange={(e) => {
                  const role = e.target.value as DashboardRole;
                  setSelectedDashboardRole(role);
                  setSelectedIsdLevel(clearanceForRole(role) as IsdLevel);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white font-medium focus:outline-none focus:border-[#001f3f]"
              >
                {/*
                  Deprecated roles are filtered out. `admin_scrb` renders with
                  the same words as `scrb_officer`, so leaving it here gave the
                  administrator two identical-looking options, one of which puts
                  a new officer on a role that is scheduled for deletion.
                */}
                {Object.entries(DASHBOARD_ROLES)
                  .filter(([roleKey]) => !DEPRECATED_ROLES.has(roleKey))
                  .map(([roleKey, config]) => (
                    <option key={roleKey} value={roleKey}>
                      {config.label}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#001f3f] hover:bg-[#002855] text-white text-xs font-bold uppercase tracking-wider rounded transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  APPLYING LAYERED CLEARANCE...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-[#FF9933]" />
                  {mode === "assign" ? "Save Role & Refresh Claims" : "Provision Officer & Claims"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
