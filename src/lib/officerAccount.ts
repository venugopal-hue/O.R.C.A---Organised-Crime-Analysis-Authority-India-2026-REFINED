/**
 * O.R.C.A — officer accounts on Catalyst (SERVER-SIDE ONLY).
 *
 * The split, decided with the user:
 *
 *   Firebase Auth  ->  email, password, password reset, session token, UID
 *   Catalyst       ->  everything else about the officer
 *
 * `OfficerAccount.FirebaseUID` is the single field joining the two. Firebase
 * says "this is user abc123"; Catalyst holds the row where FirebaseUID = abc123.
 * Nothing here ever touches a credential.
 *
 * Matching the ER diagram (Police_FIR_ER_Diagram.pdf):
 *
 *   - Posting details are NOT duplicated here. District, Unit, Rank and
 *     Designation live on `Employee`, exactly as the PDF defines them, and are
 *     joined in on read. Two answers to "where is this officer posted" is the
 *     bug this avoids.
 *   - `Employee.KGID` (Karnataka Government ID) is the ER's name for what the
 *     app has been calling `badgeId`. The app term is mapped to the ER column,
 *     not the other way round.
 *   - `Active` mirrors the ER's `Active BIT` convention. `AccountStatus` carries
 *     the richer value the app already sets (active|suspended|inactive|rejected).
 *
 * Deliberate deviation: there is no `RoleMaster` lookup table, even though the
 * ER is lookup-driven elsewhere. A role's allowed tabs are defined in
 * RBAC_CONFIG in src/lib/rbac.ts, so a database copy of the role list would be a
 * second source of truth that can silently drift from the code that enforces it.
 * Role and clearance are plain strings whose values match `DashboardRoleType`.
 */

import { getAllRows, insertRows, updateRows, isCatalystConfigured, nextId } from "@/lib/catalyst";

export const OFFICER_ACCOUNT_TABLE = "OfficerAccount";
export const EMPLOYEE_TABLE = "Employee";

/** What the app works with — the two tables already joined. */
export interface OfficerProfile {
  firebaseUid: string;
  accountId: number | null;
  employeeId: number | null;
  email: string;
  mobile: string;
  name: string;
  kgid: string;
  dashboardRole: string;
  clearanceLevel: string;
  permissions: Record<string, any>;
  active: boolean;
  accountStatus: string;
  lastLogin: string;
  photoUrl: string;
  // Joined from Employee -> Rank / Designation / Unit / District.
  rank: string;
  designation: string;
  station: string;
  district: string;
}

/**
 * True when the account tables are absent or unreachable, so callers can say so
 * honestly instead of pretending an officer has no profile. Same contract as
 * /api/verification/history: a missing table is a configuration state, not an
 * error, and must never read as "this officer does not exist".
 */
export class OfficerAccountUnavailableError extends Error {
  constructor(public readonly reason: string) {
    super(`Officer accounts unavailable: ${reason}`);
    this.name = "OfficerAccountUnavailableError";
  }
}

const isMissingTable = (err: any): boolean => {
  const m = String(err?.message || "");
  return m.includes("(404)") || /no such resource|does not exist|INVALID_URL_PATTERN/i.test(m);
};

/** Catalyst wraps each row as { TableName: {...} } on reads. */
const unwrap = (row: any, table: string) => (row && row[table]) || row || {};

const str = (v: any) => (v === null || v === undefined ? "" : String(v));

const parsePermissions = (raw: any): Record<string, any> => {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    // A malformed blob must not take down the whole profile read.
    return {};
  }
};

/**
 * Read every officer profile, with Employee and its reference tables joined.
 *
 * Like the rest of the platform this is a full-table read; the Self Client
 * token has no ZohoCatalyst.zcql.READ scope, so there is no WHERE clause to be
 * had (see catalyst.ts nextId for the same note). Fine at present volumes.
 */
