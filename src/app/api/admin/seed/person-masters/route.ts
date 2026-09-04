import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, insertRows, isCatalystConfigured, invalidateTable } from "@/lib/catalyst";

function isAdmin(role: string): boolean {
  return ["orca_owner", "orca_engineer", "orca_support", "admin_full", "command_admin_l1", "command_admin_l2", "scrb_officer", "admin_scrb", "admin_verification", "it_admin"].includes(role);
}

const RELIGIONS: { id: number; name: string }[] = [
  { id: 1,  name: "Hindu" },
  { id: 2,  name: "Muslim" },
  { id: 3,  name: "Christian" },
  { id: 4,  name: "Sikh" },
  { id: 5,  name: "Buddhist" },
  { id: 6,  name: "Jain" },
  { id: 7,  name: "Zoroastrian / Parsi" },
  { id: 8,  name: "Jewish" },
  { id: 9,  name: "Other" },
  { id: 10, name: "Not Stated" },
];

const CASTES: { id: number; name: string }[] = [
  { id: 1,  name: "General / Open" },
  { id: 2,  name: "OBC — Other Backward Class" },
  { id: 3,  name: "SC — Scheduled Caste" },
  { id: 4,  name: "ST — Scheduled Tribe" },
  { id: 5,  name: "SC (Converted to Christianity)" },
  { id: 6,  name: "Vokkaliga" },
  { id: 7,  name: "Lingayat" },
  { id: 8,  name: "Kuruba" },
  { id: 9,  name: "Beda / Valmiki" },
  { id: 10, name: "Idiga" },
  { id: 11, name: "Koli / Korama" },
  { id: 12, name: "Muslim OBC" },
  { id: 13, name: "Christian OBC" },
  { id: 14, name: "Minority — Other" },
  { id: 15, name: "Not Stated" },
];

export async function POST(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(officer.dashboardRole)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  if (!isCatalystConfigured()) {
    return NextResponse.json({ error: "Catalyst not configured" }, { status: 503 });
  }

  const [existingReligions, existingCastes] = await Promise.all([
    getAllRows("ReligionMaster"),
    getAllRows("CasteMaster"),
  ]);

  const existingReligionIds = new Set(
    existingReligions.map((r: any) => Number((r.ReligionMaster || r).ReligionID))
  );
  const existingCasteIds = new Set(
    existingCastes.map((r: any) => Number((r.CasteMaster || r).caste_master_id))
  );

  const religionsToInsert = RELIGIONS
    .filter((r) => !existingReligionIds.has(r.id))
    .map((r) => ({ ReligionID: r.id, ReligionName: r.name }));

  const castesToInsert = CASTES
    .filter((c) => !existingCasteIds.has(c.id))
    .map((c) => ({ caste_master_id: c.id, caste_master_name: c.name }));

  let religionsInserted = 0;
  let castesInserted = 0;

  if (religionsToInsert.length > 0) {
    await insertRows("ReligionMaster", religionsToInsert);
    religionsInserted = religionsToInsert.length;
    invalidateTable("ReligionMaster");
  }

  if (castesToInsert.length > 0) {
    await insertRows("CasteMaster", castesToInsert);
    castesInserted = castesToInsert.length;
    invalidateTable("CasteMaster");
  }

  return NextResponse.json({
    success: true,
    religionsInserted,
    castesInserted,
    religionsSkipped: RELIGIONS.length - religionsInserted,
    castesSkipped: CASTES.length - castesInserted,
  });
}
