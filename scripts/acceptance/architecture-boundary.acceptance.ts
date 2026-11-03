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
  productPluginCatalogSnapshot,
  productionPluginCatalog,
  productionCatalogHash,
} from "../../src/mediator/product-plugin-catalog.js";
import { inspectProductAcceptanceBoundaries } from "../audit/domains/architecture-boundary/components/scan-product-acceptance-boundaries.js";
import { inspectBusinessRecoveryAuthorityBoundaries } from "../audit/domains/architecture-boundary/components/scan-product-acceptance-boundaries.js";
import { inspectPluginBoundaries, inspectRuntimeBrowserPrivateImports } from "../audit/domains/architecture-boundary/components/scan-plugin-capability-boundaries.js";
import { inspectTargetAuthorityBoundary } from "../audit/domains/architecture-boundary/components/scan-target-authority-boundary.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { worktreeCandidateFingerprint } from "../audit/governance-git-state.js";
import { fail } from "../audit/governance-runtime.js";
import { assertQualityCommandPassed, collectQualityCheck, writeQualityIssues, type QualityCheckIssue } from "../audit/shared/quality-process-execution.js";

const lawId = "LAW-ARCHITECTURE-BOUNDARY-001-V20";
const lawSource = readFileSync(".github/instructions/agent-rules/功能法案.md", "utf8");
const lawRecords = [...lawSource.matchAll(/```law-record\n([\s\S]*?)\n```/gu)]
  .map((match) => JSON.parse(match[1]!) as { lawId: string; forbidden?: string[] });
const activeLaw = lawRecords.find((law) => law.lawId === lawId);
const frozenTombstone = activeLaw?.forbidden?.find((clause) =>
  clause.includes("TOMBSTONE-RECOVERY-AUTHORITY-001"));
assert.equal(createHash("sha256").update(frozenTombstone ?? "").digest("hex"),
  "d284f6b4b6af761ba58e1f5c0a41767e3211f4242583d3b1d6078d8f8b32523b",
  "the frozen anti-resurrection Tombstone clause must remain byte-exact");
assert.match(frozenTombstone ?? "", /本Tombstone已按授权精确解冻替换并重新冻结；未来改变仍须授权人再次明确解冻并授权双仓同步替换/u);
const targetLawId = "LAW-ARCHITECTURE-BOUNDARY-002-V2";
const targetAuthorityLaw = lawRecords.find((law) => law.lawId === targetLawId);
const frozenTargetAuthority = targetAuthorityLaw?.forbidden?.[0] ?? "";
assert.equal(createHash("sha256").update(frozenTargetAuthority).digest("hex"),
  "e5736bfc412ab00484d1f368bec35e65d74d68a38490161078a8fc3b1db81db7",
  "the frozen Target authority boundary clause must remain byte-exact");
assert.match(frozenTargetAuthority, /TARGET-AUTHORITY-BOUNDARY-001 被违反/u);
assert.match(frozenTargetAuthority, /未来改变仍须授权人再次明确解冻/u);
const testDirectory = resolve("scripts/acceptance/product-plugins");
const catalogIds = productionPluginCatalog.map((plugin) => plugin.pluginId).sort();
const testIds = readdirSync(testDirectory)
  .filter((name) => name.endsWith(".acceptance.ts"))
  .map((name) => name.slice(0, -".acceptance.ts".length))
  .sort();

assert(catalogIds.length > 0, "the current Catalog must publish at least one Product Plugin");
assert.equal(agentRouteCapabilityManifest.route_hash, productionCatalogHash);
assert.equal(agentRouteCapabilityManifest.routes.length, productPluginCatalogSnapshot.length);
for (const [index, route] of productPluginCatalogSnapshot.entries()) {
  const published = agentRouteCapabilityManifest.routes[index]!;
  assert.equal(published.product_id, route.product_id);
  assert.equal(published.action_id, route.action_id);
  assert.equal(published.task_contract_version, 1);
  assert.equal(published.result_contract_version, 1);
}
assert.deepEqual(testIds, catalogIds,
  "every current Product Plugin must have exactly one independently named acceptance file");

