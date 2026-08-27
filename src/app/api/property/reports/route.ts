import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, insertRows, updateRows, deleteRow, nextId, isCatalystConfigured } from "@/lib/catalyst";
import { catalystNow, toCatalystDateTime } from "@/lib/adminData";
import { denyWrite } from "@/lib/writeGuard";
import {
  validateReport,
  buildReference,
  normaliseIdentifier,
  rowTotal,
  REPORT_STATUSES,
  REPORT_TYPES,
  ITEM_STATUSES,
  LIMITS,
} from "@/lib/propertyRegister";

/**
 * Lost / Stolen / Found property register.
 *
 * GET   /api/property/reports            — the register
 * GET   /api/property/reports?reference= — one report with its items
 * POST  /api/property/reports            — register a report and its items
 * PATCH /api/property/reports            — update a report or one of its items
 *
 * This registry stands alone. Nothing here reads or writes `CaseMaster`, and
 * no route creates an FIR. `FIRReference` is free text an officer types when
 * one has been registered elsewhere — registering an FIR is a legal decision
 * and the software must not make it.
 *
 * Officer-only, both directions. There is no public intake.
 */

const REPORTS = "PropertyReport";
const ITEMS = "PropertyItem";

const unwrap = (row: any, table: string) => (row && row[table]) || row || {};
const s = (v: unknown) => String(v ?? "");

function mapItem(r: any) {
  const quantity = s(r.Quantity);
  const declaredUnitValue = s(r.DeclaredUnitValue);
  return {
    itemId: Number(r.ItemID || 0),
    reportReference: s(r.ReportReference),
    category: s(r.Category),
    itemDescription: s(r.ItemDescription),
    quantity,
    quantityUnit: s(r.QuantityUnit),
    declaredUnitValue,
    // Derived on read, never stored: a saved total drifts from its inputs the
    // moment one of them is edited.
    declaredTotalValue: rowTotal(quantity, declaredUnitValue),
    identifierType: s(r.IdentifierType),
    identifierValue: s(r.IdentifierValue),
    itemStatus: s(r.ItemStatus) || "MISSING",
    remarks: s(r.Remarks),
    recoveredOn: s(r.RecoveredOn),
    recoveredNote: s(r.RecoveredNote),
  };
}

