import { beforeEach, describe, expect, it, vi } from "vitest";

// Tasks became a shared surface: the personal board on /me plus the HRMS Tasks
// console. That widened who may act on a task (ADMIN/HR now administer them
// org-wide), which makes two things load-bearing and worth pinning:
//   1. the permission matrix in lib/tasks.ts, and
//   2. org-scoped loading — the actions previously used a bare findUnique,
//      which was only safe while the rule was "the assignee themselves".

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const getCurrentUserMock = vi.fn();
vi.mock("@/lib/dal", () => ({
  getCurrentUser: getCurrentUserMock,
  requireRole: vi.fn(),
}));

const notifyEmployeeMock = vi.fn();
vi.mock("@/lib/notify", () => ({ notifyEmployee: notifyEmployeeMock }));

const taskFindFirstMock = vi.fn();
const taskUpdateMock = vi.fn();
const taskCreateMock = vi.fn();
const employeeCountMock = vi.fn();
const employeeFindFirstMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    personalTask: {
      findFirst: taskFindFirstMock,
      update: taskUpdateMock,
      create: taskCreateMock,
    },
    employee: { count: employeeCountMock, findFirst: employeeFindFirstMock },
    taskComment: { create: vi.fn(), deleteMany: vi.fn() },
  },
}));

const {
  canChangeTaskStatus,
  canEditTask,
  canSetTaskBlocked,
  canViewTask,
  isTaskAdministrator,
} = await import("@/lib/tasks");
const { updateTaskStatus, updateTask, createTask } = await import("@/lib/actions/tasks");

const TASK = { employeeId: "emp_assignee", assignedById: "emp_manager" };

const assignee = { accessRole: "SALES" as const, employeeId: "emp_assignee" };
const manager = { accessRole: "SALES" as const, employeeId: "emp_manager" };
const stranger = { accessRole: "SALES" as const, employeeId: "emp_other" };
const hr = { accessRole: "HR" as const, employeeId: "emp_hr" };
const admin = { accessRole: "ADMIN" as const, employeeId: "emp_admin" };

describe("task permission matrix", () => {
  it("treats ADMIN and HR as org-wide task administrators", () => {
    expect(isTaskAdministrator("ADMIN")).toBe(true);
    expect(isTaskAdministrator("HR")).toBe(true);
    expect(isTaskAdministrator("SALES")).toBe(false);
    expect(isTaskAdministrator("FIELD")).toBe(false);
    expect(isTaskAdministrator("PROCUREMENT")).toBe(false);
    expect(isTaskAdministrator("FINANCE")).toBe(false);
  });

  it("lets the assignee, the assigner and HR/ADMIN see a task, but not a bystander", () => {
    expect(canViewTask(assignee, TASK)).toBe(true);
    expect(canViewTask(manager, TASK)).toBe(true);
    expect(canViewTask(hr, TASK)).toBe(true);
    expect(canViewTask(admin, TASK)).toBe(true);
    expect(canViewTask(stranger, TASK)).toBe(false);
  });

  it("restricts editing and reassigning to the assigner and HR/ADMIN", () => {
    expect(canEditTask(manager, TASK)).toBe(true);
    expect(canEditTask(hr, TASK)).toBe(true);
    // The assignee does the work; they don't get to rewrite or re-route it.
    expect(canEditTask(assignee, TASK)).toBe(false);
    expect(canEditTask(stranger, TASK)).toBe(false);
  });

  it("lets the assignee keep moving status, and adds the assigner and HR/ADMIN", () => {
    expect(canChangeTaskStatus(assignee, TASK)).toBe(true);
    expect(canChangeTaskStatus(manager, TASK)).toBe(true);
    expect(canChangeTaskStatus(hr, TASK)).toBe(true);
    expect(canChangeTaskStatus(stranger, TASK)).toBe(false);
  });

  it("keeps blocker reporting assignee-only", () => {
    expect(canSetTaskBlocked(assignee, TASK)).toBe(true);
    expect(canSetTaskBlocked(manager, TASK)).toBe(false);
    expect(canSetTaskBlocked(hr, TASK)).toBe(false);
    expect(canSetTaskBlocked(admin, TASK)).toBe(false);
  });

  it("never treats a user without an employee record as assignee or assigner", () => {
    const portalOnly = { accessRole: "SALES" as const, employeeId: null };
    expect(canViewTask(portalOnly, TASK)).toBe(false);
    expect(canChangeTaskStatus(portalOnly, { employeeId: "x", assignedById: null })).toBe(false);
  });
});

