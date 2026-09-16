import test from "node:test";
import assert from "node:assert/strict";
import { prisma, repContext, rep2Context, managerContext, adminContext, assertThrows } from "./helpers";
import { createTask, updateTask, getTask, listTasks, taskVisibleWhere, canSeeAllTasks } from "../src/server/records/tasks";
import { createComment } from "../src/server/records/comments";
import type { ScopedContext } from "../src/server/records/leads";

/**
 * Task visibility model: owner ∪ tagged viewer users ∪ tagged viewer-team
 * members. "Everyone" (mine=0) exists ONLY for ADMIN/SUPER_ADMIN; managers
 * no longer see colleagues' tasks through team/hierarchy scope alone.
 */

const list = (ctx: ScopedContext, mine: "0" | "1" = "1") =>
  listTasks(ctx, { page: 1, pageSize: 50 }, { due: "all", mine });

test("canSeeAllTasks: admins yes, managers/reps no", async () => {
  const rep = await repContext();
  const manager = await managerContext();
  const admin = await adminContext();
  assert.equal(canSeeAllTasks(rep), false);
  assert.equal(canSeeAllTasks(manager), false, "managers lost scope-based all-tasks visibility by design");
  assert.equal(canSeeAllTasks(admin), true);
});

test("viewer user tag grants read access (list, detail, comment) but not edit", async () => {
  const rep = await repContext();
  const rep2 = await rep2Context();
  const manager = await managerContext();
  const task = await createTask(rep, {
    title: "Visibility: shared with rep2",
    viewerUserIds: [rep2.userId, manager.userId],
  });

  try {
    // Viewer sees the task in their list and can open it.
    const seen = (await list(rep2)).rows.find((row) => row.id === task.id);
    assert.ok(seen, "tagged viewer sees the task");
    const detail = await getTask(rep2, task.id);
    assert.equal(detail.title, "Visibility: shared with rep2");

    // Viewer can comment (read visibility governs commenting).
    const comment = await createComment(rep2, { body: "viewer commenting", subjectType: "TASK", subjectId: task.id });
    await prisma.comment.delete({ where: { id: comment.id } });

    // A REP viewer is blocked by TASKS_EDIT (they never held task edit);
    // a MANAGER viewer holds TASKS_EDIT but is still view-only — the
    // editable predicate 404s non-owner, non-admin edits.
    await assertThrows(() => updateTask(rep2, task.id, { title: "hijacked" }), 403, "rep viewer: no TASKS_EDIT");
    await assertThrows(() => updateTask(manager, task.id, { title: "hijacked" }), 404, "manager viewer: view-only");
    // Viewers CANNOT change the viewer list — the editable predicate 404s
    // them before the viewer-management guard (defense-in-depth) fires.
    await assertThrows(
      () => updateTask(manager, task.id, { viewerUserIds: [manager.userId] }),
      404,
      "viewer cannot manage viewers",
    );
  } finally {
    await prisma.taskViewer.deleteMany({ where: { taskId: task.id } });
    await prisma.task.delete({ where: { id: task.id } }).catch(() => undefined);
  }
});

test("unshared colleague task stays invisible — even with mine=0 (scope ladder removed)", async () => {
  const rep = await repContext();
  const rep2 = await rep2Context();
  const manager = await managerContext();
  const task = await createTask(rep2, { title: "Visibility: private task" });

  try {
    assert.equal((await list(rep)).rows.some((row) => row.id === task.id), false, "rep: not visible");
    assert.equal((await list(rep, "0")).rows.some((row) => row.id === task.id), false, "rep mine=0: still not visible");
    assert.equal((await list(manager, "0")).rows.some((row) => row.id === task.id), false, "manager mine=0: scope no longer leaks tasks");
    await assertThrows(() => getTask(rep, task.id), 404, "rep detail 404");
  } finally {
    await prisma.task.delete({ where: { id: task.id } }).catch(() => undefined);
  }
});

test("admin sees everything via mine=0", async () => {
  const rep = await repContext();
  const admin = await adminContext();
  const task = await createTask(rep, { title: "Visibility: admin all-seeing" });

  try {
    assert.ok((await list(admin, "0")).rows.some((row) => row.id === task.id), "admin mine=0 sees it");
    await getTask(admin, task.id); // no throw
  } finally {
    await prisma.task.delete({ where: { id: task.id } }).catch(() => undefined);
  }
});

