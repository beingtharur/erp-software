import { NextResponse } from "next/server";
import { readFile } from "@/lib/storage";

// Only used in production, where DATA_DIR moves uploads off the public/
// filesystem (see src/lib/storage.ts) — Next can no longer serve them
// statically, so this route reads them back the same way saveFile wrote them.
// Same access model as before: unlisted (random UUID filenames), not
// authenticated — consistent with how these files worked as public/ static
// assets, not a new restriction or a new exposure.

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;

  if (segments.some((segment) => segment.includes("..") || segment.includes("\0"))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const storageKey = segments.join("/");
  const file = await readFile(storageKey);
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = storageKey.slice(storageKey.lastIndexOf(".")).toLowerCase();
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
