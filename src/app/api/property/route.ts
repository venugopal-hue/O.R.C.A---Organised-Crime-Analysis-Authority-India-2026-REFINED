import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";

/**
 * GET /api/property — root health/status endpoint.
 * Sub-routes: /api/property/matches, /api/property/reference, /api/property/reports
 */
export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    module: "property",
    status: "ok",
    endpoints: ["/api/property/matches", "/api/property/reference", "/api/property/reports"],
  });
}