const productIssues: QualityCheckIssue[] = [];
const productCandidate = worktreeCandidateFingerprint();
const assertProductCandidate = (): void => {
  if (worktreeCandidateFingerprint() !== productCandidate) fail("CANDIDATE_DRIFT", "Product acceptances");
};
for (const testId of testIds) await collectQualityCheck(testId, () => {
  const testPath = resolve(testDirectory, `${testId}.acceptance.ts`);
  const child = spawnSync(process.execPath, ["--import", "tsx", testPath], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
  });
  if (child.status !== 0 && child.stderr) process.stderr.write(child.stderr);
  assertQualityCommandPassed(child, testId);
  assert.equal(child.status, 0,
    `${testId} acceptance failed\n${child.stdout}\n${child.stderr}`);
}, assertProductCandidate, productIssues);

const mutants: ReadonlyArray<readonly [string, string]> = [
  ["architecture/central-product-sequence", "const centralSequence = [];"],
  ["architecture/central-product-fixed-cardinality", `assert.equal(testIds.length, ${testIds.length});`],
  ["architecture/central-product-business-content", "const businessFlow = true;"],
  ["architecture/central-product-business-content", "const x = { businessField: true };"],
];
const tsConfigFilePath = "tsconfig.json";
{
  const project = new Project({ tsConfigFilePath });
  const productPath = `src/plugins/${catalogIds[0]!}/index.ts`;
  const product = project.getSourceFileOrThrow(resolve(productPath));
  const shared = project.getSourceFileOrThrow(resolve("src/lib/execution-failure.ts"));
  const originalProduct = product.getFullText(), originalShared = shared.getFullText();
  const inspect = () => {
    const findings: Parameters<typeof inspectPluginBoundaries>[0] = [];
    inspectPluginBoundaries(findings, lawId, productPath, product);
    return findings;
  };
  assert.deepEqual(inspect(), [], "the actual Product import tree must respect Runtime ownership");
  for (const statement of [
    "export { ProductionRuntimeStore as RuntimeStoreAlias } from './local-runtime/production/store.js';",
    "export * from './local-runtime/production/store.js';",
    "void import('./local-runtime/production/store.js');",
    "import './local-runtime/production/store.js';",
  ]) {
    shared.replaceWithText(`${originalShared}\n${statement}\n`);
    product.replaceWithText(`${originalProduct}\nimport * as hiddenRuntime from '../../lib/execution-failure.js';\nvoid hiddenRuntime;\n`);
    assert.ok(inspect().some((finding) => finding.checkId === "architecture/product-imports-runtime-private"),
      "shared alias, export-star, dynamic and side-effect edges cannot conceal Runtime private code");
  }
}
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

