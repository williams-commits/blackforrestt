import test from "node:test";
import assert from "node:assert/strict";
import { prisma, repContext, rep2Context, managerContext, viewerContext, adminContext, makeLead, assertThrows } from "./helpers";
import { createTask } from "../src/server/records/tasks";
import { createNote } from "../src/server/records/notes";
import { createComment, listComments, updateComment, deleteComment } from "../src/server/records/comments";

/**
 * Comment feature coverage: permission gating (COMMENTS_CREATE/MANAGE),
 * parent-scope enforcement (task owner scope, note subject scope), CRUD
 * authorization (author vs manager), and the side effects every write must
 * produce (audit rows, timeline activity, COMMENT_ADDED notifications).
 */

test("commenting requires COMMENTS_CREATE (viewer is denied)", async () => {
  const rep = await repContext();
  const viewer = await viewerContext();
  const task = await createTask(rep, { title: "Comments: viewer gate" });

  try {
    await assertThrows(
      () => createComment(viewer, { body: "viewer should not post", subjectType: "TASK", subjectId: task.id }),
      403,
      "viewer without COMMENTS_CREATE",
    );
  } finally {
    await prisma.task.delete({ where: { id: task.id } }).catch(() => undefined);
  }
});

test("task comments follow the owner scope: another rep's task is invisible (404)", async () => {
  const rep = await repContext();
  const rep2 = await rep2Context();
  const task = await createTask(rep2, { title: "Comments: foreign task" });

  try {
    await assertThrows(
      () => createComment(rep, { body: "should not land", subjectType: "TASK", subjectId: task.id }),
      404,
      "OWN-scope rep on another owner's task",
    );
    const rows = await listComments(rep2, "TASK", task.id);
    assert.equal(rows.length, 0, "no comments leaked");
  } finally {
    await prisma.task.delete({ where: { id: task.id } }).catch(() => undefined);
  }
});

test("manager comments on a rep's task: row + audit + activity + owner notification (not actor)", async () => {
  const rep = await repContext();
  const manager = await managerContext();
  // Managers no longer see colleagues' tasks through scope alone — tag the
  // manager as a viewer (the new intended sharing model).
  const task = await createTask(rep, { title: "Comments: happy path", viewerUserIds: [manager.userId] });
  let commentId = "";

  try {
    const comment = await createComment(manager, {
      body: "Calling them tomorrow — draft summary attached.",
      subjectType: "TASK",
      subjectId: task.id,
    });
    commentId = comment.id;
    assert.equal(comment.author.name.length > 0, true, "author resolved");

    const listed = await listComments(rep, "TASK", task.id);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]!.body, "Calling them tomorrow — draft summary attached.");
    assert.equal(listed[0]!.author.id, manager.userId);

    // Side effects: audit, timeline activity (drives the SSE refresh), and a
    // COMMENT_ADDED notification for the OWNER — never the actor.
    const audit = await prisma.auditLog.findFirst({ where: { objectType: "Comment", objectId: comment.id, action: "COMMENT_CREATED" } });
    assert.ok(audit, "COMMENT_CREATED audit row");
    const activity = await prisma.activityEvent.findFirst({ where: { subjectType: "TASK", subjectId: task.id, kind: "comment" } });
    assert.ok(activity, "comment activity on the task timeline");
    const notification = await prisma.notification.findFirst({
      where: { recipientUserId: rep.userId, type: "COMMENT_ADDED", payload: { path: ["commentId"], equals: comment.id } },
    });
    assert.ok(notification, "owner notified about the comment");
    const actorNotifications = await prisma.notification.findMany({
      where: { recipientUserId: manager.userId, type: "COMMENT_ADDED", payload: { path: ["commentId"], equals: comment.id } },
    });
    assert.equal(actorNotifications.length, 0, "actor not self-notified");
  } finally {
    await prisma.notification.deleteMany({ where: { type: "COMMENT_ADDED", payload: { path: ["commentId"], equals: commentId } } }).catch(() => undefined);
    await prisma.comment.deleteMany({ where: { id: commentId } }).catch(() => undefined);
    await prisma.task.delete({ where: { id: task.id } }).catch(() => undefined);
  }
});

