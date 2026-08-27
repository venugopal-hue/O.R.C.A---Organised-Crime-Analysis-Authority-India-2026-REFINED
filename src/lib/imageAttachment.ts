import type { AttachmentFile } from "@/lib/chatService";

/**
 * Turning a picked File into something the assistant can actually use.
 *
 * Both chat surfaces - the full AIChatbotModule and the floating
 * MiniAIAssistant - need identical behaviour here. They have already drifted
 * apart twice (attachments were display-only in both, and each had to be fixed
 * separately), so the logic lives in one place rather than being copied.
 */

/** Text formats whose contents can be read straight off disk. */
export const READABLE_TEXT = /\.(txt|md|csv|json|log|xml|html?)$/i;

/** Cap on extracted text, to stay well inside the model's context window. */
export const MAX_ATTACHMENT_CHARS = 20000;

/**
 * Longest edge an attached photo is scaled to before being sent.
 *
 * A phone camera produces a 3000-4000px file of several megabytes. That is far
 * more than the model uses, and uploading it makes the officer wait for
 * nothing. 1600px keeps the small print on a scanned notice legible while
 * bringing a typical photo down to a few hundred kilobytes.
 */
export const MAX_IMAGE_EDGE = 1600;

/**
 * Edge length of the thumbnail that is small enough to persist.
 *
 * A whole conversation is saved as ONE Firestore document (1 MB ceiling) and
 * mirrored into localStorage, so the full image is deliberately not stored -
 * only this. See stripHeavyFields in chatService.
 */
export const THUMB_EDGE = 160;

/**
 * How many PDF pages are examined.
 *
 * A long attached document would otherwise blow the model's context window and
 * the officer's patience. Anything past this is reported rather than silently
 * dropped.
 */
export const MAX_PDF_PAGES = 20;

/**
 * How many pages of a SCANNED PDF are rendered and sent as images.
 *
 * Far lower than MAX_PDF_PAGES: each page becomes a full image upload, and the
 * route accepts at most 4.
 */
export const MAX_PDF_IMAGE_PAGES = 3;

/**
 * Below this many extracted characters a PDF is treated as scanned.
 *
 * A scanned page is not empty - it usually yields a few stray characters from
 * stamps or embedded metadata - so "any text at all" is the wrong test.
 */
export const MIN_PDF_TEXT_CHARS = 40;

/** File types the picker should offer, given what can be handled. */
export const ATTACHMENT_ACCEPT =
  "image/*,.pdf,.txt,.md,.csv,.json,.log,.xml,.html";

function draw(img: HTMLImageElement, edge: number, quality: number): string {
  const scale = Math.min(1, edge / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

/** Shrink a picked image to a send-sized copy plus a store-sized thumbnail. */
export function downscaleImage(
  file: File
): Promise<{ dataUrl: string; thumbUrl: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        resolve({
          dataUrl: draw(img, MAX_IMAGE_EDGE, 0.85),
          thumbUrl: draw(img, THUMB_EDGE, 0.6),
        });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image could not be decoded"));
    };
    img.src = url;
  });
}

/** Draw an already-rendered canvas down to a storable thumbnail. */
function thumbFromCanvas(canvas: HTMLCanvasElement): string {
  const scale = Math.min(1, THUMB_EDGE / Math.max(canvas.width, canvas.height));
  const t = document.createElement("canvas");
  t.width = Math.max(1, Math.round(canvas.width * scale));
  t.height = Math.max(1, Math.round(canvas.height * scale));
  t.getContext("2d")?.drawImage(canvas, 0, 0, t.width, t.height);
  return t.toDataURL("image/jpeg", 0.6);
}

/**
 * Load pdf.js on demand.
 *
 * Deliberately a dynamic import: pdf.js is a large library and the great
 * majority of chat messages never involve a PDF, so it is not worth putting in
 * the main bundle.
 */
async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
  }
  return pdfjs;
}

/**
 * Read a PDF: its text layer if it has one, otherwise pictures of its pages.
 */
