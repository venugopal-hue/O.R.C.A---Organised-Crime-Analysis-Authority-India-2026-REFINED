/**
 * No database client here.
 *
 * This module used to talk to Firestore directly from the browser. It now posts
 * to /api/chat/conversations, which authenticates the caller and writes to
 * Catalyst — the same store the admin console audits.
 */

export interface AttachmentFile {
  name: string;
  size: number;
  type: string;
  /**
   * Extracted text, for file types the assistant can actually read.
   *
   * This used to be absent entirely: attaching a file added a chip to the
   * message and nothing else. The bytes were never read and nothing was sent,
   * so the model replied "you didn't paste the notice" while the officer could
   * see their file sitting in the thread.
   *
   * Undefined means the content could not be extracted. For an image that is
   * expected - the picture travels in `dataUrl` instead. For anything else,
   * `readError` says why, so the UI can tell the officer rather than failing
   * silently.
   */
  textContent?: string;
  /**
   * Full downscaled image as a data URL. Sent to the vision model.
   *
   * NOT persisted - see stripHeavyFields below. It is a few hundred KB and the
   * whole conversation is stored as one Firestore document.
   */
  dataUrl?: string;
  /**
   * Rendered pages of a SCANNED PDF, one data URL each.
   *
   * A PDF with a real text layer never gets here - its text goes to
   * `textContent` instead, which is exact and far cheaper. This is the fallback
   * for a scan, which has no text to extract.
   *
   * Not persisted, for the same reason as `dataUrl`.
   */
  pageImages?: string[];
  /** Note for the model when only part of a document was read. */
  pageNote?: string;
  /** Small thumbnail (a few KB) kept so the picture survives a reload. */
  thumbUrl?: string;
  readError?: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "orca";
  text: string;
  timestamp: string;
  attachments?: AttachmentFile[];
  report?: any;
  media?: any;
  /**
   * What the assistant read to write this message.
   *
   * Built on the server from the rows actually retrieved — never from the
   * model's own text — and stored with the message so the evidence trail
   * survives a reload and appears in the exported PDF. It is small: the query,
   * its filters, the match count and the record identifiers, with no row
   * contents duplicated out of the tables being cited.
   */
  evidence?: {
    retrieval?: any;
    retrievalError?: string | null;
    unsupported?: string[];
    contradiction?: boolean;
    unverifiedAbsence?: boolean;
  };
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: string;
  pinned: boolean;
  messages: ChatMessage[];
  moduleContext?: string;
}


/**
 * Drop anything too big to store before a conversation is written.
 *
 * A whole conversation goes into ONE Firestore document (1 MB ceiling) and is
 * mirrored into localStorage (~5 MB per origin). Full-size attached images
 * would breach both, and dbSaveConversation only logs a warning on failure - so
 * the officer would silently lose their chat history. The thumbnail is kept so
 * the message still shows the picture after a reload.
 */
function stripHeavyFields(conversation: ChatConversation): ChatConversation {
  const heavy = (a: AttachmentFile) => !!a.dataUrl || !!a.pageImages?.length;
  if (!conversation.messages?.some((m) => m.attachments?.some(heavy))) {
    return conversation;
  }
  return {
    ...conversation,
    messages: conversation.messages.map((m) =>
      m.attachments?.length
        ? {
            ...m,
            attachments: m.attachments.map(({ dataUrl, pageImages, ...rest }) => rest),
          }
        : m
    ),
  };
}

/**
 * Conversations live in CATALYST, not Firestore.
 *
 * They were written to `users/{uid}/conversations` in Firestore with a
 * localStorage mirror, while the admin console's AI monitoring reads Catalyst
 * `OfficerActivity`. The two disagreed by construction: an administrator
 * auditing AI use could see that a query happened but never what was asked,
 * and an officer on a second machine saw a different history again.
 *
 * `userId` is still taken as a parameter so callers do not change, but it is
 * NOT sent — the route derives ownership from the verified session, which is
 * the only version a caller cannot lie about.
 */
export async function dbSaveConversation(userId: string, conversation: ChatConversation): Promise<void> {
  const storable = stripHeavyFields(conversation);
  const res = await fetch("/api/chat/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(storable),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to save the conversation.");
  }
}

export async function dbDeleteConversation(userId: string, conversationId: string): Promise<void> {
  const res = await fetch(
    `/api/chat/conversations?id=${encodeURIComponent(conversationId)}`,
    { method: "DELETE", credentials: "include" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to delete the conversation.");
  }
}

/**
 * No localStorage mirror.
 *
 * The mirror existed as a fallback when Firestore was unreachable, but it made
 * the history browser-specific — an officer signing in elsewhere saw a
 * different set of threads, with no way to tell which was complete. An empty
 * list on a failed read is the honest answer.
 */
export async function dbLoadConversations(userId: string): Promise<ChatConversation[]> {
  try {
    const res = await fetch("/api/chat/conversations", { credentials: "include" });
    const data = await res.json();
    if (!res.ok || !data.success) return [];
    return (data.conversations || []) as ChatConversation[];
  } catch {
    return [];
  }
}
