import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { Project } from "ts-morph";

import {
  agentRouteCapabilityManifest,
} from "../../src/lib/local-runtime/production/catalog.js";
import {
  productRouteCatalogSnapshot,
  productionPluginCatalog,
  productionCatalogHash,
} from "../../src/mediator/product-plugin-catalog.js";
import { inspectProductAcceptanceBoundaries } from "../audit/domains/architecture-boundary/components/scan-product-acceptance-boundaries.js";
import { inspectBusinessRecoveryAuthorityBoundaries } from "../audit/domains/architecture-boundary/components/scan-product-acceptance-boundaries.js";
import { inspectRuntimeBrowserPrivateImports } from "../audit/domains/architecture-boundary/components/scan-plugin-capability-boundaries.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

const lawId = "LAW-ARCHITECTURE-BOUNDARY-001-V9";
const lawSource = readFileSync(".github/instructions/agent-rules/功能法案.md", "utf8");
const activeLaw = [...lawSource.matchAll(/```law-record\n([\s\S]*?)\n```/gu)]
  .map((match) => JSON.parse(match[1]!) as { lawId: string; forbidden?: string[] })
  .find((law) => law.lawId === lawId);
const frozenTombstone = activeLaw?.forbidden?.find((clause) =>
  clause.includes("TOMBSTONE-RECOVERY-AUTHORITY-001"));
assert.equal(createHash("sha256").update(frozenTombstone ?? "").digest("hex"),
  "0bc100c1ad5144a73ed085d7560c72552a80b3ff465dee18ca4d26fd84d199f9",
  "the frozen anti-resurrection Tombstone clause must remain byte-exact");
assert.match(frozenTombstone ?? "", /本 Tombstone 只有授权人再次明确解冻并授权双仓同步替换时可变更/u);
const testDirectory = resolve("scripts/acceptance/product-plugins");
const catalogIds = productionPluginCatalog.map((plugin) => plugin.pluginId).sort();
const testIds = readdirSync(testDirectory)
  .filter((name) => name.endsWith(".acceptance.ts"))
  .map((name) => name.slice(0, -".acceptance.ts".length))
  .sort();

assert(catalogIds.length > 0, "the current Catalog must publish at least one Product Plugin");
assert.equal(agentRouteCapabilityManifest.route_hash, productionCatalogHash);
assert.equal(agentRouteCapabilityManifest.routes.length, productRouteCatalogSnapshot.length);
for (const [index, route] of productRouteCatalogSnapshot.entries()) {
  const published = agentRouteCapabilityManifest.routes[index]!;
  assert.equal(published.product_id, route.product_id);
  assert.equal(published.action_id, route.action_id);
  assert.equal(published.task_contract_version, 1);
  assert.equal(published.result_contract_version, 1);
}
assert.deepEqual(testIds, catalogIds,
  "every current Product Plugin must have exactly one independently named acceptance file");

for (const testId of testIds) {
  const testPath = resolve(testDirectory, `${testId}.acceptance.ts`);
  const child = spawnSync(process.execPath, ["--import", "tsx", testPath], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
  });
  assert.equal(child.status, 0,
    `${testId} acceptance failed\n${child.stdout}\n${child.stderr}`);
}

const mutants: ReadonlyArray<readonly [string, string]> = [
  ["architecture/central-product-sequence", "const centralSequence = [];"],
  ["architecture/central-product-fixed-cardinality", `assert.equal(testIds.length, ${testIds.length});`],
  ["architecture/central-product-business-content", "const businessFlow = true;"],
  ["architecture/central-product-business-content", "const x = { businessField: true };"],
];
const tsConfigFilePath = "tsconfig.json";
for (const [checkId, source] of mutants) {
  const project = new Project({ tsConfigFilePath });
  const sourceFile = project.getSourceFileOrThrow(resolve("scripts/acceptance/architecture-boundary.acceptance.ts"));
  sourceFile.replaceWithText(`${sourceFile.getFullText()}\n${source}\n`);
  const findings: Parameters<typeof inspectProductAcceptanceBoundaries>[0]["findings"] = [];
  const inspectedFiles = new Set<string>();
  inspectProductAcceptanceBoundaries({ findings, inspectedFiles, lawId, project });
  assert.ok(findings.some((finding) => finding.checkId === checkId),
    `${source} must emit ${checkId}`);
}

const recoveryAuthorityMutants: ReadonlyArray<readonly [string, string, string]> = [
  ["src/plugins/public-knowledge-article-pipeline/business-recovery-mutant.ts",
    "architecture/product-business-recovery-decision-contract",
    "export interface ProductRecoveryResult { shouldRetry: boolean; retryAfterSeconds: number; nextAttempt: string; stopDemand: boolean; }"],
  ["src/lib/local-runtime/production/business-recovery-mutant.ts",
    "architecture/business-recovery-authority-resurrected",
    "export class BusinessRecoveryManager { decideNextAttempt(): string { return 'attempt-2'; } }"],
  ["src/capabilities/gpt/business-recovery-mutant.ts",
    "architecture/business-recovery-authority-dependency",
    "import { decide } from './business-recovery-planner.js'; export const value = decide();"],
];
for (const [filePath, checkId, source] of recoveryAuthorityMutants) {
  const project = new Project({ tsConfigFilePath });
  project.createSourceFile(resolve(filePath), source);
  const findings: Parameters<typeof inspectBusinessRecoveryAuthorityBoundaries>[0]["findings"] = [];
  const inspectedFiles = new Set<string>();
  inspectBusinessRecoveryAuthorityBoundaries({ findings, inspectedFiles, lawId, project });
  assert.ok(findings.some((finding) => finding.checkId === checkId),
    `${filePath} must emit ${checkId}`);
}

{
  const project = new Project({ tsConfigFilePath });
  const sourceFile = project.createSourceFile(
    resolve("src/lib/local-runtime/browser-private-import-mutant.ts"),
    'import type { BrowserMutationStore } from "../browser/exact-target/browser-mutation-store.js";\nexport type Mutant = BrowserMutationStore;\n',
  );
  const findings: Parameters<typeof inspectRuntimeBrowserPrivateImports>[0] = [];
  inspectRuntimeBrowserPrivateImports(
    findings,
    lawId,
    "src/lib/local-runtime/browser-private-import-mutant.ts",
    sourceFile,
  );
  assert.ok(findings.some((finding) => finding.checkId === "architecture/runtime-imports-browser-private"),
    "Runtime Browser-private import mutant must fail");
}

process.stdout.write("[ACCEPTANCE][architecture-boundary] PASS\n");
emitQualityProofObservation({
  lawId,
  evidenceMode: "exam.golden",
  clauses: ["forbidden:10", "forbidden:8", "forbidden:9", "summary"],
  locator: "acceptance:architecture-boundary",
  observedValue: "The byte-exact frozen Tombstone remained present; Catalog and Capability Manifest identities matched independent Product acceptances; central Product-content mutants and Product, Runtime, and GPT cross-attempt business-recovery authority mutants were rejected while same-attempt mechanisms remained in production",
});
