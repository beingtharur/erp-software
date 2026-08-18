import { describe, expect, it } from "vitest";
import { payrollRegisterColumns, periodLabel, monthName } from "@/lib/export/payroll-register";

function column(header: string) {
  const col = payrollRegisterColumns.find((c) => c.header === header);
  if (!col) throw new Error(`${header} column missing`);
  return col;
}

describe("periodLabel", () => {
  it("formats month/year as a short, human-readable period", () => {
    expect(periodLabel(8, 2026)).toBe("Aug 2026");
    expect(periodLabel(1, 2027)).toBe("Jan 2027");
  });
});

describe("monthName", () => {
  it("maps a 1-indexed month to its short name", () => {
    expect(monthName(1)).toBe("Jan");
    expect(monthName(8)).toBe("Aug");
    expect(monthName(12)).toBe("Dec");
  });
});

describe("payrollRegisterColumns", () => {
  const baseRow = {
    employee: { employeeCode: "EOS-042", name: "Pooja Nair", department: { name: "HR" } },
    basicSalary: 50000,
    allowances: 5000,
    bonus: 1000,
    overtimePay: 500,
    deductions: 2000,
    netPay: 54500,
    status: "PROCESSED",
    month: 8,
    year: 2026,
  };

  it("reads Employee Code, Name, and Department from the nested employee relation", () => {
    expect(column("Employee Code").value(baseRow as never)).toBe("EOS-042");
    expect(column("Employee Name").value(baseRow as never)).toBe("Pooja Nair");
    expect(column("Department").value(baseRow as never)).toBe("HR");
  });

  it("falls back to an em dash when the employee has no department assigned", () => {
    const row = { ...baseRow, employee: { ...baseRow.employee, department: null } };
    expect(column("Department").value(row as never)).toBe("—");
  });

  it("exposes Basic Salary, Allowances, Bonus, Overtime Pay, Deductions, and Net Pay as raw numbers", () => {
    expect(column("Basic Salary").value(baseRow as never)).toBe(50000);
    expect(column("Allowances").value(baseRow as never)).toBe(5000);
    expect(column("Bonus").value(baseRow as never)).toBe(1000);
    expect(column("Overtime Pay").value(baseRow as never)).toBe(500);
    expect(column("Deductions").value(baseRow as never)).toBe(2000);
    expect(column("Net Pay").value(baseRow as never)).toBe(54500);
  });

  it("title-cases the status", () => {
    expect(column("Status").value(baseRow as never)).toBe("Processed");
  });

  it("splits the period into separate Month and Year columns", () => {
    expect(column("Month").value(baseRow as never)).toBe("Aug");
    expect(column("Year").value(baseRow as never)).toBe(2026);
  });

  it("has no combined Period column", () => {
    expect(payrollRegisterColumns.find((c) => c.header === "Period")).toBeUndefined();
  });

  it("matches the client-approved column order", () => {
    expect(payrollRegisterColumns.map((c) => c.header)).toEqual([
      "Employee Code",
      "Employee Name",
      "Department",
      "Basic Salary",
      "Allowances",
      "Bonus",
      "Overtime Pay",
      "Deductions",
      "Net Pay",
      "Status",
      "Month",
      "Year",
    ]);
  });
});
