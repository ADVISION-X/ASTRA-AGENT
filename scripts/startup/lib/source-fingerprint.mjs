import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const FINGERPRINT_ROOTS = [
  "src",
  "scripts/startup",
];

const INCLUDED_EXTENSIONS = new Set([".ts", ".mjs", ".json"]);

const walkFiles = (absoluteDir, pluginRoot) =>
  readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) return walkFiles(absolutePath, pluginRoot);
    if (!entry.isFile()) return [];
    const productSkill = entry.name === "SKILL.md" && absolutePath.startsWith(pluginRoot + path.sep);
    if (!productSkill && !INCLUDED_EXTENSIONS.has(path.extname(entry.name))) return [];
    return [absolutePath];
  });

export function buildStartupSourceFingerprint(rootDir) {
  const hash = createHash("sha256");
  const files = FINGERPRINT_ROOTS
    .flatMap((relativeRoot) => walkFiles(path.join(rootDir, relativeRoot), path.join(rootDir, "src/plugins")))
    .sort();

  for (const absolutePath of files) {
    const relativePath = path.relative(rootDir, absolutePath);
    const stat = statSync(absolutePath);
    hash.update(relativePath);
    hash.update("\0");
    hash.update(String(stat.size));
    hash.update("\0");
    hash.update(readFileSync(absolutePath));
    hash.update("\0");
  }

  return `sha256:${hash.digest("hex")}`;
}
