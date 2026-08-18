import { describe, expect, it } from "vitest";
import { quotationRegisterColumns } from "@/lib/export/quotations-register";

function systemQuotedColumn() {
  const col = quotationRegisterColumns.find((c) => c.header === "System Quoted");
  if (!col) throw new Error("System Quoted column missing");
  return col;
}

describe("quotationRegisterColumns — System Quoted", () => {
  it("uses the linked lead's product line when a lead is present", () => {
    const row = {
      lead: { productLine: "PROCESS_EQUIPMENT" },
      lineItems: [{ description: "Should not be used" }],
    } as never;

    expect(systemQuotedColumn().value(row)).toBe("Process Equipment");
  });

  it("falls back to joined line-item descriptions when no lead is linked", () => {
    const row = {
      lead: null,
      lineItems: [{ description: "Reactor Vessel Fabrication" }, { description: "Piping Installation" }],
    } as never;

    expect(systemQuotedColumn().value(row)).toBe("Reactor Vessel Fabrication; Piping Installation");
  });

  it("Remark column is always blank, never invented from status or notes", () => {
    const remarkCol = quotationRegisterColumns.find((c) => c.header === "Remark (If Any)");
    expect(remarkCol?.value({} as never)).toBe("");
  });
});

describe("quotationRegisterColumns — Enquiry No", () => {
  function enquiryColumn() {
    const col = quotationRegisterColumns.find((c) => c.header === "Enquiry No");
    if (!col) throw new Error("Enquiry No column missing");
    return col;
  }

  it("reads the real enquiryNumber field when one was captured", () => {
    expect(enquiryColumn().value({ enquiryNumber: "ENQ-045" } as never)).toBe("ENQ-045");
  });

  // Client-approved behaviour: quotations predating the enquiryNumber field
  // show blank. It must NOT fall back to quoteNumber — an enquiry and a
  // quotation are two different documents in the client's own workflow.
  it("stays blank rather than falling back to quoteNumber", () => {
    expect(enquiryColumn().value({ enquiryNumber: null, quoteNumber: "QT-1032" } as never)).toBe("");
  });
});

describe("quotationRegisterColumns — client-approved format", () => {
  // The client supplied this exact 8-column register via screenshot and
  // confirmed it should stay at 8 columns (no added Quote Number column).
  // This test is the guard on that decision.
  it("matches the client's screenshot exactly — 8 columns, in order", () => {
    expect(quotationRegisterColumns.map((c) => c.header)).toEqual([
      "Enquiry No",
      "Date",
      "Client Name",
      "Client Contact Person",
      "System Quoted",
      "Quoted Price",
      "Revision No",
      "Remark (If Any)",
    ]);
  });
});
