// Central definition of which status transitions are actually allowed for
// each entity type. Previously every status dropdown/action in the app let
// you jump from any status to any other status unconditionally (e.g.
// OPEN -> CLOSED on a ticket, or PLANNED -> COMPLETED on a milestone that
// never started). This module is the single source of truth both the
// server actions and the UI dropdowns use to enforce a real state machine.
//
// Each map lists, for a given current status, the set of statuses it can
// move to next. Terminal states map to an empty array. Reopening a
// finished item back to an earlier state is intentionally allowed in a
// few places (e.g. CLOSED -> IN_PROGRESS) since that already happens in
// the app's existing business logic (resolvedAt gets cleared on reopen).

export type LeadStage =
  | "NEW"
  | "QUALIFIED"
  | "QUOTATION_SENT"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

export const LEAD_STAGE_TRANSITIONS: Record<LeadStage, readonly LeadStage[]> = {
  NEW: ["QUALIFIED", "LOST"],
  QUALIFIED: ["QUOTATION_SENT", "NEW", "LOST"],
  QUOTATION_SENT: ["NEGOTIATION", "QUALIFIED", "LOST"],
  NEGOTIATION: ["WON", "QUOTATION_SENT", "LOST"],
  WON: ["NEGOTIATION"],
  LOST: ["NEW"],
};

export type QuotationStatus = "DRAFT" | "SENT" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";

export const QUOTATION_STATUS_TRANSITIONS: Record<QuotationStatus, readonly QuotationStatus[]> = {
  DRAFT: ["SENT"],
  SENT: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED", "SENT"],
  APPROVED: [],
  REJECTED: ["DRAFT"],
};

export type MilestoneStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "DELAYED";

export const MILESTONE_STATUS_TRANSITIONS: Record<MilestoneStatus, readonly MilestoneStatus[]> = {
  PLANNED: ["IN_PROGRESS", "DELAYED"],
  IN_PROGRESS: ["COMPLETED", "DELAYED", "PLANNED"],
  DELAYED: ["IN_PROGRESS", "COMPLETED"],
  COMPLETED: ["IN_PROGRESS"],
};

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export const TICKET_STATUS_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "RESOLVED"],
  IN_PROGRESS: ["RESOLVED", "OPEN"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: ["IN_PROGRESS"],
};

export type ProjectTaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export const PROJECT_TASK_STATUS_TRANSITIONS: Record<ProjectTaskStatus, readonly ProjectTaskStatus[]> = {
  TODO: ["IN_PROGRESS", "DONE"],
  IN_PROGRESS: ["DONE", "TODO"],
  DONE: ["TODO"],
};

export type PoStatus = "DRAFT" | "SENT" | "CONFIRMED" | "DELIVERED" | "CANCELLED";

export const PO_STATUS_TRANSITIONS: Record<PoStatus, readonly PoStatus[]> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export type ProcurementQuotationStatus =
  | "RECEIVED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";

export const PROCUREMENT_QUOTATION_STATUS_TRANSITIONS: Record<
  ProcurementQuotationStatus,
  readonly ProcurementQuotationStatus[]
> = {
  RECEIVED: ["UNDER_REVIEW", "EXPIRED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED", "EXPIRED"],
  APPROVED: [],
  REJECTED: ["RECEIVED"],
  EXPIRED: ["RECEIVED"],
};

/** True if `from -> to` is an allowed transition (same-state is never "valid" — callers should just no-op). */
export function isValidTransition<S extends string>(
  map: Record<S, readonly S[]>,
  from: S,
  to: S
): boolean {
  if (from === to) return false;
  return (map[from] ?? []).includes(to);
}

/** The set of statuses `from` can legally move to next — used to build status-menu options. */
export function nextStatuses<S extends string>(map: Record<S, readonly S[]>, from: S): S[] {
  return [...(map[from] ?? [])];
}
