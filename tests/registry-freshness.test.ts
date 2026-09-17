/**
 * Registry freshness gate (CI enforcement).
 *
 * The generated registries under src/domains/.generated and
 * src/designs/.generated are READ-ONLY artifacts. This test regenerates them
 * and FAILS on any difference — CI never silently accepts drift, and manual
 * edits to generated files are rejected.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const GENERATED = [
  "src/domains/.generated/domains.ts",
  "src/domains/.generated/content.ts",
  "src/designs/.generated/designs.ts",
];

test("generated registries are fresh (no manual edits, no drift)", () => {
  const before = Object.fromEntries(
    GENERATED.map((file) => [file, readFileSync(join(ROOT, file), "utf8")]),
  );
  try {
    execFileSync("node", [join(ROOT, "scripts/platform/generate-registry.mjs")], { stdio: "pipe" });
    for (const file of GENERATED) {
      const after = readFileSync(join(ROOT, file), "utf8");
      assert.equal(
        after,
        before[file],
        `${file} drifted from its sources. Never edit generated files — run: npm run registry:generate`,
      );
    }
  } finally {
    // RESTORE the pre-test state: the generator overwrites real files during
    // the test; on drift we report the failure AND restore the original
    // (drifted) bytes so the working tree is not silently mutated by testing.
    for (const [file, content] of Object.entries(before)) {
      const current = readFileSync(join(ROOT, file), "utf8");
      if (current !== content) writeFileSync(join(ROOT, file), content);
    }
  }
});

test("every generated file carries the READ-ONLY header", () => {
  for (const file of GENERATED) {
    const source = readFileSync(join(ROOT, file), "utf8");
    assert.ok(source.startsWith("// GENERATED FILE — DO NOT EDIT."), `${file}: missing header`);
    assert.ok(source.includes("// SOURCE:"), `${file}: missing SOURCE`);
    assert.ok(source.includes("// REGENERATE:"), `${file}: missing REGENERATE`);
  }
});
