import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, insertRows, nextId, isCatalystConfigured } from "@/lib/catalyst";
import { denyWrite } from "@/lib/writeGuard";
import { catalystNow } from "@/lib/adminData";

/**
 * Official security bulletins.
 *
 * GET  /api/bulletins  — every published bulletin, newest first
 * POST /api/bulletins  — publish one
 *
 * WHY THIS EXISTS
 *
 * Bulletins were held in `localStorage` under `orca_official_bulletins`. That
 * made "Publish Bulletin" a private note: the officer who published saw it, and
 * nobody else on the force ever did — on a screen whose entire purpose is
 * telling other officers something. The list was also seeded with three
 * invented circulars attributed to real offices.
 *
 * They now live in the Catalyst `Bulletin` table, so publishing reaches
 * everyone and survives a browser change.
 *
 * The author is taken from the VERIFIED session, never from the body. A
 * bulletin carries departmental authority; letting the caller name its author
 * would let any officer publish as the DG & IGP Office.
 */

const CATEGORIES = new Set(["HIGH URGENCY", "INTELLIGENCE ADV", "ROUTINE BRIEF"]);

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json(
      { success: false, error: "ACCESS DENIED: Officer authentication required." },
      { status: 403 }
    );
  }

  if (!isCatalystConfigured()) {
    return NextResponse.json({ success: true, configured: false, bulletins: [] });
  }

  try {
    const rows = await getAllRows("Bulletin");
    const bulletins = rows
      .map((b) => ({
        id: String(b.BulletinID || b.ROWID),
        title: String(b.Title || ""),
        category: String(b.Category || "ROUTINE BRIEF"),
        summary: String(b.Summary || ""),
        body: String(b.Body || ""),
        author: String(b.Author || ""),
        publishedBy: String(b.PublishedBy || ""),
        date: String(b.PublishedAt || b.CREATEDTIME || ""),
        attachment: String(b.Attachment || ""),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({ success: true, configured: true, bulletins });
  } catch (error: any) {
    console.error("[bulletins GET]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to read bulletins." },
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

  // Publishing is a departmental communication, not a personal note — a
  // read-only account must not be able to issue one. See writeGuard.ts.
  const denied = denyWrite(officer, "operational");
  if (denied) return denied;

  if (!isCatalystConfigured()) {
    return NextResponse.json(
      { success: false, error: "Catalyst is not connected; the bulletin cannot be published." },
      { status: 503 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const title = String(body.title || "").trim();
  if (!title) {
    return NextResponse.json({ success: false, error: "A title is required." }, { status: 400 });
  }

  const category = String(body.category || "ROUTINE BRIEF").toUpperCase();
  if (!CATEGORIES.has(category)) {
    return NextResponse.json(
      { success: false, error: `Unknown category "${body.category}".` },
      { status: 400 }
    );
  }

  try {
    const id = await nextId("Bulletin", "BulletinID");
    const row = {
      BulletinID: id,
      Title: title.slice(0, 250),
      Category: category,
      Summary: String(body.summary || "").trim(),
      Body: String(body.body || "").trim(),
      // From the session, not the body — see the note above.
      Author: officer.name || officer.email || "Officer",
      PublishedBy: officer.uid,
      PublishedAt: catalystNow(),
      Attachment: String(body.attachment || "").trim().slice(0, 250),
    };
    await insertRows("Bulletin", [row]);

    return NextResponse.json({
      success: true,
      bulletin: {
        id: String(id),
        title: row.Title,
        category: row.Category,
        summary: row.Summary,
        body: row.Body,
        author: row.Author,
        publishedBy: row.PublishedBy,
        date: row.PublishedAt,
        attachment: row.Attachment,
      },
    });
  } catch (error: any) {
    console.error("[bulletins POST]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to publish the bulletin." },
      { status: 500 }
    );
  }
}
