import "server-only";
import path from "node:path";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// Local filesystem storage for dev/demo use. The interface here (StoredFile,
// saveFile, deleteFile) is what the rest of the app depends on — swapping this
// file's implementation for Vercel Blob (`put()`/`del()`) or S3 in production
// requires no changes anywhere else, since callers only ever see `url` + `storageKey`.

export type StoredFile = {
  url: string;
  storageKey: string;
};

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

export async function saveFile(file: File, folder: string): Promise<StoredFile> {
  const dir = path.join(UPLOAD_ROOT, folder);
  await mkdir(dir, { recursive: true });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${randomUUID()}-${safeName}`;
  const storageKey = path.posix.join(folder, fileName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, fileName), buffer);

  return { url: `/uploads/${storageKey}`, storageKey };
}

export async function deleteFile(storageKey: string): Promise<void> {
  try {
    await unlink(path.join(UPLOAD_ROOT, storageKey));
  } catch {
    // Already gone — deleting a DB row shouldn't fail because the file did.
  }
}
