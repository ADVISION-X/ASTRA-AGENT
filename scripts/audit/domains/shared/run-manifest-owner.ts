import { pathToFileURL } from "node:url";

import { loadOwnerManifest } from "../../core/owner-manifests.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import type { DomainInspector, InspectorResult } from "../../core/schema.js";

const manifestArg = process.argv[2];

if (!manifestArg) {
  process.stdout.write("[OWNER][FAIL] missing manifest path argument\n");
  process.exit(1);
}

const manifest = loadOwnerManifest(pathFromRepoRoot(manifestArg));
const entryModule = await import(pathToFileURL(pathFromRepoRoot(manifest.entry)).href) as Record<string, unknown>;
const exportName = manifest.exportName ?? Object.keys(entryModule).find((key) => key.startsWith("run"));
const inspector = exportName ? entryModule[exportName] : undefined;

if (typeof inspector !== "function") {
  process.stdout.write(`[OWNER][FAIL] inspector export not found: ${manifest.entry}\n`);
  process.exit(1);
}

const result = await (inspector as DomainInspector)({ repoRoot: process.cwd() }) as InspectorResult;

if (result.passed) {
  process.stdout.write(`\n[${manifest.inspectorId.toUpperCase()}][PASS] findings=0 phases=${result.phases.length}\n\n`);
  process.exit(0);
}

process.stdout.write(`\n[${manifest.inspectorId.toUpperCase()}][FAIL] findings=${result.violationCount}\n\n`);
for (const finding of result.findings) {
  process.stdout.write(`  file: ${finding.file}:${finding.line}\n`);
  process.stdout.write(`  lawId: ${finding.lawId}\n`);
  process.stdout.write(`  violation: ${finding.message}\n`);
  if (finding.hint) process.stdout.write(`  fixDirection: ${finding.hint}\n`);
  process.stdout.write("\n");
}
process.exit(1);