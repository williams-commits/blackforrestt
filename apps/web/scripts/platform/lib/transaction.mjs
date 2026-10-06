/**
 * Transactional mutation helpers for generated artifacts + domain packages.
 *
 * The domain create/remove commands mutate multiple files that the registry
 * generator rewrites. These helpers capture the complete pre-transaction
 * state and restore it exactly on rollback — no partial restoration.
 */
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** All generated artifacts the registry generator rewrites. */
export function generatedArtifactPaths(ROOT) {
  return [
    join(ROOT, "src/domains/.generated/domains.ts"),
    join(ROOT, "src/domains/.generated/content.ts"),
    join(ROOT, "src/designs/.generated/designs.ts"),
    join(ROOT, "src/platform/.generated/composition-map.ts"),
  ];
}

/** Capture the byte state of every generated artifact (null if absent). */
export function snapshotGenerated(ROOT) {
  return Object.fromEntries(
    generatedArtifactPaths(ROOT).map((path) => [path, existsSync(path) ? readFileSync(path, "utf8") : null]),
  );
}

/** Restore a snapshot exactly: rewrite files that existed, delete those that
 *  did not. Returns the list of restored paths for reporting. */
export function restoreGenerated(ROOT, snapshot) {
  const restored = [];
  for (const [path, content] of Object.entries(snapshot)) {
    if (content === null) {
      if (existsSync(path)) { rmSync(path, { force: true }); restored.push(`${path} (removed — did not exist before)`);
      }
    } else {
      writeFileSync(path, content);
      restored.push(path);
    }
  }
  return restored;
}

/** Capture a directory tree (for rollback of domain packages + assets).
 *  Returns null if the path does not exist — the caller can then know the
 *  tree is NEW and safe to delete on rollback. */
export function snapshotDir(path) {
  if (!existsSync(path)) return null;
  // For small trees (domain packages, brand dirs) an in-memory copy is fine.
  const files = [];
  const walk = (dir, prefix = "") => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, rel);
      else files.push({ rel, content: readFileSync(full) });
    }
  };
  walk(path);
  return { path, files };
}

/** Restore a directory snapshot (noop if null). Returns true if restored. */
export function restoreDir(snapshot) {
  if (!snapshot) return false;
  rmSync(snapshot.path, { recursive: true, force: true });
  mkdirSync(snapshot.path, { recursive: true });
  for (const file of snapshot.files) {
    const target = join(snapshot.path, file.rel);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, file.content);
  }
  return true;
}
