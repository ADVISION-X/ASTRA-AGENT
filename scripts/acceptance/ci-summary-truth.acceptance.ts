import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ciFullSummaryPath,
  createFailFast,
  writeCiFullSummary,
  type CiFullFirstFailure,
  type CiFullLawCoverage,
  type CiFullOwnerReport,
  type StepResult,
} from "../audit/ci-full.js";
import { acceptanceLawBindings } from "../audit/ci-acceptance-law-bindings.js";
import { buildAcceptanceLeafSkeletons } from "../audit/ci-acceptance-leaf-plan.js";
import { validateGeneratedPlanWorkerResult } from "../audit/ci-audit-plan-runner.js";
import { buildCiPhasePlan, buildCiPlanSkeleton, typecheckStep } from "../audit/ci-full-phase-plan.js";
import { runBinaryVerdictAttacks } from "./audit-binary-verdict.attacks.js";
import { runControlFlowReachabilityAttacks } from "./audit-control-flow-reachability.attacks.js";
import { runDeliveryIsolationAttacks } from "./audit-delivery-isolation.attacks.js";
import { runGeneratedArtifactTruthAttacks } from "./audit-generated-artifact-truth.attacks.js";
import { runManualMatrixAttacks } from "./audit-manual-matrix.attacks.js";
import { runOwnerFilesystemMutationAttacks } from "./audit-owner-filesystem-mutation.attacks.js";
import { runPhysicalCheckReceiptAttacks } from "./audit-physical-check-receipts.attacks.js";
import { runPhasePlanAttacks } from "./audit-phase-plan.attacks.js";
import { runRound8PhysicalReceiptAttacks } from "./audit-physical-check-receipts-round8.attacks.js";
import { runAuditRunIdentityAttacks } from "./audit-run-identity.attacks.js";
import { runWorkerLifecycleAttacks } from "./audit-worker-lifecycle.attacks.js";

const { acceptanceSteps, plannedSteps } = buildCiPhasePlan();
const unsealedPlan = buildCiPlanSkeleton(buildAcceptanceLeafSkeletons());
const packageScripts = (JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
}).scripts;
const generatedPlan = (JSON.parse(readFileSync("scripts/audit/generated/audit-plan.generated.json", "utf8")) as {
  entries: Array<{ bindings: Array<{ clauseId: string; evidenceMode: string; lawId: string }> }>;
}).entries;
const deferredBindings = new Set(generatedPlan.flatMap((entry) => entry.bindings)
  .filter((binding) => binding.evidenceMode === "real-chrome")
  .map((binding) => `${binding.lawId}::${binding.clauseId}`));
const executableBindingPaths = [...acceptanceLawBindings.entries()]
  .filter(([, binding]) => !deferredBindings.has(`${binding.lawId}::${binding.clauseId}`))
  .map(([filePath]) => filePath);
const lawForDeferredLeaf = (filePath: string): boolean => {
  const binding = acceptanceLawBindings.get(filePath);
  return binding !== undefined
    && deferredBindings.has(`${binding.lawId}::${binding.clauseId}`)
    && !acceptanceSteps.some((step) => step[2] === filePath);
};
const errorMessageIncludes = (fragment: string) => (error: unknown): boolean =>
  error instanceof Error && error.message.includes(fragment);

assert.equal(acceptanceSteps.length > 0, true, "ci:full must retain at least one governed physical acceptance leaf.");
assert.deepEqual(
  acceptanceSteps.map((step) => step[2]).sort(),
  executableBindingPaths.sort(),
  "CI acceptance leaves must equal the explicitly bound non-real-Chrome law clauses.",
);
assert.equal(lawForDeferredLeaf("scripts/acceptance/xuanxue-ai-production.real-chrome.ts"), true,
  "real Chrome production proof must remain explicitly bound and deferred by clause evidenceMode.");
assert.equal(lawForDeferredLeaf("src/capabilities/ai-input-gateway/acceptance/xuanxue-ai-production-real-proof-verify.ts"), true,
  "persisted real-provider proof verification must remain explicitly bound and deferred by clause evidenceMode.");
