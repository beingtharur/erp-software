import { describe, expect, it } from "vitest";
import { procurementQuotationColumns } from "@/lib/export/procurement-quotations";

function column(header: string) {
  const col = procurementQuotationColumns.find((c) => c.header === header);
  if (!col) throw new Error(`${header} column missing`);
  return col;
}

const baseRow = {
  quotationNumber: "PQ-2026-014",
  vendorName: "Alfa Laval India",
  projectName: "CIP Skid — 2000L",
  clientName: "JSW Group",
  clientContactPerson: "Rajeev Ahluwalia",
  quotedPrice: 1875000,
  quotationDate: new Date("2026-08-14T00:00:00"),
  remarks: "Freight excluded",
  version: 3,
};

describe("procurementQuotationColumns", () => {
  it("keeps the client's 8 columns first, in their exact order", () => {
    expect(procurementQuotationColumns.slice(0, 8).map((c) => c.header)).toEqual([
      "Enquiry No",
      "Date",
      "Client Name",
      "Client Contact Person",
      "System Quoted",
      "Quoted Price",
      "Revision No",
      "Remark",
    ]);
  });

  it("appends Vendor Name as the 9th column", () => {
    // Who quoted is the defining fact of a procurement quotation and has no
    // equivalent in the client's sales-side template.
    expect(procurementQuotationColumns[8].header).toBe("Vendor Name");
    expect(procurementQuotationColumns).toHaveLength(9);
  });

  it("maps every column to its real field", () => {
    expect(column("Enquiry No").value(baseRow as never)).toBe("PQ-2026-014");
    expect(column("Date").value(baseRow as never)).toEqual(baseRow.quotationDate);
    expect(column("Client Name").value(baseRow as never)).toBe("JSW Group");
    expect(column("Client Contact Person").value(baseRow as never)).toBe("Rajeev Ahluwalia");
    expect(column("System Quoted").value(baseRow as never)).toBe("CIP Skid — 2000L");
    expect(column("Quoted Price").value(baseRow as never)).toBe(1875000);
    expect(column("Revision No").value(baseRow as never)).toBe(3);
    expect(column("Remark").value(baseRow as never)).toBe("Freight excluded");
    expect(column("Vendor Name").value(baseRow as never)).toBe("Alfa Laval India");
  });

  it("renders the date as a real date so Excel can sort it", () => {
    expect(column("Date").numFmt).toBe("dd-mmm-yyyy");
  });

  it("leaves Quoted Price blank rather than zero when nobody priced it", () => {
    // 0 would read as "quoted at no charge" — a total is never assumed for a
    // document that has none recorded.
    const row = { ...baseRow, quotedPrice: null };
    expect(column("Quoted Price").value(row as never)).toBe("");
  });

  it("still exports a zero price when that is the real recorded value", () => {
    const row = { ...baseRow, quotedPrice: 0 };
    expect(column("Quoted Price").value(row as never)).toBe(0);
  });

  it("blanks the optional text fields instead of printing null", () => {
    const row = { ...baseRow, clientName: null, clientContactPerson: null, projectName: null, remarks: null };
    for (const h of ["Client Name", "Client Contact Person", "System Quoted", "Remark"]) {
      expect(column(h).value(row as never)).toBe("");
    }
  });
});
