/**
 * O.R.C.A admin console — data layer on Catalyst (SERVER-SIDE ONLY).
 *
 * Replaces `adminService.ts`, which read nine Firestore collections that the
 * rest of the platform stopped writing to when the data layer moved to
 * Catalyst. The admin console was the last screen still looking at the old
 * database, which is why it showed an empty directory while seven officers
 * existed, and an empty verification ledger while scans were being recorded.
 *
 *   Firestore collection        ->  Catalyst table
 *   ------------------------------------------------------------------
 *   pendingRegistrations        ->  OfficerApplication
 *   officer_applications        ->  OfficerApplication
 *   officers + users            ->  OfficerAccount (joined to Employee)
 *   audit_logs                  ->  OfficerAuditLog
 *   rbac_audit_logs             ->  OfficerAuditLog
 *   roleChangeLog               ->  OfficerAuditLog
 *   verified_documents          ->  VerifiedDocument + VerificationScan
 *   admin_settings              ->  SystemSetting  (see systemSettings.ts)
 *
 * Firebase Auth is untouched. It still owns email, password and UID; every
 * table here joins back through `FirebaseUID`.
 *
 * Everything is a full-table scan filtered in process — the Self Client token
 * has no ZCQL scope, so there is no WHERE clause available. `catalyst.ts`
 * caches raw rows for a few seconds, which is what stops one admin screen from
 * scanning the same table a dozen times.
 */

import {
  getAllRows,
  insertRows,
  updateRows,
  isCatalystConfigured,
  nextId,
} from "@/lib/catalyst";

export const APPLICATION_TABLE = "OfficerApplication";
export const AUDIT_TABLE = "OfficerAuditLog";
export const EMPLOYEE_TABLE = "Employee";
export const SESSION_TABLE = "OfficerSession";
export const ACTIVITY_TABLE = "OfficerActivity";

const str = (v: any) => (v === null || v === undefined ? "" : String(v));
const num = (v: any) => (v === null || v === undefined || v === "" ? null : Number(v));

/**
 * A timestamp Catalyst will accept: `YYYY-MM-DD HH:mm:ss`.
 *
 * `new Date().toISOString()` is REJECTED — Catalyst answers
 *
 *     Invalid input value for ChangedAt. datetime value expected
 *
 * and the whole insert fails with a 400. It is not lenient about the `T`, the
 * milliseconds, or the trailing `Z`. This was caught by the write test; without
 * it, every audit entry, application and settings save would have failed at
 * runtime while the code looked perfectly reasonable.
 *
 * Note this writes UTC, matching what the rest of the platform already stores
 * (see officerTelemetry.ts and verificationLedger.ts, which format the same way).
 */
export const catalystNow = (d: Date = new Date()): string =>
  d.toISOString().slice(0, 19).replace("T", " ");

/** Same shaping for a timestamp that arrived from elsewhere. */
export const toCatalystDateTime = (value: string): string => {
  if (!value) return "";
  const t = Date.parse(value.includes("T") ? value : value.replace(" ", "T"));
  return Number.isNaN(t) ? "" : catalystNow(new Date(t));
};

/** Catalyst wraps each row as { TableName: {...} } on reads. */
const unwrap = (row: any, table: string) => (row && row[table]) || row || {};

const rowsOf = async (table: string) => {
  const raw = await getAllRows(table).catch(() => [] as any[]);
  return raw.map((r) => unwrap(r, table));
};

/** id -> row, for joining a lookup table in memory. */
const indexBy = (rows: any[], idCol: string) => {
  const m = new Map<string, any>();
  rows.forEach((r) => {
    const id = str(r[idCol]);
    if (id) m.set(id, r);
  });
  return m;
};

// ─────────────────────────────────────────────────────────────────────────────
// Reference data — the lookups every admin screen needs to turn FK ids into
// names. Cached for ten minutes by catalyst.ts, so this is cheap after the
// first call.
// ─────────────────────────────────────────────────────────────────────────────

