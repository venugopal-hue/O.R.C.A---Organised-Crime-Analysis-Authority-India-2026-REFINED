import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, isCatalystConfigured } from "@/lib/catalyst";

/**
 * GET /api/accused/browse
 * Returns the distinct list of accused names for the browse grid.
 */
export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCatalystConfigured()) return NextResponse.json({ names: [] });

  try {
    const rows = await getAllRows("Accused");
    const counts = new Map<string, { display: string; cases: number }>();
    for (const r of rows) {
      const a = r.Accused || r;
      const name = String(a.AccusedName ?? "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!counts.has(key)) counts.set(key, { display: name, cases: 0 });
      counts.get(key)!.cases++;
    }
    const persons = [...counts.values()]
      .sort((a, b) => a.display.localeCompare(b.display))
      .map(p => ({ name: p.display, cases: p.cases }));
    return NextResponse.json({ persons });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
