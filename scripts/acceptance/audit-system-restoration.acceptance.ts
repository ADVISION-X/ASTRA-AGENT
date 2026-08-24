import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";

import {
  CANONICAL_ACCEPTANCE_BINDINGS,
  CANONICAL_READY_PHASES,
  validateAcceptanceBindings,
} from "../audit/domains/audit-system/canonical-quality-plan.js";

const auditSystemDirectory = "scripts/audit/domains/audit-system";
const auditSystemInspector = readFileSync(`${auditSystemDirectory}/inspector.ts`, "utf8");
const auditSystemInspectors = readdirSync(auditSystemDirectory)
  .filter((name) => name.endsWith("-inspector.ts"))
  .sort();

assert.ok(auditSystemInspectors.length > 0);
for (const inspector of auditSystemInspectors) {
  assert.match(auditSystemInspector, new RegExp(`from "\\./${inspector.replace(".ts", ".js")}"`));
}

assert.ok(existsSync("scripts/audit/domains/audit-system/check.ts"));
assert.ok(existsSync("scripts/audit/domains/audit-truth/check.ts"));
assert.ok(existsSync("scripts/audit/domains/code-purity/check.ts"));
assert.ok(existsSync("scripts/acceptance/audit-source-evidence-reachability.acceptance.ts"));
assert.ok(existsSync("scripts/acceptance/audit-owner-filesystem-writer.acceptance.ts"));
assert.ok(!existsSync("docs/governance/AGENT-foundation-recovery-ledger.json"));

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
const registry = JSON.parse(readFileSync("scripts/audit/generated/law-registry.generated.json", "utf8")) as {
  laws: Array<{ lawId: string; capabilityDomain: string; evidenceModes: string[] }>;
};

assert.equal(pkg.scripts["audit:system:enforce"], "node --import tsx scripts/audit/domains/audit-system/check.ts");
assert.equal(pkg.scripts["audit:truth:enforce"], "node --import tsx scripts/audit/domains/audit-truth/check.ts");
assert.equal(pkg.scripts["audit:code-purity:enforce"], "node --import tsx scripts/audit/domains/code-purity/check.ts");
assert.equal(pkg.scripts["audit:runtime-log-spine:enforce"], "node --import tsx scripts/audit/domains/runtime-log-spine/check.ts");
assert.deepEqual(CANONICAL_READY_PHASES, [
  "codex-entry-gate",
  "typecheck",
  "audit-self-test",
  "audit-system-mutants",
  "build-audit-artifacts",
  "active-law-full-coverage",
  "generated-plan-runner",
  "generated-artifact-truth",
  "acceptance-runner",
]);
assert.ok(CANONICAL_ACCEPTANCE_BINDINGS.length > 0);
assert.deepEqual(validateAcceptanceBindings(pkg.scripts, registry.laws), []);

console.log("audit-system-restoration-acceptance-ok");
