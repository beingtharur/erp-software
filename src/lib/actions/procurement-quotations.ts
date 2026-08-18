"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { requireRole, getCurrentUser } from "@/lib/dal";
import { saveFile, deleteFile } from "@/lib/storage";
import {
  PROCUREMENT_QUOTATION_STATUS_TRANSITIONS,
  isValidTransition,
  type ProcurementQuotationStatus,
} from "@/lib/status-transitions";
import type { FormActionState } from "@/lib/actions/crm";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ["pdf", "xls", "xlsx", "doc", "docx", "jpg", "jpeg", "png"];

function extensionOf(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function readMetadataFields(formData: FormData) {
  // Kept as the raw string too, so validateMetadata can tell "left blank"
  // (legitimate — the field is optional) apart from "typed something that
  // isn't a number", which Number() would flatten to NaN either way.
  const quotedPriceRaw = String(formData.get("quotedPrice") ?? "").trim();
  return {
    quotationNumber: String(formData.get("quotationNumber") ?? "").trim(),
    vendorName: String(formData.get("vendorName") ?? "").trim(),
    projectName: String(formData.get("projectName") ?? "").trim() || null,
    clientName: String(formData.get("clientName") ?? "").trim() || null,
    clientContactPerson: String(formData.get("clientContactPerson") ?? "").trim() || null,
    quotedPriceRaw,
    quotedPrice: quotedPriceRaw ? Number(quotedPriceRaw) : null,
    quotationDate: String(formData.get("quotationDate") ?? ""),
    validUntil: String(formData.get("validUntil") ?? "") || null,
    remarks: String(formData.get("remarks") ?? "").trim() || null,
  };
}

function validateMetadata(fields: ReturnType<typeof readMetadataFields>): string | null {
  if (!fields.quotationNumber || !fields.vendorName || !fields.quotationDate) {
    return "Please fill in the quotation number, vendor name, and date.";
  }
  if (Number.isNaN(new Date(fields.quotationDate).getTime())) {
    return "Enter a valid quotation date.";
  }
  if (fields.validUntil && Number.isNaN(new Date(fields.validUntil).getTime())) {
    return "Enter a valid 'valid until' date.";
  }
  if (fields.quotedPriceRaw && (fields.quotedPrice === null || Number.isNaN(fields.quotedPrice) || fields.quotedPrice < 0)) {
    return "Enter a valid quoted price, or leave it blank.";
  }
  return null;
}

export async function uploadProcurementQuotation(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "PROCUREMENT"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;
  if (!user.employeeId) {
    return { error: "No employee record linked to this account." };
  }

  const fields = readMetadataFields(formData);
  const error = validateMetadata(fields);
  if (error) return { error };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a quotation file to upload." };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: "File is too large (max 10MB)." };
  }
  if (!ALLOWED_EXTENSIONS.includes(extensionOf(file.name))) {
    return { error: "Unsupported file type. Use PDF, Excel, Word, or an image." };
  }

  const { url, storageKey } = await saveFile(file, `quotations/${organizationId}`);

  // groupId ties every version of "the same" quotation together — it's set to
  // the first version's own id in a follow-up update, matching the two-step
  // create-then-self-reference pattern (cuid is server-generated, so it isn't
  // known before the row exists).
  const created = await prisma.procurementQuotation.create({
    data: {
      organizationId,
      quotationNumber: fields.quotationNumber,
      vendorName: fields.vendorName,
      projectName: fields.projectName,
      clientName: fields.clientName,
      clientContactPerson: fields.clientContactPerson,
      quotedPrice: fields.quotedPrice,
      quotationDate: new Date(fields.quotationDate),
      validUntil: fields.validUntil ? new Date(fields.validUntil) : null,
      remarks: fields.remarks,
      fileUrl: url,
      storageKey,
      fileName: file.name,
      fileSize: file.size,
      version: 1,
      isLatest: true,
      groupId: randomUUID(),
      uploadedById: user.employeeId,
    },
  });
  await prisma.procurementQuotation.update({
    where: { id: created.id },
    data: { groupId: created.id },
  });

  revalidatePath("/vendors/quotations");
  return { success: true };
}

async function assertCanEdit(quotationId: string, organizationId: string, actorEmployeeId: string | null, isAdmin: boolean) {
  const existing = await prisma.procurementQuotation.findFirst({
    where: { id: quotationId, organizationId },
  });
  if (!existing) {
    return { error: "Quotation not found." } as const;
  }
  if (!isAdmin && existing.uploadedById !== actorEmployeeId) {
    return { error: "You can only edit quotations you uploaded." } as const;
  }
  return { existing } as const;
}