describe("task actions scope every lookup to the caller's organization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    taskUpdateMock.mockResolvedValue({});
    taskCreateMock.mockResolvedValue({ id: "task_new" });
    employeeCountMock.mockResolvedValue(0);
  });

  it("loads the task through the employee relation, not a bare id", async () => {
    getCurrentUserMock.mockResolvedValue({
      id: "user_hr",
      accessRole: "HR",
      employeeId: "emp_hr",
      organizationId: "org_1",
      employee: { name: "Pooja" },
    });
    taskFindFirstMock.mockResolvedValue({ id: "task_1", ...TASK, title: "T", isBlocked: false });

    await updateTaskStatus("task_1", "DONE");

    expect(taskFindFirstMock).toHaveBeenCalledWith({
      where: { id: "task_1", employee: { organizationId: "org_1" } },
    });
  });

  it("refuses a task from another organization", async () => {
    getCurrentUserMock.mockResolvedValue({
      id: "user_hr",
      accessRole: "HR",
      employeeId: "emp_hr",
      organizationId: "org_1",
      employee: { name: "Pooja" },
    });
    // Org-scoped lookup finds nothing for a foreign task.
    taskFindFirstMock.mockResolvedValue(null);

    await expect(updateTaskStatus("foreign_task", "DONE")).rejects.toThrow(
      "Not authorized to update this task"
    );
    expect(taskUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects a status change from someone unrelated to the task", async () => {
    getCurrentUserMock.mockResolvedValue({
      id: "user_other",
      accessRole: "SALES",
      employeeId: "emp_other",
      organizationId: "org_1",
      employee: { name: "Nikhil" },
    });
    taskFindFirstMock.mockResolvedValue({ id: "task_1", ...TASK, title: "T", isBlocked: false });

    await expect(updateTaskStatus("task_1", "DONE")).rejects.toThrow(
      "Not authorized to update this task"
    );
    expect(taskUpdateMock).not.toHaveBeenCalled();
  });

  it("notifies the assigner when the assignee completes their task", async () => {
    getCurrentUserMock.mockResolvedValue({
      id: "user_assignee",
      accessRole: "SALES",
      employeeId: "emp_assignee",
      organizationId: "org_1",
      employee: { name: "Suresh" },
    });
    taskFindFirstMock.mockResolvedValue({
      id: "task_1",
      ...TASK,
      title: "Submit ID proof",
      isBlocked: false,
    });

    await updateTaskStatus("task_1", "DONE");

    expect(notifyEmployeeMock).toHaveBeenCalledWith(
      "emp_manager",
      expect.stringContaining("Submit ID proof"),
      "/hrms/tasks"
    );
  });

  it("blocks a non-administrator, non-assigner from editing a task", async () => {
    getCurrentUserMock.mockResolvedValue({
      id: "user_assignee",
      accessRole: "SALES",
      employeeId: "emp_assignee",
      organizationId: "org_1",
      employee: { name: "Suresh" },
    });
    taskFindFirstMock.mockResolvedValue({ id: "task_1", ...TASK });

    const fd = new FormData();
    fd.set("taskId", "task_1");
    fd.set("title", "Renamed");

    expect(await updateTask(undefined, fd)).toEqual({
      error: "You don't have permission to edit this task.",
    });
    expect(taskUpdateMock).not.toHaveBeenCalled();
  });
});

describe("who may assign work to someone else", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    taskCreateMock.mockResolvedValue({ id: "task_new" });
    employeeFindFirstMock.mockResolvedValue({ id: "emp_target" });
  });

  it("allows HR without needing direct reports", async () => {
    getCurrentUserMock.mockResolvedValue({
      id: "user_hr",
      accessRole: "HR",
      employeeId: "emp_hr",
      organizationId: "org_1",
      employee: { name: "Pooja" },
    });
    employeeCountMock.mockResolvedValue(0);

    const fd = new FormData();
    fd.set("title", "Collect signed contract");
    fd.set("assigneeId", "emp_target");

    expect(await createTask(undefined, fd)).toEqual({ success: true });
    expect(notifyEmployeeMock).toHaveBeenCalledWith(
      "emp_target",
      expect.stringContaining("Collect signed contract"),
      "/me/tasks"
    );
  });

  it("still refuses a plain employee with no direct reports", async () => {
    getCurrentUserMock.mockResolvedValue({
      id: "user_other",
      accessRole: "SALES",
      employeeId: "emp_other",
      organizationId: "org_1",
      employee: { name: "Nikhil" },
    });
    employeeCountMock.mockResolvedValue(0);

    const fd = new FormData();
    fd.set("title", "Do my work for me");
    fd.set("assigneeId", "emp_target");

    expect(await createTask(undefined, fd)).toEqual({
      error: "Only managers, HR and admins can assign tasks to other employees.",
    });
    expect(taskCreateMock).not.toHaveBeenCalled();
  });

  it("resolves the assignee inside the caller's organization only", async () => {
    getCurrentUserMock.mockResolvedValue({
      id: "user_admin",
      accessRole: "ADMIN",
      employeeId: "emp_admin",
      organizationId: "org_1",
      employee: { name: "Manan" },
    });
    employeeFindFirstMock.mockResolvedValue(null);

    const fd = new FormData();
    fd.set("title", "Cross-tenant attempt");
    fd.set("assigneeId", "emp_in_other_org");

    expect(await createTask(undefined, fd)).toEqual({ error: "Assignee not found." });
    expect(employeeFindFirstMock).toHaveBeenCalledWith({
      where: { id: "emp_in_other_org", organizationId: "org_1", deletedAt: null },
    });
    expect(taskCreateMock).not.toHaveBeenCalled();
  });
});