assert.throws(
  () => buildAcceptanceLeafSkeletons({
    ...packageScripts,
    "acceptance:unbound-decoy": "node --import tsx scripts/acceptance/unbound-decoy.acceptance.ts",
  }),
  errorMessageIncludes("package/binding closure mismatch"),
  "a new ordinary package acceptance leaf must fail closed until it receives an explicit binding",
);
assert.throws(
  () => buildAcceptanceLeafSkeletons({
    ...packageScripts,
    "acceptance:cycle-a": "npm run acceptance:cycle-b",
    "acceptance:cycle-b": "npm run acceptance:cycle-a",
  }),
  errorMessageIncludes("cycle detected"),
  "package acceptance discovery must reject recursive script cycles",
);
assert.throws(
  () => buildAcceptanceLeafSkeletons({
    ...packageScripts,
    "acceptance:unknown-command": "node scripts/acceptance/unknown-command.ts",
  }),
  errorMessageIncludes("unsupported command"),
  "package acceptance discovery must reject commands outside the direct governed grammar",
);
const argumentBearingLeaf = buildAcceptanceLeafSkeletons({
  ...packageScripts,
  "acceptance:audit-truth-argument-probe": "node --import tsx scripts/acceptance/audit-truth-coverage.acceptance.ts --fixture bounded",
}).find((leaf) => leaf.command.at(-2) === "--fixture");
assert.deepEqual(
  argumentBearingLeaf?.command,
  ["node", "--import", "tsx", "scripts/acceptance/audit-truth-coverage.acceptance.ts", "--fixture", "bounded"],
  "direct governed acceptance arguments must survive discovery and sealing without a wrapper or second runner",
);
assert.equal(new Set(acceptanceSteps.map((step) => step[2])).size, acceptanceSteps.length, "each physical acceptance path must receive exactly one CI step receipt.");
assert.equal(acceptanceSteps.every((step) => step[1][0] === "node"), true, "CI must execute direct acceptance leaves instead of npm groups containing && chains.");
assert.equal(acceptanceSteps.every((step) => step[3] !== null && step[5] !== "acceptance-group"), true, "every acceptance receipt must retain a concrete law and owner.");
assert.equal(acceptanceSteps.every((step) => step[6] > 0), true, "every physical acceptance leaf must have a hard deadline.");
assert.equal(plannedSteps.every((step) => step[4] !== null && step[4].length > 0), true, "every sealed physical CI step must retain explicit law authority.");
assert.equal(typecheckStep[3], "APEX-CODE-PURITY-008-V1", "typecheck must bind the active type-escape law instead of using null authority.");
assert.equal(unsealedPlan.length, plannedSteps.length, "the pre-entry skeleton must contain every physical CI step.");
assert.equal(unsealedPlan.slice(5, -1).every((step) => step[3] === null && step[4] === null), true,
  "unsealed acceptance leaves must not claim law or owner authority before artifact rebuild.");
const lawForLeaf = (filePath: string): string | null => acceptanceSteps.find((step) => step[2] === filePath)?.[3] ?? null;
assert.equal(lawForLeaf("scripts/acceptance/app-shell-localization.acceptance.ts"), "GRASSEYE-APP-SHELL-UI-002-V1", "localization must bind its own law instead of the owner's first law.");
assert.equal(lawForLeaf("scripts/acceptance/amazon-invoice-upload-batch.acceptance.ts"), "GRASSEYE-AMAZON-INVOICE-UPLOAD-012-V1", "Amazon batch acceptance must bind the batch law.");
assert.equal(lawForLeaf("scripts/acceptance/amazon-invoice-upload-smoke.ts"), "GRASSEYE-AMAZON-INVOICE-UPLOAD-008-V1", "Amazon fixture smoke must bind machine acceptance authority, not deferred Chrome proof.");
assert.equal(lawForLeaf("src/capabilities/ai-input-gateway/acceptance/provider-boundary.acceptance.ts"), "APEX-AI-INPUT-GATEWAY-002-V1", "Provider boundary acceptance must bind the governed browser and raw-response contract.");
assert.equal(lawForLeaf("src/capabilities/ai-input-gateway/acceptance/attachment-routing.acceptance.ts"), "APEX-AI-INPUT-GATEWAY-003-V1", "Attachment routing acceptance must bind the fixed transport-routing contract.");
assert.equal(lawForLeaf("src/capabilities/ai-input-gateway/acceptance/attachment.acceptance.ts"), "APEX-AI-INPUT-GATEWAY-004-V1", "Attachment proof acceptance must bind the aggregate stability and identity contract.");