export interface AdminReference {
  ranks: { id: number; name: string }[];
  designations: { id: number; name: string }[];
  districts: { id: number; name: string }[];
  units: { id: number; name: string; districtId: number | null }[];
}

export async function loadReference(): Promise<AdminReference> {
  const [ranks, designations, districts, units] = await Promise.all([
    rowsOf("Rank"),
    rowsOf("Designation"),
    rowsOf("District"),
    rowsOf("Unit"),
  ]);

  return {
    ranks: ranks
      .map((r) => ({ id: Number(r.RankID), name: str(r.RankName) }))
      .filter((r) => r.id && r.name)
      .sort((a, b) => a.id - b.id),
    designations: designations
      .map((r) => ({ id: Number(r.DesignationID), name: str(r.DesignationName) }))
      .filter((r) => r.id && r.name)
      .sort((a, b) => a.id - b.id),
    districts: districts
      .map((r) => ({ id: Number(r.DistrictID), name: str(r.DistrictName) }))
      .filter((r) => r.id && r.name)
      .sort((a, b) => a.name.localeCompare(b.name)),
    units: units
      .map((r) => ({
        id: Number(r.UnitID),
        name: str(r.UnitName),
        districtId: num(r.DistrictID),
      }))
      .filter((r) => r.id && r.name)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Officer applications
// ─────────────────────────────────────────────────────────────────────────────

export interface AdminApplication {
  applicationId: number | null;
  firebaseUid: string;
  email: string;
  fullName: string;
  kgid: string;
  mobile: string;
  rankId: number | null;
  designationId: number | null;
  districtId: number | null;
  unitId: number | null;
  postingType: string;
  requestedAccess: string;
  status: string;
  submittedAt: string;
  reviewedBy: string;
  reviewedAt: string;
  remarks: string;
  photoUrl: string;
  // Joined names, so the UI never has to hold the lookup tables itself.
  rank: string;
  designation: string;
  district: string;
  unit: string;
}

export async function listApplications(): Promise<AdminApplication[]> {
  const [apps, ref] = await Promise.all([rowsOf(APPLICATION_TABLE), loadReference()]);

  const rankById = indexBy(ref.ranks, "id");
  const desigById = indexBy(ref.designations, "id");
  const distById = indexBy(ref.districts, "id");
  const unitById = indexBy(ref.units, "id");

  return apps
    .map((a) => ({
      applicationId: num(a.ApplicationID),
      firebaseUid: str(a.FirebaseUID),
      email: str(a.Email),
      fullName: str(a.FullName),
      kgid: str(a.KGID),
      mobile: str(a.Mobile),
      rankId: num(a.RankID),
      designationId: num(a.DesignationID),
      districtId: num(a.DistrictID),
      unitId: num(a.UnitID),
      postingType: str(a.PostingType),
      requestedAccess: str(a.RequestedAccess),
      status: str(a.ApplicationStatus) || "pending",
      submittedAt: str(a.SubmittedAt),
      reviewedBy: str(a.ReviewedBy),
      reviewedAt: str(a.ReviewedAt),
      remarks: str(a.Remarks),
      photoUrl: str(a.PhotoUrl),
      rank: str(rankById.get(str(a.RankID))?.name),
      designation: str(desigById.get(str(a.DesignationID))?.name),
      district: str(distById.get(str(a.DistrictID))?.name),
      unit: str(unitById.get(str(a.UnitID))?.name),
    }))
    .sort((x, y) => (y.submittedAt || "").localeCompare(x.submittedAt || ""));
}

export interface ApplicationWrite {
  firebaseUid: string;
  email?: string;
  fullName?: string;
  kgid?: string;
  mobile?: string;
  rankId?: number | null;
  designationId?: number | null;
  districtId?: number | null;
  unitId?: number | null;
  postingType?: string;
  requestedAccess?: string;
  status?: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  remarks?: string;
  photoUrl?: string;
}

const applicationRow = (p: ApplicationWrite): Record<string, any> => {
  const row: Record<string, any> = {};
  if (p.email !== undefined) row.Email = p.email;
  if (p.fullName !== undefined) row.FullName = p.fullName;
  if (p.kgid !== undefined) row.KGID = p.kgid;
  if (p.mobile !== undefined) row.Mobile = p.mobile;
  if (p.rankId !== undefined) row.RankID = p.rankId;
  if (p.designationId !== undefined) row.DesignationID = p.designationId;
  if (p.districtId !== undefined) row.DistrictID = p.districtId;
  if (p.unitId !== undefined) row.UnitID = p.unitId;
  if (p.postingType !== undefined) row.PostingType = p.postingType;
  if (p.requestedAccess !== undefined) row.RequestedAccess = p.requestedAccess;
  if (p.status !== undefined) row.ApplicationStatus = p.status;
  if (p.submittedAt !== undefined) row.SubmittedAt = toCatalystDateTime(p.submittedAt);
  if (p.reviewedBy !== undefined) row.ReviewedBy = p.reviewedBy;
  if (p.reviewedAt !== undefined) row.ReviewedAt = toCatalystDateTime(p.reviewedAt);
  if (p.remarks !== undefined) row.Remarks = p.remarks;
  if (p.photoUrl !== undefined) row.PhotoUrl = p.photoUrl;
  return row;
};

/**
 * Create or update the application row for a Firebase UID.
 *
 * One application per UID: a person re-submitting after a rejection updates
 * their existing row rather than stacking a second one, which is what kept the
 * Firestore version showing the same applicant three times.
 */
export async function upsertApplication(
  patch: ApplicationWrite
): Promise<{ created: boolean; applicationId: number | null }> {
  const uid = String(patch.firebaseUid || "").trim();
  if (!uid) throw new Error("firebaseUid is required");

  const existing = await rowsOf(APPLICATION_TABLE);
  const match = existing.find((r) => str(r.FirebaseUID) === uid);

  if (match) {
    await updateRows(APPLICATION_TABLE, [{ ROWID: match.ROWID, ...applicationRow(patch) }]);
    return { created: false, applicationId: num(match.ApplicationID) };
  }

  const applicationId = await nextId(APPLICATION_TABLE, "ApplicationID");
  await insertRows(APPLICATION_TABLE, [
    {
      ApplicationID: applicationId,
      FirebaseUID: uid,
      SubmittedAt: toCatalystDateTime(patch.submittedAt || "") || catalystNow(),
      ApplicationStatus: patch.status || "pending",
      ...applicationRow(patch),
      // Assigned HERE, after the id exists, and after the spread so a caller
      // cannot supply one. The KGID is auto-serial: what an applicant types is
      // never their number.
      KGID: provisionalKgidFor(applicationId),
    },
  ]);
  return { created: true, applicationId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit log
// ─────────────────────────────────────────────────────────────────────────────

export interface AdminAuditEntry {
  logId: number | null;
  firebaseUid: string;
  changeType: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
  reason: string;
}

export async function listAuditLogs(): Promise<AdminAuditEntry[]> {
  const rows = await rowsOf(AUDIT_TABLE);
  return rows
    .map((r) => ({
      logId: num(r.LogID),
      firebaseUid: str(r.FirebaseUID),
      changeType: str(r.ChangeType),
      oldValue: str(r.OldValue),
      newValue: str(r.NewValue),
      changedBy: str(r.ChangedBy),
      changedAt: str(r.ChangedAt),
      reason: str(r.Reason),
    }))
    .sort((a, b) => (b.changedAt || "").localeCompare(a.changedAt || ""));
}

/**
 * Append one audit row.
 *
 * Deliberately append-only: there is no update or delete path here, and none
 * should be added. The Firestore version stored permission history as a nested
 * array inside each profile, so a rewrite of the profile silently rewrote its
 * own history.
 *
 * NOTE ON IP ADDRESSES: this table has no IP column and that is intentional.
 * The IP of a change belongs to the session that made it, which OfficerSession
 * already records for real. Copying an IP into every audit row is what led to
 * the fabricated `10.0.12.94` appearing in four different code paths.
 */
export async function appendAudit(entry: {
  firebaseUid: string;
  changeType: string;
  oldValue?: string;
  newValue?: string;
  changedBy: string;
  reason?: string;
}): Promise<number> {
  const logId = await nextId(AUDIT_TABLE, "LogID");
  await insertRows(AUDIT_TABLE, [
    {
      LogID: logId,
      FirebaseUID: entry.firebaseUid || "",
      ChangeType: entry.changeType,
      OldValue: (entry.oldValue || "").slice(0, 9000),
      NewValue: (entry.newValue || "").slice(0, 9000),
      ChangedBy: entry.changedBy,
      ChangedAt: catalystNow(),
      Reason: (entry.reason || "").slice(0, 9000),
    },
  ]);
  return logId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Employee roster — the ER diagram's people table
// ─────────────────────────────────────────────────────────────────────────────

/**
 * KGID allocation — auto-serial, in two stages.
 *
 * DECISION (user, 2026-08-24): the KGID is issued by the system for every
 * officer. It is never typed in, and never taken from the request body.
 *
 * There are two series, and the distinction is the point:
 *
 *   APP-00001   a PROVISIONAL id, issued the moment an application is filed.
 *               An applicant needs something to be referred to by while they
 *               are being reviewed, but they are not personnel yet and must
 *               never look like they are.
 *   KSP-00008   the officer's real id, issued at APPROVAL, when an Employee
 *               row is created and they become personnel.
 *
 * The prefixes make the two impossible to confuse at a glance — anywhere an
 * `APP-` id appears on a case or an exhibit, something has gone wrong. The
 * seven migrated officers occupy KSP-00001..KSP-00007.
 *
 * Both take the max over the NUMERIC TAIL rather than the row count, so
 * deleting a record never causes the next allocation to collide with a live one.
 */

/**
 * A regex LITERAL, deliberately — not built from a template string.
 *
 * This allocator originally used `new RegExp(`^${prefix}-(\d+)$`)`, and inside
 * a template literal `\d` collapses to a plain `d`. The pattern was therefore
 * `^KSP-(d+)$`, which matches nothing, so every allocation returned KSP-00001
 * and would have collided with a serving officer on every single approval. It
 * type-checked and read correctly. Keep the digit test as a literal.
 */
const DIGITS = /^\d+$/;

const nextInSeries = (values: string[], prefix: string): string => {
  const head = `${prefix}-`;
  let max = 0;

  values.forEach((v) => {
    const s = String(v || "").trim();
    // Case-sensitive on purpose: "ksp-00009" is not a number this series issued,
    // and counting it would hand out a duplicate of a real one.
    if (!s.startsWith(head)) return;
    const tail = s.slice(head.length);
    // Digits only — "KSP-", "KSP-abc" and "KSP-12a" must not count.
    if (!DIGITS.test(tail)) return;
    max = Math.max(max, Number(tail));
  });

  return `${prefix}-${String(max + 1).padStart(5, "0")}`;
};

/** The officer's permanent id. Allocated at approval, never before. */
export async function allocateKgid(): Promise<string> {
  const rows = await rowsOf(EMPLOYEE_TABLE);
  return nextInSeries(rows.map((r) => str(r.KGID)), "KSP");
}

/**
 * The applicant's provisional id, derived from their ApplicationID.
 *
 * NOT scanned over the KGID column, and that distinction matters. The column is
 * REWRITTEN on approval — an approved row stops holding its `APP-` number — so
 * a max-of-column allocator would hand the freed number to the next applicant.
 * Two different people would then have been `APP-00002`, and every review
 * remark and audit entry citing it would be ambiguous about which.
 *
 * `ApplicationID` is monotonic by construction (`nextId` takes max + 1 and a
 * deleted row's id is never revisited by a live one), so deriving from it is
 * stable for free. It also ties the provisional id to the row it names.
 */
export const provisionalKgidFor = (applicationId: number): string =>
  `APP-${String(applicationId).padStart(5, "0")}`;

/** True for a provisional id — i.e. this person is not personnel yet. */
export const isProvisionalKgid = (kgid: string): boolean =>
  /^APP-\d+$/.test(String(kgid || "").trim());

export interface EmployeeWrite {
  firstName: string;
  kgid?: string;
  districtId?: number | null;
  unitId?: number | null;
  rankId?: number | null;
  designationId?: number | null;
}

/**
 * Create the Employee row for a newly approved officer.
 *
 * This is the step that was missing entirely: approval used to write only
 * Firestore, so an approved officer had no `EmployeeID` and therefore could not
 * be selected as a collecting officer or an evidence custodian, nor named on a
 * case. Their account existed and their identity did not.
 */
export async function createEmployee(patch: EmployeeWrite): Promise<{ employeeId: number; kgid: string }> {
  const employeeId = await nextId(EMPLOYEE_TABLE, "EmployeeID");
  const kgid = patch.kgid?.trim() || (await allocateKgid());

  await insertRows(EMPLOYEE_TABLE, [
    {
      EmployeeID: employeeId,
      KGID: kgid,
      FirstName: patch.firstName,
      DistrictID: patch.districtId ?? null,
      UnitID: patch.unitId ?? null,
      RankID: patch.rankId ?? null,
      DesignationID: patch.designationId ?? null,
    },
  ]);

  return { employeeId, kgid };
}

/** Update posting details on an existing Employee row. */
export async function updateEmployee(
  employeeId: number,
  patch: Partial<EmployeeWrite>
): Promise<boolean> {
  const rows = await rowsOf(EMPLOYEE_TABLE);
  const match = rows.find((r) => str(r.EmployeeID) === String(employeeId));
  if (!match) return false;

  const row: Record<string, any> = { ROWID: match.ROWID };
  if (patch.firstName !== undefined) row.FirstName = patch.firstName;
  if (patch.kgid !== undefined) row.KGID = patch.kgid;
  if (patch.districtId !== undefined) row.DistrictID = patch.districtId;
  if (patch.unitId !== undefined) row.UnitID = patch.unitId;
  if (patch.rankId !== undefined) row.RankID = patch.rankId;
  if (patch.designationId !== undefined) row.DesignationID = patch.designationId;

  await updateRows(EMPLOYEE_TABLE, [row]);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Verification oversight
// ─────────────────────────────────────────────────────────────────────────────

export interface AdminVerification {
  verificationId: string;
  crimeNo: string;
  documentHash: string;
  issuedBy: string;
  issuedAt: string;
  status: string;
  /** How many times this sealed document has actually been scanned. */
  scanCount: number;
  lastScannedAt: string;
  lastScanStatus: string;
}

/**
 * The ledger and the scan log are two different things and the old screen
 * conflated them: `VerifiedDocument` is one row per SEALED document (issued at
 * print time), `VerificationScan` is one row per SCAN of one. A document with
 * zero scans is normal — it means nobody has checked it yet, not that it failed.
 */
export async function listVerifications(): Promise<AdminVerification[]> {
  const [docs, scans] = await Promise.all([
    rowsOf("VerifiedDocument"),
    rowsOf("VerificationScan"),
  ]);

  const scansByVerification = new Map<string, any[]>();
  scans.forEach((s) => {
    const key = str(s.VerificationID);
    if (!key) return;
    const list = scansByVerification.get(key) || [];
    list.push(s);
    scansByVerification.set(key, list);
  });

  return docs
    .map((d) => {
      const vid = str(d.VerificationID);
      const mine = (scansByVerification.get(vid) || []).sort((a, b) =>
        str(b.ScannedAt).localeCompare(str(a.ScannedAt))
      );
      return {
        verificationId: vid,
        crimeNo: str(d.CrimeNo),
        documentHash: str(d.DocumentHash),
        issuedBy: str(d.IssuedBy),
        issuedAt: str(d.IssuedAt),
        status: str(d.VerificationStatus) || "verified",
        scanCount: mine.length,
        lastScannedAt: str(mine[0]?.ScannedAt),
        lastScanStatus: str(mine[0]?.ScanStatus),
      };
    })
    .sort((a, b) => (b.issuedAt || "").localeCompare(a.issuedAt || ""));
}

/** Scans that found nothing, or found a mismatch — the ones worth reviewing. */
export async function listFailedScans(): Promise<
  { scanId: string; scannedAt: string; verificationId: string; crimeNo: string; documentName: string; status: string; scannedBy: string; error: string }[]
> {
  const scans = await rowsOf("VerificationScan");
  return scans
    .filter((s) => {
      const st = str(s.ScanStatus).toUpperCase();
      return st && st !== "VERIFIED";
    })
    .map((s) => ({
      scanId: str(s.ScanID),
      scannedAt: str(s.ScannedAt),
      verificationId: str(s.VerificationID),
      crimeNo: str(s.CrimeNo),
      documentName: str(s.DocumentName),
      status: str(s.ScanStatus),
      scannedBy: str(s.ScannedBy),
      error: str(s.ErrorDetail),
    }))
    .sort((a, b) => (b.scannedAt || "").localeCompare(a.scannedAt || ""));
}

// ─────────────────────────────────────────────────────────────────────────────
// Sessions — the real source for "who is online" and for security events
// ─────────────────────────────────────────────────────────────────────────────

export interface AdminSession {
  sessionId: number | null;
  firebaseUid: string;
  loginAt: string;
  logoutAt: string;
  durationSeconds: number | null;
  status: string;
  endReason: string;
  ipAddress: string;
  userAgent: string;
}

export async function listSessions(): Promise<AdminSession[]> {
  const rows = await rowsOf(SESSION_TABLE);
  return rows
    .map((r) => ({
      sessionId: num(r.SessionID),
      firebaseUid: str(r.FirebaseUID),
      loginAt: str(r.LoginAt),
      logoutAt: str(r.LogoutAt),
      durationSeconds: num(r.DurationSeconds),
      status: str(r.SessionStatus),
      endReason: str(r.EndReason),
      ipAddress: str(r.IPAddress),
      userAgent: str(r.UserAgent),
    }))
    .sort((a, b) => (b.loginAt || "").localeCompare(a.loginAt || ""));
}

export interface AdminActivity {
  activityId: number | null;
  firebaseUid: string;
  activityType: string;
  occurredAt: string;
  category: string;
  title: string;
  detail: string;
  sizeBytes: number | null;
  // AI telemetry. Null on rows written before these columns existed, and on
  // every non-AI activity — never zero, which would average in as a real
  // measurement of nothing.
  model: string;
  latencyMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  outcome: string;
  responseText: string;
}

export async function listActivity(): Promise<AdminActivity[]> {
  const rows = await rowsOf(ACTIVITY_TABLE);
  return rows
    .map((r) => ({
      activityId: num(r.ActivityID),
      firebaseUid: str(r.FirebaseUID),
      activityType: str(r.ActivityType),
      occurredAt: str(r.OccurredAt),
      category: str(r.Category),
      title: str(r.Title),
      detail: str(r.Detail),
      sizeBytes: num(r.SizeBytes),
      model: str(r.Model),
      latencyMs: num(r.LatencyMs),
      promptTokens: num(r.PromptTokens),
      completionTokens: num(r.CompletionTokens),
      totalTokens: num(r.TotalTokens),
      outcome: str(r.Outcome),
      responseText: str(r.ResponseText),
    }))
    .sort((a, b) => (b.occurredAt || "").localeCompare(a.occurredAt || ""));
}

export const isConfigured = isCatalystConfigured;

// ─────────────────────────────────────────────────────────────────────────────
// Security alerts — unauthorised access warnings
// ─────────────────────────────────────────────────────────────────────────────

export const ALERT_TABLE = "SecurityAlert";

export interface SecurityAlertRow {
  alertId: number | null;
  rowId: string;
  firebaseUid: string;
  alertType: string;
  severity: string;
  detectedAt: string;
  ipAddress: string;
  networkName: string;
  countryCode: string;
  reason: string;
  userAgent: string;
  sessionRowId: string;
  /** WARNED while the grace period runs; LOCKED_OUT once it expires. */
  outcome: string;
  acknowledgedBy: string;
  acknowledgedAt: string;
}

export async function listSecurityAlerts(): Promise<SecurityAlertRow[]> {
  const rows = await rowsOf(ALERT_TABLE);
  return rows
    .map((r) => ({
      alertId: num(r.AlertID),
      rowId: str(r.ROWID),
      firebaseUid: str(r.FirebaseUID),
      alertType: str(r.AlertType),
      severity: str(r.Severity),
      detectedAt: str(r.DetectedAt),
      ipAddress: str(r.IPAddress),
      networkName: str(r.NetworkName),
      countryCode: str(r.CountryCode),
      reason: str(r.Reason),
      userAgent: str(r.UserAgent),
      sessionRowId: str(r.SessionRowID),
      outcome: str(r.Outcome),
      acknowledgedBy: str(r.AcknowledgedBy),
      acknowledgedAt: str(r.AcknowledgedAt),
    }))
    .sort((a, b) => (b.detectedAt || "").localeCompare(a.detectedAt || ""));
}

/**
 * Record an unauthorised-access warning.
 *
 * DE-DUPLICATED per officer per session. The browser polls every few seconds
 * while a VPN is up, and the old route wrote a Firestore row on every poll —
 * a five-minute connection would have produced sixty identical alerts and
 * buried anything real. One row is opened per (officer, session), and its
 * outcome is updated in place when the lockout actually fires.
 */
export async function raiseSecurityAlert(entry: {
  firebaseUid: string;
  alertType: string;
  severity: string;
  ipAddress: string;
  networkName: string;
  countryCode: string;
  reason: string;
  userAgent: string;
  sessionRowId: string;
  outcome: string;
}): Promise<{ alertId: number | null; created: boolean }> {
  const existing = await rowsOf(ALERT_TABLE);
  const match = existing.find(
    (r) =>
      str(r.FirebaseUID) === entry.firebaseUid &&
      str(r.AlertType) === entry.alertType &&
      str(r.SessionRowID) === entry.sessionRowId &&
      // A session that has already ended in a lockout is closed; a fresh
      // detection after that is genuinely a new event.
      str(r.Outcome) !== "LOCKED_OUT"
  );

  if (match) {
    // Only ever escalates: WARNED -> LOCKED_OUT, never back.
    if (entry.outcome === "LOCKED_OUT" && str(match.Outcome) !== "LOCKED_OUT") {
      await updateRows(ALERT_TABLE, [
        { ROWID: match.ROWID, Outcome: "LOCKED_OUT", Reason: entry.reason.slice(0, 9000) },
      ]);
    }
    return { alertId: num(match.AlertID), created: false };
  }

  const alertId = await nextId(ALERT_TABLE, "AlertID");
  await insertRows(ALERT_TABLE, [
    {
      AlertID: alertId,
      FirebaseUID: entry.firebaseUid,
      AlertType: entry.alertType.slice(0, 40),
      Severity: entry.severity.slice(0, 20),
      DetectedAt: catalystNow(),
      IPAddress: entry.ipAddress.slice(0, 64),
      NetworkName: entry.networkName.slice(0, 200),
      CountryCode: entry.countryCode.slice(0, 8),
      Reason: entry.reason.slice(0, 9000),
      UserAgent: entry.userAgent.slice(0, 9000),
      SessionRowID: entry.sessionRowId.slice(0, 64),
      Outcome: entry.outcome.slice(0, 40),
    },
  ]);
  return { alertId, created: true };
}

/** Mark an alert as reviewed. Append-only in spirit: the row is never deleted. */
export async function acknowledgeSecurityAlert(
  rowId: string,
  who: string
): Promise<boolean> {
  const rows = await rowsOf(ALERT_TABLE);
  const match = rows.find((r) => str(r.ROWID) === String(rowId));
  if (!match) return false;
  await updateRows(ALERT_TABLE, [
    { ROWID: match.ROWID, AcknowledgedBy: who.slice(0, 200), AcknowledgedAt: catalystNow() },
  ]);
  return true;
}