test("team viewer tag grants access to every team member", async () => {
  const admin = await adminContext();
  const rep = await repContext();
  const rep2 = await rep2Context();
  const { visibleTeamIds } = await import("../src/server/scope");

  // Fresh team with two members (rep + rep2) so the scenario is hermetic.
  const team = await prisma.team.create({ data: { name: `vis-${Date.now()}` } });
  await prisma.teamMembership.createMany({
    data: [
      { teamId: team.id, userId: rep.userId },
      { teamId: team.id, userId: rep2.userId },
    ],
  });
  const task = await createTask(admin, { title: "Visibility: team tag", viewerTeamIds: [team.id] });
  try {
    for (const user of [rep, rep2]) {
      const ctx: ScopedContext = { ...user, teamIds: await visibleTeamIds(user.userId, user.scope) };
      assert.ok((await list(ctx)).rows.some((row) => row.id === task.id), `${user.roleKey} team member sees the tagged task`);
      await getTask(ctx, task.id);
    }
  } finally {
    await prisma.taskTeamViewer.deleteMany({ where: { taskId: task.id } });
    await prisma.task.delete({ where: { id: task.id } }).catch(() => undefined);
    await prisma.teamMembership.deleteMany({ where: { teamId: team.id } });
    await prisma.team.delete({ where: { id: team.id } }).catch(() => undefined);
  }
});

test("owner replace-all viewer update notifies only newly tagged users", async () => {
  const admin = await adminContext();
  const rep2 = await rep2Context();
  const manager = await managerContext();
  const task = await createTask(admin, { title: "Visibility: notify diff", viewerUserIds: [rep2.userId] });

  // rep2 was tagged at CREATION (one notification); the update must not
  // add another for them, only notify the newly tagged manager.
  const rep2Before = await prisma.notification.count({
    where: { type: "TASK_CREATED", payload: { path: ["taskId"], equals: task.id }, recipientUserId: rep2.userId },
  });
  assert.equal(rep2Before, 1, "creation-time viewer notification exists");

  try {
    await updateTask(admin, task.id, { viewerUserIds: [rep2.userId, manager.userId] });
    const notified = await prisma.notification.findMany({
      where: { type: "TASK_CREATED", payload: { path: ["taskId"], equals: task.id }, recipientUserId: manager.userId },
    });
    assert.equal(notified.length, 1, "newly tagged viewer notified exactly once");
    const rep2after = await prisma.notification.count({
      where: { type: "TASK_CREATED", payload: { path: ["taskId"], equals: task.id }, recipientUserId: rep2.userId },
    });
    assert.equal(rep2after, 1, "already-tagged viewer not re-notified");

    // Owner can manage; a plain viewer cannot.
    await assertThrows(() => updateTask(rep2, task.id, { viewerTeamIds: [] }), 403, "viewer cannot change viewers");
  } finally {
    await prisma.notification.deleteMany({ where: { type: "TASK_CREATED", payload: { path: ["taskId"], equals: task.id } } });
    await prisma.taskViewer.deleteMany({ where: { taskId: task.id } });
    await prisma.task.delete({ where: { id: task.id } }).catch(() => undefined);
  }
});

test("taskVisibleWhere: admin gets an empty (unfiltered) predicate", async () => {
  const admin = await adminContext();
  assert.deepEqual(taskVisibleWhere(admin), {});
});

test("ADMIN_ACCESS permission plumbing", async () => {
  const { ALL_PERMISSIONS, ROLE_DEFINITIONS, PERMISSION_CATEGORIES } = await import("../src/server/permissions");
  assert.ok(ALL_PERMISSIONS.includes("ADMIN_ACCESS"), "in catalog (roles editor renders it)");
  assert.ok(PERMISSION_CATEGORIES.some((category) => category.key === "ADMIN"), "own category");
  const admin = ROLE_DEFINITIONS.find((role) => role.key === "ADMIN")!;
  assert.ok(admin.permissions.includes("ADMIN_ACCESS"), "default ADMIN grant");
  const viewer = ROLE_DEFINITIONS.find((role) => role.key === "VIEWER")!;
  assert.ok(!viewer.permissions.includes("ADMIN_ACCESS"), "not granted to VIEWER by default");
});