await runPhysicalCheckReceiptAttacks();
runBinaryVerdictAttacks();
runAuditRunIdentityAttacks();
runManualMatrixAttacks();
runOwnerFilesystemMutationAttacks();
runPhasePlanAttacks();
runRound8PhysicalReceiptAttacks();
runControlFlowReachabilityAttacks();
runDeliveryIsolationAttacks();
runGeneratedArtifactTruthAttacks();
runWorkerLifecycleAttacks();

const sampleSteps: StepResult[] = [
  {
    command: "npm run sample",
    durationMs: 42,
    endedAt: "2026-05-24T00:00:42.000Z",
    name: "sample-step",
    ownerId: "sample",
    lawId: "APEX-AUDIT-001-V1",
    phase: "sample-phase",
    startedAt: "2026-05-24T00:00:00.000Z",
    status: "PASS",
    timeoutMs: 60_000,
  },
];

const lawCoverage: CiFullLawCoverage = {
  activeLawCount: 1,
  activeClauseCount: 1,
  boundClauseCount: 1,
  checked: true,
  uncoveredClauseIds: [],
};

const ownerReports: CiFullOwnerReport[] = [{
  capabilityDomain: "sample",
  findingCount: 0,
  reportPath: "scripts/audit/generated/sample-report.generated.json",
  status: "PASS",
}];

const firstFailure: CiFullFirstFailure = {
  phase: "typecheck",
  command: "npm run typecheck",
  lawId: "APEX-CODE-PURITY-008-V1",
  filePath: "tsconfig.json",
  message: "typecheck failed",
  minimalFixHint: "repair typecheck",
};

assert.throws(
  () => validateGeneratedPlanWorkerResult({ ok: true, result: { domainReports: [], hasFailures: false } }),
  (error) => error instanceof Error && error.message.includes("owner reports; expected"),
  "the generated-plan parent must reject a syntactically valid but empty owner receipt set.",
);
assert.throws(
  () => validateGeneratedPlanWorkerResult({ ok: true, result: { domainReports: [], hasFailures: false }, extra: true }),
  (error) => error instanceof Error && error.message.toLowerCase().includes("unrecognized key"),
  "the generated-plan parent must reject worker message fields outside the authenticated schema.",
);

const failFast = createFailFast([], () => lawCoverage, () => ownerReports, () => plannedSteps);
assert.throws(
  () => failFast(4, firstFailure, { ...sampleSteps[0]!, status: "FAIL", error: "typecheck failed" }),
  (error) => error instanceof Error && error.message === "ci:full failed",
  "the real fail-fast control path must terminate after writing its summary",
);
const failedPathSummary = JSON.parse(readFileSync(ciFullSummaryPath, "utf8")) as {
  completedSteps: StepResult[];
  skippedAfterFailure: Array<{ status: string; startedAt: null; endedAt: null; durationMs: number }>;
};
assert.equal(failedPathSummary.completedSteps[0]?.status, "FAIL", "the failing physical step must retain its terminal receipt.");
assert.equal(failedPathSummary.completedSteps[0]?.durationMs, 42, "the failing physical step must retain its duration.");
assert.equal(failedPathSummary.skippedAfterFailure.every((step) => step.status === "SKIPPED"), true, "all not-started steps must carry explicit SKIPPED receipts.");
assert.equal(failedPathSummary.skippedAfterFailure.every((step) => step.startedAt === null && step.endedAt === null && step.durationMs === 0), true, "skipped receipts must prove that execution never started.");

const earlyFailFast = createFailFast([], () => lawCoverage, () => [], () => unsealedPlan);
assert.throws(() => earlyFailFast(0, firstFailure, {
  ...sampleSteps[0]!, name: "codex-entry-gate", phase: "codex-entry-gate", status: "FAIL",
}), (error) => error instanceof Error && error.message === "ci:full failed",
"entry failure must enter the same terminal writer.");
const earlySummary = JSON.parse(readFileSync(ciFullSummaryPath, "utf8")) as {
  skippedAfterFailure: Array<{ authorityStatus: string; lawId: string | null; ownerId: string | null }>;
};
assert.equal(earlySummary.skippedAfterFailure.length, unsealedPlan.length - 1,
  "entry failure must record every remaining physical step as skipped.");
