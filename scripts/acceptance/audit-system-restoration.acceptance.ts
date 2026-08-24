import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { CANONICAL_ACCEPTANCE_BINDINGS, CANONICAL_READY_PHASES, validateAcceptanceBindings } from "../audit/domains/audit-system/canonical-quality-plan.js";

const auditSystemFiles = readdirSync("scripts/audit/domains/audit-system").filter((name) => name !== "check.ts").sort();
const auditTruthFiles = [
  ...readdirSync("scripts/audit/domains/audit-truth").filter((name) => name !== "check.ts" && name !== "components"),
  ...readdirSync("scripts/audit/domains/audit-truth/components").map((name) => `components/${name}`),
];
assert.deepEqual(auditSystemFiles, [
  "acceptance-delivery-isolation-inspector.ts",
  "binary-verdict-inspector.ts",
  "canonical-quality-plan.ts",
  "ci-control-integrity-inspector.ts",
  "ci-entry-order-inspector.ts",
  "ci-failure-ledger-inspector.ts",
  "ci-integrity-ast.ts",
  "ci-phase-integrity-entry-inspector.ts",
  "ci-phase-integrity-inspector.ts",
  "control-flow-reachability.ts",
  "generated-artifact-truth-inspector.ts",
  "inspector.ts",
  "manifest.json",
  "manual-matrix-consumption-inspector.ts",
  "node-http-server-inspector.ts",
  "owner-evaluation-integrity-inspector.ts",
  "owner-filesystem-mutation-inspector.ts",
  "owner-registration-inspector.ts",
  "physical-check-receipt-inspector.ts",
  "primary-evidence-inspector.ts",
  "stale-code-purity-text-report.ts",
  "task-persistence-isolation-inspector.ts",
]);
assert.deepEqual(auditTruthFiles.sort(), [
  "components/audit-truth-scope.ts",
  "components/scan-audit-meta-quality-no-regex.ts",
  "components/scan-audit-no-regex.ts",
  "components/scan-audit-no-source-text-search.ts",
  "components/scan-generated-plan-coverage.ts",
  "inspector.ts",
  "manifest.json",
]);
const runtimeLogFiles = [
  ...readdirSync("scripts/audit/domains/runtime-log-spine").filter((name) => name !== "check.ts" && name !== "ast"),
  ...readdirSync("scripts/audit/domains/runtime-log-spine/ast").map((name) => `ast/${name}`),
];
assert.equal(runtimeLogFiles.length, 28);
assert.ok(existsSync("scripts/audit/domains/audit-system/check.ts"));
assert.ok(existsSync("scripts/audit/domains/audit-truth/check.ts"));
assert.ok(existsSync("scripts/acceptance/audit-source-evidence-reachability.acceptance.ts"));
assert.ok(existsSync("scripts/acceptance/audit-owner-filesystem-writer.acceptance.ts"));
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
const registry = JSON.parse(readFileSync("scripts/audit/generated/law-registry.generated.json", "utf8")) as { laws: Array<{ lawId: string; capabilityDomain: string }> };
const recovery = JSON.parse(readFileSync("docs/governance/AGENT-foundation-recovery-ledger.json", "utf8")) as {
  counts: { sourceModules: number; lawRecords: number; auditSystemFiles: number; codePurityFiles: number; ciDonors: number; acceptanceBindings: number };
  sourceModules: Array<Record<string, string>>;
  lawRecords: Array<Record<string, string>>;
  auditSystemFiles: Array<Record<string, string>>;
  codePurityFiles: Array<Record<string, string>>;
  ciDonors: Array<Record<string, string>>;
  acceptanceBindings: Array<Record<string, string>>;
};
assert.equal(pkg.scripts["audit:system:enforce"], "node --import tsx scripts/audit/domains/audit-system/check.ts");
assert.equal(pkg.scripts["audit:truth:enforce"], "node --import tsx scripts/audit/domains/audit-truth/check.ts");
assert.equal(pkg.scripts["audit:runtime-log-spine:enforce"], "node --import tsx scripts/audit/domains/runtime-log-spine/check.ts");
assert.deepEqual(recovery.counts, { sourceModules: 14, lawRecords: 70, auditSystemFiles: 21, codePurityFiles: 36, ciDonors: 4, acceptanceBindings: 12 });
assert.equal(recovery.sourceModules.length, 14);
assert.ok(recovery.sourceModules.every((item) => item.comparisonStatus === "INVENTORIED" && item.retirementDecision === "HISTORY_ONLY"));
assert.equal(CANONICAL_READY_PHASES.length, 9);
assert.equal(CANONICAL_ACCEPTANCE_BINDINGS.length, 12);
assert.deepEqual(validateAcceptanceBindings(pkg.scripts, registry.laws), []);
for (const item of [...recovery.lawRecords, ...recovery.auditSystemFiles, ...recovery.codePurityFiles, ...recovery.ciDonors, ...recovery.acceptanceBindings]) {
  assert.notEqual(item.semanticStatus, "MISSING");
  assert.notEqual(item.enforcementStatus, "MISSING");
  assert.notEqual(item.testStatus, "MISSING");
  assert.equal(item.ciStatus, "CALLED");
  assert.equal(item.evidenceStatus, "BOUND");
}
console.log("audit-system-restoration-acceptance-ok");
