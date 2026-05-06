import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

const runtimeAssetDirs = [
  [
    "src/capabilities/ai/prompt-contracts/builtins",
    "dist/src/capabilities/ai/prompt-contracts/builtins",
  ],
  [
    "src/map-plugins/builtins",
    "dist/src/map-plugins/builtins",
  ],
  [
    "src/map-plugins/authoring/capability-catalog",
    "dist/src/map-plugins/authoring/capability-catalog",
  ],
];

for (const [source, target] of runtimeAssetDirs) {
  const sourcePath = path.join(repoRoot, source);
  const targetPath = path.join(repoRoot, target);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, { recursive: true, force: true });
}