assert.equal(earlySummary.skippedAfterFailure.slice(4, -1).every((step) =>
  step.authorityStatus === "authority_not_reached" && step.lawId === null && step.ownerId === null), true,
"early failure must not fill acceptance authority from stale generated truth.");

writeCiFullSummary({
  status: "FAIL",
  firstFailure,
  completedSteps: sampleSteps,
  skippedAfterFailure: [
    {
      authorityStatus: "sealed",
      command: "npm run later-step",
      durationMs: 0,
      endedAt: null,
      lawId: "APEX-AUDIT-001-V1",
      name: "later-step",
      ownerId: "sample",
      phase: "acceptance-runner",
      startedAt: null,
      status: "SKIPPED",
      timeoutMs: 60_000,
    },
  ],
  lawCoverage,
  ownerReports,
  finalDecision: "FAIL",
});

const parsed = JSON.parse(readFileSync(ciFullSummaryPath, "utf8")) as {
  completedSteps: StepResult[];
  finalDecision: "PASS" | "FAIL";
  firstFailure: CiFullFirstFailure | null;
  generatedAt: string;
  lawCoverage: CiFullLawCoverage;
  ownerReports: CiFullOwnerReport[];
  mode: string;
  skippedAfterFailure: Array<{ command: string; name: string; phase: string }>;
  status: "PASS" | "FAIL";
};

assert.equal(parsed.status, "FAIL", "ci summary writer should preserve fail-fast status.");
assert.equal(parsed.mode, "fail_fast", "ci summary writer must persist fail_fast mode.");
assert.equal(parsed.completedSteps.length, 1, "ci summary writer should persist completed steps.");
assert.equal(parsed.completedSteps[0]?.command, "npm run sample", "completed step must include command.");
assert.equal(typeof parsed.completedSteps[0]?.durationMs, "number", "completed step must include durationMs.");
assert.equal(typeof parsed.completedSteps[0]?.startedAt, "string", "completed step must include startedAt.");
assert.equal(typeof parsed.completedSteps[0]?.endedAt, "string", "completed step must include endedAt.");
assert.equal(parsed.completedSteps[0]?.ownerId, "sample", "completed step must retain the physical leaf owner.");
assert.equal(parsed.completedSteps[0]?.lawId, "APEX-AUDIT-001-V1", "completed step must retain law authority.");
assert.equal(parsed.completedSteps[0]?.timeoutMs, 60_000, "completed step must retain its hard deadline.");
assert.equal(parsed.firstFailure?.phase, "typecheck", "ci summary must persist firstFailure.phase.");
assert.equal(parsed.firstFailure?.command, "npm run typecheck", "ci summary must persist firstFailure.command.");
assert.equal(parsed.firstFailure?.lawId, "APEX-CODE-PURITY-008-V1", "ci summary must preserve typecheck law authority.");
assert.equal(parsed.firstFailure?.filePath, "tsconfig.json", "ci summary must persist firstFailure.filePath.");
assert.equal(parsed.firstFailure?.message, "typecheck failed", "ci summary must persist firstFailure.message.");
assert.equal(parsed.firstFailure?.minimalFixHint, "repair typecheck", "ci summary must persist minimalFixHint.");
assert.equal(parsed.skippedAfterFailure.length, 1, "ci summary must persist skippedAfterFailure.");
assert.equal(parsed.skippedAfterFailure[0]?.name, "later-step", "skipped steps must retain their names.");
assert.equal(parsed.lawCoverage.activeLawCount, 1, "ci summary must persist law coverage summary.");
assert.equal(parsed.ownerReports[0]?.capabilityDomain, "sample", "ci summary must persist generic owner reports.");
assert.equal(parsed.finalDecision, "FAIL", "ci summary must persist finalDecision.");
assert.equal(typeof parsed.generatedAt, "string", "ci summary must include generatedAt.");

console.log("ci-summary-truth-acceptance-ok");
