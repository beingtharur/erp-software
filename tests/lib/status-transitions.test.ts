import { describe, expect, it } from "vitest";
import {
  LEAD_STAGE_TRANSITIONS,
  QUOTATION_STATUS_TRANSITIONS,
  MILESTONE_STATUS_TRANSITIONS,
  TICKET_STATUS_TRANSITIONS,
  PROJECT_TASK_STATUS_TRANSITIONS,
  PO_STATUS_TRANSITIONS,
  PROCUREMENT_QUOTATION_STATUS_TRANSITIONS,
  isValidTransition,
  nextStatuses,
} from "@/lib/status-transitions";

describe("isValidTransition", () => {
  it("rejects the previously-possible OPEN -> CLOSED ticket jump", () => {
    expect(isValidTransition(TICKET_STATUS_TRANSITIONS, "OPEN", "CLOSED")).toBe(false);
  });

  it("allows the intended OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED ticket path", () => {
    expect(isValidTransition(TICKET_STATUS_TRANSITIONS, "OPEN", "IN_PROGRESS")).toBe(true);
    expect(isValidTransition(TICKET_STATUS_TRANSITIONS, "IN_PROGRESS", "RESOLVED")).toBe(true);
    expect(isValidTransition(TICKET_STATUS_TRANSITIONS, "RESOLVED", "CLOSED")).toBe(true);
  });

  it("allows reopening a closed ticket", () => {
    expect(isValidTransition(TICKET_STATUS_TRANSITIONS, "CLOSED", "IN_PROGRESS")).toBe(true);
  });

  it("rejects the previously-possible PLANNED -> COMPLETED milestone jump", () => {
    expect(isValidTransition(MILESTONE_STATUS_TRANSITIONS, "PLANNED", "COMPLETED")).toBe(false);
  });

  it("rejects same-state as a transition", () => {
    expect(isValidTransition(MILESTONE_STATUS_TRANSITIONS, "PLANNED", "PLANNED")).toBe(false);
    expect(isValidTransition(QUOTATION_STATUS_TRANSITIONS, "DRAFT", "DRAFT")).toBe(false);
  });

  it("rejects DRAFT -> APPROVED quotation skip", () => {
    expect(isValidTransition(QUOTATION_STATUS_TRANSITIONS, "DRAFT", "APPROVED")).toBe(false);
  });

  it("allows the full quotation review path and revision reopen", () => {
    expect(isValidTransition(QUOTATION_STATUS_TRANSITIONS, "DRAFT", "SENT")).toBe(true);
    expect(isValidTransition(QUOTATION_STATUS_TRANSITIONS, "SENT", "UNDER_REVIEW")).toBe(true);
    expect(isValidTransition(QUOTATION_STATUS_TRANSITIONS, "UNDER_REVIEW", "APPROVED")).toBe(true);
    expect(isValidTransition(QUOTATION_STATUS_TRANSITIONS, "REJECTED", "DRAFT")).toBe(true);
  });

  it("treats APPROVED quotations and delivered/cancelled POs as terminal", () => {
    expect(nextStatuses(QUOTATION_STATUS_TRANSITIONS, "APPROVED")).toEqual([]);
    expect(nextStatuses(PO_STATUS_TRANSITIONS, "DELIVERED")).toEqual([]);
    expect(nextStatuses(PO_STATUS_TRANSITIONS, "CANCELLED")).toEqual([]);
  });

  it("rejects NEW -> WON lead-stage skip but allows the staged path", () => {
    expect(isValidTransition(LEAD_STAGE_TRANSITIONS, "NEW", "WON")).toBe(false);
    expect(isValidTransition(LEAD_STAGE_TRANSITIONS, "NEW", "QUALIFIED")).toBe(true);
    expect(isValidTransition(LEAD_STAGE_TRANSITIONS, "NEGOTIATION", "WON")).toBe(true);
  });

  it("matches the existing project-task-row.tsx button affordances exactly", () => {
    expect(nextStatuses(PROJECT_TASK_STATUS_TRANSITIONS, "TODO").sort()).toEqual(
      ["DONE", "IN_PROGRESS"].sort()
    );
    expect(nextStatuses(PROJECT_TASK_STATUS_TRANSITIONS, "IN_PROGRESS").sort()).toEqual(
      ["DONE", "TODO"].sort()
    );
    expect(nextStatuses(PROJECT_TASK_STATUS_TRANSITIONS, "DONE")).toEqual(["TODO"]);
  });

  it("rejects the RECEIVED -> APPROVED procurement quotation skip, requires review first", () => {
    expect(isValidTransition(PROCUREMENT_QUOTATION_STATUS_TRANSITIONS, "RECEIVED", "APPROVED")).toBe(
      false
    );
    expect(isValidTransition(PROCUREMENT_QUOTATION_STATUS_TRANSITIONS, "RECEIVED", "UNDER_REVIEW")).toBe(
      true
    );
    expect(isValidTransition(PROCUREMENT_QUOTATION_STATUS_TRANSITIONS, "UNDER_REVIEW", "APPROVED")).toBe(
      true
    );
  });

  it("treats an APPROVED procurement quotation as terminal, but REJECTED/EXPIRED can be resubmitted", () => {
    expect(nextStatuses(PROCUREMENT_QUOTATION_STATUS_TRANSITIONS, "APPROVED")).toEqual([]);
    expect(nextStatuses(PROCUREMENT_QUOTATION_STATUS_TRANSITIONS, "REJECTED")).toEqual(["RECEIVED"]);
    expect(nextStatuses(PROCUREMENT_QUOTATION_STATUS_TRANSITIONS, "EXPIRED")).toEqual(["RECEIVED"]);
  });
});
