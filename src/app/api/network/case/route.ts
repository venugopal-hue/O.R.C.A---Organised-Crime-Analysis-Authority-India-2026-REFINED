import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { isCatalystConfigured } from "@/lib/catalyst";
import { buildCaseGraph } from "@/lib/networkGraph";

/**
 * GET /api/network/case?q=<CrimeNo | CaseNo | CaseMasterID>
 *
 * The relation graph for one registered case: the case, the people named on it,
 * its station and officer, and — one hop out — the other cases those accused
 * also appear on. Every node is a real record; see src/lib/networkGraph.ts.
 */
export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Officer authentication required." },
      { status: 403 }
    );
  }
  if (!isCatalystConfigured()) {
    return NextResponse.json({ success: false, configured: false, error: "Records store not connected." });
  }

  const q = String(req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) {
    return NextResponse.json({ success: false, error: "Enter a case number." }, { status: 400 });
  }

  const hopsParam = req.nextUrl.searchParams.get("hops");
  const hops: 1 | 2 = hopsParam === "2" ? 2 : 1;

  try {
    const graph = await buildCaseGraph(q, hops);
    if (!graph) {
      return NextResponse.json(
        { success: false, error: `No registered case matches "${q}".`, notFound: true },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, configured: true, graph });
  } catch (error: any) {
    console.error("[network/case]", error?.message);
    return NextResponse.json(
      { success: false, error: error?.message || "Could not build the graph." },
      { status: 500 }
    );
  }
}
