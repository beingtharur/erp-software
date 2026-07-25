import "server-only";
import path from "node:path";
import { mkdir, writeFile, unlink, readFile as fsReadFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// Local filesystem storage for dev/demo use. The interface here (StoredFile,
// saveFile, deleteFile) is what the rest of the app depends on — swapping this
// file's implementation for Vercel Blob (`put()`/`del()`) or S3 in production
// requires no changes anywhere else, since callers only ever see `url` + `storageKey`.

export type StoredFile = {
  url: string;
  storageKey: string;
};

// DATA_DIR points uploads at a persistent-disk mount (e.g. Render's /data) in
// production. Unset locally, so local dev is unaffected — files stay under
// public/uploads and are served by Next's normal static file handling.
// When DATA_DIR is set, files live outside public/ (on the mounted disk) and
// are served by the app/api/uploads route instead.
const UPLOAD_ROOT = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, "uploads")
  : path.join(process.cwd(), "public", "uploads");

export async function saveFile(file: File, folder: string): Promise<StoredFile> {
  const dir = path.join(UPLOAD_ROOT, folder);
  await mkdir(dir, { recursive: true });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${randomUUID()}-${safeName}`;
  const storageKey = path.posix.join(folder, fileName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, fileName), buffer);

  const url = process.env.DATA_DIR ? `/api/uploads/${storageKey}` : `/uploads/${storageKey}`;
  return { url, storageKey };
}

export async function readFile(storageKey: string): Promise<Buffer | null> {
  try {
    return await fsReadFile(path.join(UPLOAD_ROOT, storageKey));
  } catch {
    return null;
  }
}

export async function deleteFile(storageKey: string): Promise<void> {
  try {
    await unlink(path.join(UPLOAD_ROOT, storageKey));
  } catch {
    // Already gone — deleting a DB row shouldn't fail because the file did.
  }
}