export async function readPdf(file: File): Promise<AttachmentFile> {
  const base = { name: file.name, size: file.size, type: file.type || "application/pdf" };

  try {
    const pdfjs = await loadPdfJs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
      .promise;
    const examined = Math.min(doc.numPages, MAX_PDF_PAGES);

    // --- first attempt: the text layer.
    let text = "";
    for (let p = 1; p <= examined; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => (typeof item.str === "string" ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (pageText) text += `\n\n[page ${p}]\n${pageText}`;
    }

    if (text.trim().length >= MIN_PDF_TEXT_CHARS) {
      if (doc.numPages > examined) {
        text += `\n\n[Only the first ${examined} of ${doc.numPages} pages were read.]`;
      }
      return {
        ...base,
        textContent:
          text.length > MAX_ATTACHMENT_CHARS
            ? text.slice(0, MAX_ATTACHMENT_CHARS) + "\n\n[truncated]"
            : text.trim(),
      };
    }

    // --- no usable text layer, so this is a scan. Look at it instead.
    const pages = Math.min(examined, MAX_PDF_IMAGE_PAGES);
    const pageImages: string[] = [];
    let thumbUrl: string | undefined;

    for (let p = 1; p <= pages; p++) {
      const page = await doc.getPage(p);
      const base1 = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: Math.min(4, MAX_IMAGE_EDGE / Math.max(base1.width, base1.height)),
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      // A scan photographed on white paper renders with a transparent
      // background; flattened to JPEG that would come out black.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // intent "print" matters, and not for printing.
      //
      // The default display intent drives rendering from requestAnimationFrame,
      // which a background tab never fires. An officer who attaches a scan and
      // switches tabs while it processes would come back to a spinner that
      // never finishes - measured: it hangs indefinitely while hidden, and
      // completes in 17ms with this intent. Nothing is being painted on screen
      // here anyway; the page is drawn off-screen purely to make an image.
      await page.render({ canvas, canvasContext: ctx, viewport, intent: "print" }).promise;
      pageImages.push(canvas.toDataURL("image/jpeg", 0.85));
      if (p === 1) thumbUrl = thumbFromCanvas(canvas);
    }

    if (!pageImages.length) {
      return { ...base, readError: "This PDF could not be read." };
    }

    return {
      ...base,
      pageImages,
      thumbUrl,
      pageNote:
        doc.numPages > pages
          ? `Scanned PDF - the first ${pages} of ${doc.numPages} pages were read as images.`
          : undefined,
    };
  } catch {
    return { ...base, readError: "This PDF could not be opened." };
  }
}

/**
 * Read one picked file into an attachment.
 *
 * Images become pixels for the vision model; text files become text appended to
 * the prompt. Anything else is returned with a `readError` rather than being
 * attached and silently ignored - the failure that made the assistant answer
 * "you didn't paste the notice" while the file sat visibly in the thread.
 */
export async function readAttachment(file: File): Promise<AttachmentFile> {
  const base = { name: file.name, size: file.size, type: file.type || "document" };

  if (file.type.startsWith("image/")) {
    try {
      return { ...base, ...(await downscaleImage(file)) };
    } catch {
      return { ...base, readError: "This image could not be opened." };
    }
  }

  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    return readPdf(file);
  }

  const isText = READABLE_TEXT.test(file.name) || file.type.startsWith("text/");
  if (!isText) {
    return {
      ...base,
      readError:
        "The assistant can read images, PDFs and plain-text files " +
        "(.txt, .md, .csv, .json, .log). Paste the text instead.",
    };
  }

  try {
    const raw = await file.text();
    return {
      ...base,
      textContent:
        raw.length > MAX_ATTACHMENT_CHARS
          ? raw.slice(0, MAX_ATTACHMENT_CHARS) + "\n\n[truncated]"
          : raw,
    };
  } catch {
    return { ...base, readError: "The file could not be read." };
  }
}

/**
 * Split attachments into what the model gets as text, what it gets as pixels,
 * and what it cannot have at all.
 */
export function partitionAttachments(attachments: AttachmentFile[]) {
  const hasPixels = (a: AttachmentFile) => !!a.dataUrl || !!a.pageImages?.length;
  return {
    readable: attachments.filter((a) => a.textContent),
    images: attachments.filter(hasPixels),
    unreadable: attachments.filter((a) => !a.textContent && !hasPixels(a)),
  };
}

/**
 * Flatten attachments into the image list the route expects.
 *
 * One attachment is not one image: a scanned PDF contributes a picture per
 * page, so the payload is built here rather than by each caller mapping over
 * `dataUrl` and quietly losing pages 2 and 3.
 */
export function imagePayload(
  attachments: AttachmentFile[]
): { name: string; dataUrl: string }[] {
  const out: { name: string; dataUrl: string }[] = [];
  for (const a of attachments) {
    if (a.dataUrl) out.push({ name: a.name, dataUrl: a.dataUrl });
    (a.pageImages || []).forEach((dataUrl, i) =>
      out.push({ name: `${a.name} (page ${i + 1})`, dataUrl })
    );
  }
  return out;
}

/** Fold attachment text into the prompt the model actually receives. */
export function buildPromptWithAttachments(
  prompt: string,
  attachments: AttachmentFile[]
): string {
  const { readable, images, unreadable } = partitionAttachments(attachments);
  let out = prompt;

  if (readable.length) {
    out +=
      "\n\n--- Attached files ---\n" +
      readable.map((a) => `[${a.name}]\n${a.textContent}`).join("\n\n");
  }
  if (unreadable.length) {
    out +=
      `\n\n[The officer attached ${unreadable.map((a) => a.name).join(", ")}, ` +
      "which you cannot read. Say so plainly and ask them to paste the text.]";
  }
  const notes = attachments.map((a) => a.pageNote).filter(Boolean);
  if (notes.length) {
    // Say which pages were looked at, so a two-page answer to a ten-page
    // document does not read as a complete one.
    out += `\n\n[${notes.join(" ")}]`;
  }
  if (images.length && !prompt.trim()) {
    // "Here, look at this" with no question attached is a perfectly ordinary
    // thing to do, so give the model something to answer.
    out = "Read out the text in this document, and describe what it shows.";
  }
  return out;
}