export async function updateProcurementQuotationDetails(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "PROCUREMENT"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const quotationId = String(formData.get("quotationId") ?? "");
  const fields = readMetadataFields(formData);
  const error = validateMetadata(fields);
  if (error) return { error };

  const check = await assertCanEdit(quotationId, organizationId, user.employeeId, user.accessRole === "ADMIN");
  if ("error" in check) return check;

  await prisma.procurementQuotation.update({
    where: { id: quotationId },
    data: {
      quotationNumber: fields.quotationNumber,
      vendorName: fields.vendorName,
      projectName: fields.projectName,
      clientName: fields.clientName,
      clientContactPerson: fields.clientContactPerson,
      quotedPrice: fields.quotedPrice,
      quotationDate: new Date(fields.quotationDate),
      validUntil: fields.validUntil ? new Date(fields.validUntil) : null,
      remarks: fields.remarks,
    },
  });

  revalidatePath("/vendors/quotations");
  return { success: true };
}

export async function uploadProcurementQuotationVersion(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  await requireRole(["ADMIN", "PROCUREMENT"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;
  if (!user.employeeId) {
    return { error: "No employee record linked to this account." };
  }

  const quotationId = String(formData.get("quotationId") ?? "");
  const check = await assertCanEdit(quotationId, organizationId, user.employeeId, user.accessRole === "ADMIN");
  if ("error" in check) return check;
  const current = check.existing;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a new version of the file to upload." };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: "File is too large (max 10MB)." };
  }
  if (!ALLOWED_EXTENSIONS.includes(extensionOf(file.name))) {
    return { error: "Unsupported file type. Use PDF, Excel, Word, or an image." };
  }

  const { url, storageKey } = await saveFile(file, `quotations/${organizationId}`);

  await prisma.$transaction([
    prisma.procurementQuotation.update({ where: { id: current.id }, data: { isLatest: false } }),
    prisma.procurementQuotation.create({
      data: {
        organizationId,
        quotationNumber: current.quotationNumber,
        vendorName: current.vendorName,
        projectName: current.projectName,
        clientName: current.clientName,
        clientContactPerson: current.clientContactPerson,
        quotedPrice: current.quotedPrice,
        quotationDate: current.quotationDate,
        validUntil: current.validUntil,
        remarks: current.remarks,
        fileUrl: url,
        storageKey,
        fileName: file.name,
        fileSize: file.size,
        version: current.version + 1,
        isLatest: true,
        groupId: current.groupId,
        // status resets to RECEIVED — an updated document needs a fresh look,
        // it shouldn't inherit a stale APPROVED/REJECTED decision.
        status: "RECEIVED",
        uploadedById: user.employeeId,
      },
    }),
  ]);

  revalidatePath("/vendors/quotations");
  return { success: true };
}

export async function updateProcurementQuotationStatus(quotationId: string, next: ProcurementQuotationStatus) {
  await requireRole(["ADMIN", "PROCUREMENT"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const check = await assertCanEdit(quotationId, organizationId, user.employeeId, user.accessRole === "ADMIN");
  if ("error" in check) throw new Error(check.error);
  const existing = check.existing;

  if (!isValidTransition(PROCUREMENT_QUOTATION_STATUS_TRANSITIONS, existing.status as ProcurementQuotationStatus, next)) {
    throw new Error(`Can't move a quotation from ${existing.status} directly to ${next}.`);
  }

  await prisma.procurementQuotation.update({ where: { id: quotationId }, data: { status: next } });
  revalidatePath("/vendors/quotations");
}

// Admin-only — deletes the entire version group (all historical versions +
// their files), not just the latest row, so isLatest never dangles.
export async function deleteProcurementQuotation(groupId: string) {
  await requireRole(["ADMIN"]);
  const user = await getCurrentUser();
  const organizationId = user.organizationId!;

  const versions = await prisma.procurementQuotation.findMany({
    where: { groupId, organizationId },
  });
  if (versions.length === 0) {
    throw new Error("Quotation not found");
  }

  await prisma.procurementQuotation.deleteMany({ where: { groupId, organizationId } });
  await Promise.all(versions.map((v) => deleteFile(v.storageKey)));

  revalidatePath("/vendors/quotations");
}