function mapReport(r: any) {
  return {
    rowId: s(r.ROWID),
    reportId: Number(r.ReportID || 0),
    reference: s(r.Reference),
    reportType: s(r.ReportType) || "LOST",
    incidentFrom: s(r.IncidentFrom),
    incidentTo: s(r.IncidentTo),
    placeOfIncident: s(r.PlaceOfIncident),
    districtId: Number(r.DistrictID || 0),
    unitId: Number(r.UnitID || 0),
    ownerName: s(r.OwnerName),
    ownerContact: s(r.OwnerContact),
    ownerAddress: s(r.OwnerAddress),
    ownerIdType: s(r.OwnerIDType),
    ownerIdNumber: s(r.OwnerIDNumber),
    narrative: s(r.Narrative),
    reportStatus: s(r.ReportStatus) || "OPEN",
    firReference: s(r.FIRReference),
    registeredByName: s(r.RegisteredByName),
    createdAt: s(r.CreatedAt || r.CREATEDTIME),
    updatedAt: s(r.UpdatedAt),
  };
}

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Officer authentication required." },
      { status: 403 }
    );
  }
  if (!isCatalystConfigured()) {
    return NextResponse.json({ success: true, configured: false, reports: [] });
  }

  const url = new URL(req.url);
  const wanted = url.searchParams.get("reference")?.trim().toUpperCase() || "";
  const typeFilter = (url.searchParams.get("type") || "").toUpperCase();
  const statusFilter = (url.searchParams.get("status") || "").toUpperCase();

  try {
    const [reportRows, itemRows] = await Promise.all([
      getAllRows(REPORTS),
      getAllRows(ITEMS),
    ]);

    const items = itemRows.map((r) => mapItem(unwrap(r, ITEMS)));
    const byReference = new Map<string, ReturnType<typeof mapItem>[]>();
    for (const it of items) {
      if (!byReference.has(it.reportReference)) byReference.set(it.reportReference, []);
      byReference.get(it.reportReference)!.push(it);
    }

    let reports = reportRows
      .map((r) => mapReport(unwrap(r, REPORTS)))
      .filter((r) => r.reference)
      .map((r) => {
        const own = byReference.get(r.reference) || [];
        return {
          ...r,
          itemCount: own.length,
          // The report's declared total is the sum of its rows, computed here
          // so the list and the detail view can never disagree.
          declaredTotal: own.reduce((sum, it) => sum + it.declaredTotalValue, 0),
          recoveredCount: own.filter((it) => it.itemStatus !== "MISSING").length,
          /*
           * Theft is a cognizable offence and BNSS s.173 makes registering an
           * FIR mandatory, so a stolen report carrying no FIR number is a gap
           * in a duty — not a tidy edge case.
           *
           * It is flagged rather than blocked: a complainant is at the desk and
           * the details must be written down now, the FIR may follow minutes
           * later or be registered elsewhere as a Zero FIR, and a blocked field
           * only invites "pending" being typed into it.
           *
           * What makes the flag worth anything is that it is COUNTED. A
           * standalone property register is otherwise somewhere a theft
           * complaint can rest quietly and never reach the crime figures.
           */
          noFir: r.reportType === "STOLEN" && !r.firReference.trim(),
        };
      });

    // Counted over every report, before any filter — this is a supervisory
    // total, and it would be meaningless if the current view could shrink it.
    const stolenWithoutFir = reports.filter((r) => r.noFir).length;

    if (wanted) {
      const one = reports.find((r) => r.reference === wanted);
      if (!one) {
        return NextResponse.json({ success: false, error: "No such report." }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        configured: true,
        report: one,
        items: byReference.get(wanted) || [],
      });
    }

    if (REPORT_TYPES.includes(typeFilter as any)) {
      reports = reports.filter((r) => r.reportType === typeFilter);
    }
    if (REPORT_STATUSES.includes(statusFilter as any)) {
      reports = reports.filter((r) => r.reportStatus === statusFilter);
    }

    reports.sort((a, b) => b.reportId - a.reportId);

    const counts: Record<string, number> = {};
    for (const st of REPORT_STATUSES) counts[st] = 0;
    for (const r of reports) if (r.reportStatus in counts) counts[r.reportStatus]++;

    return NextResponse.json({ success: true, configured: true, reports, counts, stolenWithoutFir });
  } catch (err: any) {
    console.error("[property/reports] list failed:", err?.message || err);
    return NextResponse.json(
      { success: false, error: "Could not load the property register." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Officer authentication required." },
      { status: 403 }
    );
  }
  const denied = denyWrite(officer, "operational");
  if (denied) return denied;

  if (!isCatalystConfigured()) {
    return NextResponse.json(
      { success: false, error: "Property register is not configured." },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Malformed request." }, { status: 400 });
  }

  const checked = validateReport(body);
  if (!checked.ok || !checked.value) {
    return NextResponse.json(
      { success: false, error: checked.error, itemIndex: checked.itemIndex },
      { status: 400 }
    );
  }
  const v = checked.value;

  try {
    const serial = await nextId(REPORTS, "ReportID");
    const reference = buildReference(serial);
    const now = catalystNow();

    /*
     * A datetime column rejects an empty string outright — "Invalid input
     * value for IncidentTo. datetime value expected". An optional date must be
     * OMITTED from the row, not blanked, so the column is left null.
     */
    const incidentTo = toCatalystDateTime(v.incidentTo);

    await insertRows(REPORTS, [
      {
        ReportID: serial,
        Reference: reference,
        ReportType: v.reportType,
        IncidentFrom: toCatalystDateTime(v.incidentFrom) || now,
        ...(incidentTo ? { IncidentTo: incidentTo } : {}),
        PlaceOfIncident: v.placeOfIncident,
        DistrictID: Number(v.districtId) || null,
        UnitID: Number(v.unitId) || null,
        OwnerName: v.ownerName,
        OwnerContact: v.ownerContact,
        OwnerAddress: v.ownerAddress,
        OwnerIDType: v.ownerIdType,
        OwnerIDNumber: v.ownerIdNumber,
        Narrative: v.narrative,
        ReportStatus: "OPEN",
        FIRReference: v.firReference,
        // From the verified session, never from the body — the register says
        // who filed each report and that must not be spoofable.
        RegisteredByUID: officer.uid,
        RegisteredByName: `${officer.name} (${officer.email})`,
        ClosureNote: "",
        CreatedAt: now,
        UpdatedAt: now,
      },
    ]);

    /*
     * The items are a SECOND insert, and it can fail on its own — an earlier
     * build left PROP-2026-00001 in the register with zero items because the
     * report row landed and the item rows were rejected.
     *
     * A property report with no property is not a lesser record, it is a
     * meaningless one: it occupies a reference number, appears in the register
     * and states nothing. Catalyst has no transaction across two tables, so
     * the report row is removed by hand if its items do not land.
     */
    let itemId = await nextId(ITEMS, "ItemID");
    const itemRows = v.items.map((it, i) => ({
      ItemID: itemId + i,
      ReportReference: reference,
      Category: it.category,
      ItemDescription: it.itemDescription,
      Quantity: it.quantity,
      QuantityUnit: it.quantityUnit,
      DeclaredUnitValue: it.declaredUnitValue,
      IdentifierType: it.identifierType,
      IdentifierValue: it.identifierValue,
      IdentifierNormalised: normaliseIdentifier(it.identifierValue),
      ItemStatus: v.reportType === "FOUND" ? "RECOVERED" : "MISSING",
      Remarks: it.remarks,
      // RecoveredOn deliberately omitted, not blanked — see the note above.
      RecoveredNote: "",
      CreatedAt: now,
      UpdatedAt: now,
    }));
    try {
      await insertRows(ITEMS, itemRows);
    } catch (itemErr: any) {
      console.error("[property/reports] items failed, rolling back report:", itemErr?.message || itemErr);
      try {
        const rows = await getAllRows(REPORTS);
        const orphan = rows
          .map((r) => unwrap(r, REPORTS))
          .find((r) => String(r.Reference) === reference);
        if (orphan?.ROWID) await deleteRow(REPORTS, String(orphan.ROWID));
      } catch (cleanupErr: any) {
        // Say so rather than swallow it: an orphan left behind is a reference
        // number in the register that no officer can explain.
        console.error("[property/reports] rollback failed, orphan report left:", reference, cleanupErr?.message || cleanupErr);
      }
      return NextResponse.json(
        { success: false, error: "Could not record the property items. The report was not saved." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reference,
      itemCount: itemRows.length,
      registeredAt: now,
    });
  } catch (err: any) {
    console.error("[property/reports] create failed:", err?.message || err);
    return NextResponse.json(
      { success: false, error: "Could not record the report. Please try again." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Officer authentication required." },
      { status: 403 }
    );
  }
  const denied = denyWrite(officer, "operational");
  if (denied) return denied;

  if (!isCatalystConfigured()) {
    return NextResponse.json(
      { success: false, error: "Property register is not configured." },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Malformed request." }, { status: 400 });
  }

  const reference = String(body.reference ?? "").trim().toUpperCase();
  if (!reference) {
    return NextResponse.json({ success: false, error: "A report reference is required." }, { status: 400 });
  }

  const now = catalystNow();

  try {
    // ── Item update ────────────────────────────────────────────────────────
    if (body.itemId !== undefined) {
      const itemId = Number(body.itemId);
      const status = String(body.itemStatus ?? "").toUpperCase();
      if (!ITEM_STATUSES.includes(status as any)) {
        return NextResponse.json({ success: false, error: "Unknown item status." }, { status: 400 });
      }
      const note = String(body.recoveredNote ?? "").trim().slice(0, LIMITS.remarks);
      if (status !== "MISSING" && !note) {
        return NextResponse.json(
          { success: false, error: "State how and where the item was recovered." },
          { status: 400 }
        );
      }

      const rows = await getAllRows(ITEMS);
      const row = rows
        .map((r) => unwrap(r, ITEMS))
        .find((r) => Number(r.ItemID) === itemId && String(r.ReportReference) === reference);
      if (!row?.ROWID) {
        return NextResponse.json({ success: false, error: "No such item." }, { status: 404 });
      }

      await updateRows(ITEMS, [
        {
          ROWID: String(row.ROWID),
          ItemStatus: status,
          RecoveredNote: note,
          // Back to MISSING clears the date with an explicit null; "" is
          // rejected by the column, and omitting it would leave the old date
          // sitting on an item that is missing again.
          RecoveredOn: status === "MISSING" ? null : now,
          UpdatedAt: now,
        },
      ]);
      return NextResponse.json({ success: true, reference, itemId, itemStatus: status });
    }

    // ── Report update ──────────────────────────────────────────────────────
    const status = String(body.reportStatus ?? "").toUpperCase();
    if (status && !REPORT_STATUSES.includes(status as any)) {
      return NextResponse.json({ success: false, error: "Unknown report status." }, { status: 400 });
    }
    const closureNote = String(body.closureNote ?? "").trim().slice(0, LIMITS.closureNote);
    const firReference = String(body.firReference ?? "").trim().slice(0, LIMITS.firReference);

    // Closing or withdrawing a report ends it for the complainant. Doing that
    // without saying why leaves no record of the decision.
    if ((status === "CLOSED" || status === "WITHDRAWN") && !closureNote) {
      return NextResponse.json(
        { success: false, error: "A closure note is required to close or withdraw a report." },
        { status: 400 }
      );
    }

    const rows = await getAllRows(REPORTS);
    const row = rows.map((r) => unwrap(r, REPORTS)).find((r) => String(r.Reference) === reference);
    if (!row?.ROWID) {
      return NextResponse.json({ success: false, error: "No such report." }, { status: 404 });
    }

    /*
     * A STOLEN report with no FIR number cannot be finished silently.
     *
     * Theft is cognizable and BNSS s.173 makes FIR registration mandatory, so
     * a stolen report reaching its end with no FIR recorded is a decision
     * someone made. It may be a perfectly good one — the complainant withdrew,
     * an FIR exists at another station under a number nobody typed in — but it
     * has to be written down rather than left as an absence.
     *
     * `RECOVERED` is included: a theft file closed off because the goods turned
     * up is exactly the case where the FIR quietly never happens.
     */
    const endsTheFile = status === "CLOSED" || status === "WITHDRAWN" || status === "RECOVERED";
    const isStolen = String(row.ReportType || "") === "STOLEN";
    const firAfter = body.firReference !== undefined ? firReference : String(row.FIRReference || "");
    if (endsTheFile && isStolen && !firAfter.trim() && !closureNote) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This is a theft report with no FIR number recorded. Add the FIR number, or state in the closure note why no FIR was registered.",
          requiresFirOrExplanation: true,
        },
        { status: 400 }
      );
    }

    const patch: Record<string, any> = { ROWID: String(row.ROWID), UpdatedAt: now };
    const changes: string[] = [];
    if (status && status !== String(row.ReportStatus || "")) {
      patch.ReportStatus = status;
      changes.push(`status → ${status}`);
    }
    if (body.closureNote !== undefined && closureNote !== String(row.ClosureNote || "")) {
      patch.ClosureNote = closureNote;
      changes.push("closure note updated");
    }
    if (body.firReference !== undefined && firReference !== String(row.FIRReference || "")) {
      patch.FIRReference = firReference;
      changes.push(`FIR reference → ${firReference || "cleared"}`);
    }

    if (!changes.length) return NextResponse.json({ success: true, reference, unchanged: true });

    await updateRows(REPORTS, [patch]);
    return NextResponse.json({ success: true, reference, changes, updatedAt: now });
  } catch (err: any) {
    console.error("[property/reports] update failed:", err?.message || err);
    return NextResponse.json(
      { success: false, error: "Could not update the report." },
      { status: 500 }
    );
  }
}
