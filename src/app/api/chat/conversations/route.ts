import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { denyWrite } from "@/lib/writeGuard";
import {
  getAllRows,
  insertRows,
  updateRows,
  deleteRow,
  isCatalystConfigured,
} from "@/lib/catalyst";

/**
 * The signed-in officer's AI conversations.
 *
 * GET    /api/chat/conversations           — this officer's threads
 * POST   /api/chat/conversations           — create or update one
 * DELETE /api/chat/conversations?id=<id>   — remove one
 *
 * WHY THIS EXISTS
 *
 * Conversations were written to Firestore (`users/{uid}/conversations`) with a
 * localStorage mirror, while the admin console's AI monitoring reads Catalyst
 * `OfficerActivity`. So the two disagreed by construction: an administrator
 * auditing AI use saw that a query happened and never what was asked, because
 * the content lived in a store the server no longer reads. An officer moving
 * browsers saw a different history again.
 *
 * One store, and it is the one the platform is built on.
 *
 * OWNERSHIP IS ENFORCED, NOT ASSUMED
 *
 * The UID comes from the verified session and every row is filtered by it.
 * There is deliberately no `uid` parameter: a caller cannot read or delete
 * another officer's threads. Reading someone else's belongs behind an admin
 * route with its own role check.
 */

const TABLE = "ChatConversation";

/** Catalyst has no ZCQL scope here, so ownership is filtered in process. */
async function rowsFor(uid: string) {
  const rows = await getAllRows(TABLE);
  return rows.filter((r) => String(r.FirebaseUID) === uid);
}

export async function GET(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }
  if (!isCatalystConfigured()) {
    return NextResponse.json({ success: true, configured: false, conversations: [] });
  }

  try {
    const conversations = (await rowsFor(officer.uid))
      .map((r) => {
        let messages: any[] = [];
        try {
          messages = JSON.parse(String(r.Messages || "[]"));
        } catch {
          // A thread whose payload will not parse is returned empty rather than
          // failing the whole list — one bad row must not hide the rest.
          messages = [];
        }
        return {
          id: String(r.ConversationID),
          title: String(r.Title || "Untitled"),
          createdAt: String(r.CreatedAt || r.CREATEDTIME || ""),
          pinned: Boolean(r.Pinned),
          moduleContext: String(r.ModuleContext || ""),
          messages,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ success: true, configured: true, conversations });
  } catch (error: any) {
    console.error("[chat/conversations GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to read conversations." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const denied = denyWrite(officer, "operational");
  if (denied) return denied;

  if (!isCatalystConfigured()) {
    return NextResponse.json(
      { success: false, error: "Catalyst is not connected." },
      { status: 503 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const id = String(body?.id || "").trim();
  if (!id) {
    return NextResponse.json({ success: false, error: "id is required." }, { status: 400 });
  }

  try {
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    const payload = {
      ConversationID: id,
      // From the session, never the body — otherwise a caller could write into
      // another officer's history.
      FirebaseUID: officer.uid,
      Title: String(body.title || "Untitled").slice(0, 250),
      Pinned: Boolean(body.pinned),
      ModuleContext: String(body.moduleContext || "").slice(0, 60),
      Messages: JSON.stringify(body.messages ?? []),
      CreatedAt: String(body.createdAt || now),
      UpdatedAt: now,
    };

    const existing = (await rowsFor(officer.uid)).find(
      (r) => String(r.ConversationID) === id
    );

    if (existing) {
      await updateRows(TABLE, [{ ROWID: existing.ROWID, ...payload }]);
    } else {
      await insertRows(TABLE, [payload]);
    }

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error("[chat/conversations POST]", error);
    return NextResponse.json(
      { success: false, error: "Failed to save the conversation." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }
  const denied = denyWrite(officer, "operational");
  if (denied) return denied;

  if (!isCatalystConfigured()) {
    return NextResponse.json({ success: false, error: "Catalyst is not connected." }, { status: 503 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ success: false, error: "id is required." }, { status: 400 });
  }

  try {
    // Scoped to this officer's rows, so a known id belonging to someone else
    // simply is not found.
    const target = (await rowsFor(officer.uid)).find(
      (r) => String(r.ConversationID) === String(id)
    );
    if (!target) {
      return NextResponse.json({ success: true, deleted: false });
    }
    await deleteRow(TABLE, target.ROWID);
    return NextResponse.json({ success: true, deleted: true });
  } catch (error: any) {
    console.error("[chat/conversations DELETE]", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete the conversation." },
      { status: 500 }
    );
  }
}