export async function listOfficerProfiles(): Promise<OfficerProfile[]> {
  if (!isCatalystConfigured()) {
    throw new OfficerAccountUnavailableError("Catalyst credentials are not set");
  }

  let accounts: any[];
  try {
    accounts = await getAllRows(OFFICER_ACCOUNT_TABLE);
  } catch (err: any) {
    if (isMissingTable(err)) {
      throw new OfficerAccountUnavailableError(`${OFFICER_ACCOUNT_TABLE} table does not exist yet`);
    }
    throw err;
  }

  // Employee and its lookups. Any of these being empty is survivable — the
  // profile just comes back with blank posting details rather than failing.
  const [employees, ranks, designations, units, districts] = await Promise.all([
    getAllRows(EMPLOYEE_TABLE).catch(() => []),
    getAllRows("Rank").catch(() => []),
    getAllRows("Designation").catch(() => []),
    getAllRows("Unit").catch(() => []),
    getAllRows("District").catch(() => []),
  ]);

  const byId = (rows: any[], table: string, idCol: string) => {
    const map = new Map<string, any>();
    rows.forEach((r) => {
      const rec = unwrap(r, table);
      const id = str(rec[idCol]);
      if (id) map.set(id, rec);
    });
    return map;
  };

  const employeeById = byId(employees, EMPLOYEE_TABLE, "EmployeeID");
  const rankById = byId(ranks, "Rank", "RankID");
  const designationById = byId(designations, "Designation", "DesignationID");
  const unitById = byId(units, "Unit", "UnitID");
  const districtById = byId(districts, "District", "DistrictID");

  return accounts.map((row) => {
    const a = unwrap(row, OFFICER_ACCOUNT_TABLE);
    const emp = employeeById.get(str(a.EmployeeID)) || {};

    return {
      firebaseUid: str(a.FirebaseUID),
      accountId: a.AccountID != null ? Number(a.AccountID) : null,
      employeeId: a.EmployeeID != null ? Number(a.EmployeeID) : null,
      email: str(a.Email),
      mobile: str(a.Mobile),
      name: str(emp.FirstName),
      kgid: str(emp.KGID),
      dashboardRole: str(a.DashboardRole),
      clearanceLevel: str(a.ClearanceLevel),
      permissions: parsePermissions(a.Permissions),
      // Catalyst booleans come back as true/false, but a text fallback column
      // would give "true"/"false" — accept both.
      active: a.Active === true || String(a.Active).toLowerCase() === "true",
      accountStatus: str(a.AccountStatus),
      lastLogin: str(a.LastLogin),
      photoUrl: str(a.PhotoUrl),
      rank: str(rankById.get(str(emp.RankID))?.RankName),
      designation: str(designationById.get(str(emp.DesignationID))?.DesignationName),
      station: str(unitById.get(str(emp.UnitID))?.UnitName),
      district: str(districtById.get(str(emp.DistrictID))?.DistrictName),
    };
  });
}

/** One officer by Firebase UID, or null when there is no row for them. */
export async function getOfficerProfile(firebaseUid: string): Promise<OfficerProfile | null> {
  const uid = String(firebaseUid || "").trim();
  if (!uid) return null;
  const all = await listOfficerProfiles();
  return all.find((p) => p.firebaseUid === uid) || null;
}

/** Fields a caller may set. Anything not listed here is ignored on write. */
export interface OfficerAccountWrite {
  employeeId?: number | null;
  email?: string;
  mobile?: string;
  dashboardRole?: string;
  clearanceLevel?: string;
  permissions?: Record<string, any>;
  active?: boolean;
  accountStatus?: string;
  lastLogin?: string;
  photoUrl?: string;
}

const toRow = (patch: OfficerAccountWrite): Record<string, any> => {
  const row: Record<string, any> = {};
  if (patch.employeeId !== undefined) row.EmployeeID = patch.employeeId;
  if (patch.email !== undefined) row.Email = patch.email;
  if (patch.mobile !== undefined) row.Mobile = patch.mobile;
  if (patch.dashboardRole !== undefined) row.DashboardRole = patch.dashboardRole;
  if (patch.clearanceLevel !== undefined) row.ClearanceLevel = patch.clearanceLevel;
  if (patch.permissions !== undefined) row.Permissions = JSON.stringify(patch.permissions || {});
  if (patch.active !== undefined) row.Active = patch.active;
  if (patch.accountStatus !== undefined) row.AccountStatus = patch.accountStatus;
  if (patch.lastLogin !== undefined) row.LastLogin = patch.lastLogin;
  if (patch.photoUrl !== undefined) row.PhotoUrl = patch.photoUrl;
  return row;
};

/**
 * Create or update the account row for a Firebase UID.
 *
 * The UID is the identity and is never taken from a request body by callers —
 * it comes from the verified session, the rule SEC-05 established.
 */
export async function upsertOfficerAccount(
  firebaseUid: string,
  patch: OfficerAccountWrite
): Promise<{ created: boolean; accountId: number | null }> {
  const uid = String(firebaseUid || "").trim();
  if (!uid) throw new Error("firebaseUid is required");

  let existing: any[];
  try {
    existing = await getAllRows(OFFICER_ACCOUNT_TABLE);
  } catch (err: any) {
    if (isMissingTable(err)) {
      throw new OfficerAccountUnavailableError(`${OFFICER_ACCOUNT_TABLE} table does not exist yet`);
    }
    throw err;
  }

  const match = existing.find((r) => str(unwrap(r, OFFICER_ACCOUNT_TABLE).FirebaseUID) === uid);

  if (match) {
    const rec = unwrap(match, OFFICER_ACCOUNT_TABLE);
    await updateRows(OFFICER_ACCOUNT_TABLE, [{ ROWID: rec.ROWID, ...toRow(patch) }]);
    return { created: false, accountId: rec.AccountID != null ? Number(rec.AccountID) : null };
  }

  const accountId = await nextId(OFFICER_ACCOUNT_TABLE, "AccountID");
  await insertRows(OFFICER_ACCOUNT_TABLE, [
    { AccountID: accountId, FirebaseUID: uid, ...toRow(patch) },
  ]);
  return { created: true, accountId };
}
