"use client";

/**
 * Admin console data, fetched once.
 *
 * The console previously called `loadAdminData()` inside a `useEffect` keyed on
 * `adminTab`, and that function ran five Firestore collection reads in series.
 * Every tab switch re-read the entire database. This hook replaces all of it
 * with one request to /api/admin/overview, and only refetches when something is
 * actually asked to refresh.
 *
 * The legacy field names (`uid`, `badgeId`, `station`) are mapped here rather
 * than in the component, so there is exactly one place where the Catalyst shape
 * meets the screen. Where a legacy field has no honest source it is simply
 * absent — `badgeId` becomes the real `KGID`, and nothing invents a priority,
 * a document type or an IP address that the database does not hold.
 */

import { useCallback, useEffect, useState } from "react";

export interface AdminOfficerRow {
  uid: string;
  employeeId: number | null;
  name: string;
  badgeId: string; // Employee.KGID — the ER diagram's name for it
  email: string;
  mobile: string;
  rank: string;
  designation: string;
  station: string; // Unit.UnitName
  district: string;
  dashboardRole: string;
  clearanceLevel: string;
  active: boolean;
  accountStatus: string;
  lastLogin: string;
  photoUrl: string;
}

export interface AdminApplicationRow {
  id: string; // Firebase UID — the identity the approve/reject routes take
  applicationId: number | null;
  name: string;
  email: string;
  badgeId: string;
  mobile: string;
  rank: string;
  designation: string;
  station: string;
  district: string;
  postingType: string;
  requestedAccess: string;
  status: string;
  submittedAt: string;
  reviewedBy: string;
  reviewedAt: string;
  remarks: string;
  photoUrl: string;
  rankId: number | null;
  designationId: number | null;
  districtId: number | null;
  unitId: number | null;
}

export interface AdminAuditRow {
  logId: number | null;
  firebaseUid: string;
  changeType: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
  reason: string;
}

export interface AdminOverview {
  configured: boolean;
  officers: AdminOfficerRow[];
  officersUnavailable: string;
  applications: AdminApplicationRow[];
  audit: AdminAuditRow[];
  verifications: any[];
  failedScans: any[];
  sessions: any[];
  security: any[];
  securityBlindSpots: string[];
  analytics: any | null;
  aiQueries: any[];
  aiStats: any | null;
  notifications: any[];
  settings: Record<string, any>;
  settingSpecs: any[];
  reference: {
    ranks: { id: number; name: string }[];
    designations: { id: number; name: string }[];
    districts: { id: number; name: string }[];
    units: { id: number; name: string; districtId: number | null }[];
  };
  summary: Record<string, number>;
}

const EMPTY: AdminOverview = {
  configured: true,
  officers: [],
  officersUnavailable: "",
  applications: [],
  audit: [],
  verifications: [],
  failedScans: [],
  sessions: [],
  security: [],
  securityBlindSpots: [],
  analytics: null,
  aiQueries: [],
  aiStats: null,
  notifications: [],
  settings: {},
  settingSpecs: [],
  reference: { ranks: [], designations: [], districts: [], units: [] },
  summary: {},
};

export function useAdminOverview() {
  const [data, setData] = useState<AdminOverview>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/overview");
      const j = await res.json();
      if (!res.ok || !j.success) {
        throw new Error(j.error || `Request failed (${res.status})`);
      }

      setData({
        configured: j.configured !== false,
        officers: (j.officers || []).map((o: any) => ({
          uid: o.firebaseUid,
          employeeId: o.employeeId,
          name: o.name,
          badgeId: o.kgid,
          email: o.email,
          mobile: o.mobile,
          rank: o.rank,
          designation: o.designation,
          station: o.station,
          district: o.district,
          dashboardRole: o.dashboardRole,
          clearanceLevel: o.clearanceLevel,
          active: o.active,
          accountStatus: o.accountStatus,
          lastLogin: o.lastLogin,
          photoUrl: o.photoUrl,
        })),
        officersUnavailable: j.officersUnavailable || "",
        applications: (j.applications || []).map((a: any) => ({
          id: a.firebaseUid,
          applicationId: a.applicationId,
          name: a.fullName,
          email: a.email,
          badgeId: a.kgid,
          mobile: a.mobile,
          rank: a.rank,
          designation: a.designation,
          station: a.unit,
          district: a.district,
          postingType: a.postingType,
          requestedAccess: a.requestedAccess,
          status: a.status,
          submittedAt: a.submittedAt,
          reviewedBy: a.reviewedBy,
          reviewedAt: a.reviewedAt,
          remarks: a.remarks,
          photoUrl: a.photoUrl,
          rankId: a.rankId,
          designationId: a.designationId,
          districtId: a.districtId,
          unitId: a.unitId,
        })),
        audit: j.audit || [],
        verifications: j.verifications || [],
        failedScans: j.failedScans || [],
        sessions: j.sessions || [],
        security: j.security || [],
        securityBlindSpots: j.securityBlindSpots || [],
        analytics: j.analytics || null,
        aiQueries: j.aiQueries || [],
        aiStats: j.aiStats || null,
        notifications: j.notifications || [],
        settings: j.settings || {},
        settingSpecs: j.settingSpecs || [],
        reference: j.reference || EMPTY.reference,
        summary: j.summary || {},
      });
    } catch (e: any) {
      setError(e?.message || "Could not load administrative data.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Once on mount. Deliberately NOT keyed on the active tab — that is what made
  // every tab switch re-read the whole database.
  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
