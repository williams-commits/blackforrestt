#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
let ts;
try {
  ts = require("typescript");
} catch {
  const globalRoot = execFileSync("npm", ["root", "--global"], { encoding: "utf8" }).trim();
  ts = (await import(pathToFileURL(path.join(globalRoot, "typescript/lib/typescript.js")).href)).default;
}

const root = path.resolve(process.argv[2] ?? ".");
const ignored = new Set(["node_modules", ".next", ".git", "artifacts"]);
const sourceExtensions = [".ts", ".tsx"];
const resolutionExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"];

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target, files);
    else if (sourceExtensions.some((extension) => entry.name.endsWith(extension))) files.push(target);
  }
  return files;
}

function resolves(base) {
  const candidates = [base];
  if (/\.(?:js|jsx|mjs|cjs)$/.test(base)) {
    candidates.push(
      base.replace(/\.(?:js|jsx|mjs|cjs)$/, ".ts"),
      base.replace(/\.(?:js|jsx|mjs|cjs)$/, ".tsx"),
    );
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return true;
    for (const extension of resolutionExtensions) {
      if (fs.existsSync(`${candidate}${extension}`)) return true;
      if (fs.existsSync(path.join(candidate, `index${extension}`))) return true;
    }
  }
  return false;
}

const files = walk(root).sort();
const syntaxDiagnostics = [];
const missingInternalImports = [];
const importPattern = /(?:from\s+|import\s*\(|require\s*\()\s*["']([^"']+)["']/g;

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  for (const diagnostic of sourceFile.parseDiagnostics ?? []) {
    syntaxDiagnostics.push({
      file: path.relative(root, file),
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
    });
  }

  let match;
  while ((match = importPattern.exec(text))) {
    const specifier = match[1];
    let base = null;
    if (specifier.startsWith("@/")) base = path.join(root, "src", specifier.slice(2));
    else if (specifier.startsWith(".")) base = path.resolve(path.dirname(file), specifier);
    if (base && !resolves(base)) {
      missingInternalImports.push({ file: path.relative(root, file), specifier });
    }
  }
}

const result = {
  kind: "typescript_static_verification",
  generatedAt: new Date().toISOString(),
  root,
  typescriptVersion: ts.version,
  fileCount: files.length,
  passed: syntaxDiagnostics.length === 0 && missingInternalImports.length === 0,
  syntaxDiagnostics,
  missingInternalImports,
};

console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
