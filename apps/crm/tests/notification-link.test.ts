import test from "node:test";
import assert from "node:assert/strict";
import { notificationHref } from "../src/lib/notificationLink";

/**
 * Notification deep links: every inbox entry lands on the exact page AND
 * tab holding its content (enterprise click-through), legacy fallbacks stay
 * safe, and malformed input still resolves to a meaningful destination.
 */

test("comment notifications deep-link to the tab holding the discussion", () => {
  // Comment on a TASK → task detail's Comments tab.
  assert.equal(
    notificationHref({ type: "COMMENT_ADDED", payload: { context: { href: "/tasks/task123" } } }),
    "/tasks/task123?tab=comments",
  );
  // Comment on a NOTE/appointment → the record's Activity tab.
  assert.equal(
    notificationHref({ type: "COMMENT_ADDED", payload: { context: { href: "/contacts/ctn123" } } }),
    "/contacts/ctn123?tab=activity",
  );
});

test("note and appointment notifications land on the record's Activity tab", () => {
  assert.equal(
    notificationHref({ type: "NOTE_ADDED", payload: { context: { href: "/leads/lead123" } } }),
    "/leads/lead123?tab=activity",
  );
  assert.equal(
    notificationHref({ type: "APPOINTMENT_SCHEDULED", payload: { context: { href: "/accounts/acc123" } } }),
    "/accounts/acc123?tab=activity",
  );
});

test("record-level notifications keep their plain destination", () => {
  assert.equal(
    notificationHref({ type: "RECORD_STATUS_CHANGED", payload: { context: { href: "/leads/lead123" } } }),
    "/leads/lead123",
  );
  assert.equal(
    notificationHref({ type: "TASK_REMINDER", payload: { context: { href: "/tasks/task123" } } }),
    "/tasks/task123",
  );
});

test("legacy notifications without contexts resolve from payload fields", () => {
  assert.equal(notificationHref({ type: "NOTE_ADDED", payload: { recordType: "LEAD", recordId: "lead123" } }), "/leads/lead123?tab=activity");
  assert.equal(notificationHref({ payload: { taskId: "task123" } }), "/tasks/task123");
  assert.equal(notificationHref({ payload: { jobId: "job123" } }), "/imports");
  assert.equal(notificationHref({ payload: {} }), "/");
});

test("unsafe or unresolvable hrefs never pass through", () => {
  // Protocol-relative / absolute hrefs are rejected — the context fallback applies.
  assert.equal(
    notificationHref({ type: "NOTE_ADDED", payload: { context: { href: "//evil.example" }, recordType: "LEAD", recordId: "lead123" } }),
    "/leads/lead123?tab=activity",
  );
  assert.equal(
    notificationHref({ type: "NOTE_ADDED", payload: { context: { href: "https://evil.example" }, recordType: "LEAD", recordId: "lead123" } }),
    "/leads/lead123?tab=activity",
  );
});