const authorityBoundaryCases: ReadonlyArray<readonly [string, string, string]> = [
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
for (const [filePath, checkId, source] of authorityBoundaryCases) {
  const project = new Project({ tsConfigFilePath });
  project.createSourceFile(resolve(filePath), source);
  const findings: Parameters<typeof inspectBusinessRecoveryAuthorityBoundaries>[0]["findings"] = [];
  const inspectedFiles = new Set<string>();
  inspectBusinessRecoveryAuthorityBoundaries({ findings, inspectedFiles, lawId, project });
  assert.ok(findings.some((finding) => finding.checkId === checkId),
    `${filePath} must emit ${checkId}`);
}

type TargetFindings = Parameters<typeof inspectTargetAuthorityBoundary>[0]["findings"];
const targetHandoffPath = "src/lib/local-runtime/production/runtime-source-handoff.ts";
const targetResurrectionCases: ReadonlyArray<readonly [string, string, string]> = [
  ["src/lib/browser/chrome-extension/target-resurrection-mutant.ts", "architecture/target-retired-authority-resurrected",
    "export const expectedTargetRef = 'sha256:x';"],
  ["src/lib/browser/exact-target/target-claims-mutant.ts", "architecture/target-retired-authority-resurrected",
    "export const persistentTargetLedger = 'browser_target_claims';"],
  ["src/lib/browser/exact-target/target-old-instance-mutant.ts", "architecture/target-retired-authority-resurrected",
    "export const code = 'BROWSER_OLD_TARGET_INSTANCE_UNAVAILABLE';"],
  ["src/lib/local-runtime/production/target-old-field-mutant.ts", "architecture/target-retired-authority-resurrected",
    "export const proof = { old_target_ref_hash: 'sha256:x' };"],
  ["src/lib/local-runtime/production/target-old-reject-mutant.ts", "architecture/target-retired-authority-resurrected",
    "export const reject = (value: object) => Object.hasOwn(value, 'old_path');"],
];
{
  const lawId = targetLawId;
  const project = new Project({ tsConfigFilePath });
  let findings: TargetFindings = [];
  const inspectedFiles = new Set<string>();
  inspectTargetAuthorityBoundary({ findings, inspectedFiles, lawId, project });
  assert.deepEqual(findings, [],
    "the real tree must keep every retired Target token at zero outside the V44 reject-only validator");
  for (const [filePath, , source] of targetResurrectionCases) project.createSourceFile(resolve(filePath), source);
  findings = [];
  inspectTargetAuthorityBoundary({ findings, inspectedFiles, lawId, project });
  for (const [filePath, checkId] of targetResurrectionCases) {
    assert.ok(findings.some((finding) => finding.checkId === checkId && finding.filePath === filePath),
      `${filePath} must emit ${checkId}`);
  }
}
{
  const lawId = targetLawId;
  const project = new Project({ tsConfigFilePath });
  const handoff = project.getSourceFileOrThrow(resolve(targetHandoffPath));
  const rejectItem = '\n    || Object.hasOwn(source, "target_settlement_hash")';
  assert.ok(handoff.getFullText().includes(rejectItem), "the V44 validator must currently reject target_settlement_hash");
  handoff.replaceWithText(handoff.getFullText().replace(rejectItem, ""));
  const findings: TargetFindings = [];
  const inspectedFiles = new Set<string>();
  inspectTargetAuthorityBoundary({ findings, inspectedFiles, lawId, project });
  assert.ok(findings.some((finding) => finding.checkId === "architecture/target-v44-reject-missing"
    && finding.evidence === "target_settlement_hash"),
  "silently deleting a V44 old-field rejection must fail");
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

assertProductCandidate();
writeQualityIssues(productIssues);
assert.deepEqual(productIssues, [], "all Product acceptances must pass");
process.stdout.write("[ACCEPTANCE][architecture-boundary] PASS\n");
emitQualityProofObservation({
  lawId,
  evidenceMode: "exam.golden",
  clauses: ["forbidden:10", "forbidden:11", "forbidden:8", "forbidden:9", "summary"],
  locator: "acceptance:architecture-boundary",
  observedValue: "The byte-exact frozen Tombstone remained present; Catalog and Capability Manifest identities matched independent Product acceptances; authorized article revision continued without fresh preparation while revision zero and both reviews remained fresh; central Product-content and cross-attempt business-recovery authority mutants were rejected",
});
{
  const lawId = targetLawId;
  emitQualityProofObservation({
    lawId,
    evidenceMode: "exam.golden",
    clauses: ["forbidden:0", "summary"],
    locator: "acceptance:architecture-boundary",
    observedValue: "The byte-exact frozen Target authority clause remained present, the real src tree kept every retired Target recovery token at zero outside the V44 reject-only validator, and five resurrection mutants plus one deleted V44 rejection were rejected.",
  });
}