test("comment CRUD authorization: author edits; non-author without MANAGE rejected; manager manages", async () => {
  const rep = await repContext();
  const rep2 = await rep2Context();
  const manager = await managerContext();
  const task = await createTask(rep, { title: "Comments: crud authz", viewerUserIds: [rep2.userId, manager.userId] });
  let commentId = "";

  try {
    const comment = await createComment(rep, { body: "original", subjectType: "TASK", subjectId: task.id });
    commentId = comment.id;

    // Author edits own comment — editedAt is stamped.
    const edited = await updateComment(rep, commentId, { body: "original (typos fixed)" });
    assert.equal(edited.body, "original (typos fixed)");
    assert.ok(edited.editedAt, "editedAt set");

    // A different VISIBLE user (tagged viewer, no COMMENTS_MANAGE, not the
    // author) may neither edit nor delete.
    await assertThrows(() => updateComment(rep2, commentId, { body: "hijack" }), 403, "non-author edit");
    await assertThrows(() => deleteComment(rep2, commentId), 403, "non-author delete");

    // A manager (COMMENTS_MANAGE) may delete another user's comment.
    await deleteComment(manager, commentId);
    const gone = await prisma.comment.findUnique({ where: { id: commentId } });
    assert.equal(gone, null, "comment deleted");
    const audit = await prisma.auditLog.findFirst({ where: { objectType: "Comment", objectId: commentId, action: "COMMENT_DELETED" } });
    assert.ok(audit, "COMMENT_DELETED audit row");
    commentId = "";
  } finally {
    if (commentId) await prisma.comment.delete({ where: { id: commentId } }).catch(() => undefined);
    await prisma.task.delete({ where: { id: task.id } }).catch(() => undefined);
  }
});

test("note comments follow the note's subject scope", async () => {
  const rep = await repContext();
  const rep2 = await rep2Context();
  const manager = await managerContext();
  const leadId = await makeLead(rep, "comment-note");
  const note = await createNote(rep, { body: "Note for comment scoping.", subjectType: "LEAD", subjectId: leadId });

  try {
    // rep2 (OWN scope) cannot even see rep's lead → the note comment 404s.
    await assertThrows(
      () => createComment(rep2, { body: "outsider", subjectType: "NOTE", subjectId: note.id }),
      404,
      "out-of-scope note comment",
    );
    // A manager comments on the note; the note's AUTHOR is notified and the
    // activity lands on the LEAD's timeline (the note's subject).
    const comment = await createComment(manager, { body: "Good note — follow up Friday.", subjectType: "NOTE", subjectId: note.id });
    const leadActivity = await prisma.activityEvent.findFirst({ where: { subjectType: "LEAD", subjectId: leadId, kind: "comment" } });
    assert.ok(leadActivity, "comment activity attached to the note's subject");
    const notification = await prisma.notification.findFirst({
      where: { recipientUserId: rep.userId, type: "COMMENT_ADDED", payload: { path: ["commentId"], equals: comment.id } },
    });
    assert.ok(notification, "note author notified");
    await prisma.notification.deleteMany({ where: { type: "COMMENT_ADDED", payload: { path: ["commentId"], equals: comment.id } } });
    await prisma.comment.delete({ where: { id: comment.id } });
  } finally {
    await prisma.note.delete({ where: { id: note.id } }).catch(() => undefined);
    await prisma.activityEvent.deleteMany({ where: { subjectId: leadId, kind: "comment" } }).catch(() => undefined);
    await prisma.lead.delete({ where: { id: leadId } }).catch(() => undefined);
  }
});

test("regression: COMMENTS_MANAGE cannot reach comments on out-of-scope tasks", async () => {
  const rep = await repContext();
  const manager = await managerContext();
  // rep's task, NOT shared with the manager, with rep's own comment.
  const task = await createTask(rep, { title: "Comments: scope bypass guard" });
  const comment = await createComment(rep, { body: "private thread", subjectType: "TASK", subjectId: task.id });

  try {
    await assertThrows(() => deleteComment(manager, comment.id), 404, "manager on unshared task's comment");
    const stillThere = await prisma.comment.findUnique({ where: { id: comment.id } });
    assert.ok(stillThere, "comment untouched");
  } finally {
    await prisma.comment.delete({ where: { id: comment.id } }).catch(() => undefined);
    await prisma.task.delete({ where: { id: task.id } }).catch(() => undefined);
  }
});

test("regression: deleting a user who authored comments no longer FK-crashes", async () => {
  const admin = await adminContext();
  const role = await prisma.role.findFirstOrThrow({ where: { key: "REP" } });
  const throwaway = await prisma.user.create({
    data: {
      email: `comment-author-${Date.now()}@local.test`,
      passwordHash: "x",
      name: "Comment Author",
      roleId: role.id,
    },
  });
  const task = await createTask(admin, { title: "Comments: deletion FK guard" });
  await prisma.comment.create({
    data: { body: "will be reassigned", authorUserId: throwaway.id, subjectType: "TASK", subjectId: task.id },
  });

  const { deleteUser } = await import("../src/server/records/adminManage");
  await deleteUser(admin, throwaway.id); // must NOT throw P2003

  const reassigned = await prisma.comment.findFirst({ where: { subjectType: "TASK", subjectId: task.id } });
  assert.equal(reassigned?.authorUserId, admin.userId, "comment reassigned to the deleting admin");
  await prisma.comment.deleteMany({ where: { subjectId: task.id } });
  await prisma.task.delete({ where: { id: task.id } });
});
