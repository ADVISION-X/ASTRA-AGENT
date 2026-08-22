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
import {
  buildAcceptanceLeafSkeletons,
  buildAcceptancePackageSkeletons,
} from "../audit/ci-acceptance-leaf-plan.js";
import { validateGeneratedPlanWorkerResult } from "../audit/ci-audit-plan-runner.js";
import { buildCiPhasePlan, buildCiPlanSkeleton, typecheckStep } from "../audit/ci-full-phase-plan.js";
import { sealCiPhasePlanOrFail } from "../audit/ci-phase-sealer.js";
import {
  evidenceFacetIsDeferredDynamic,
  type ClauseEvidenceFacet,
} from "../audit/shared/law-contracts.js";
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
import { runDynamicProofDenominatorAttacks } from "./ci-dynamic-proof-denominator.acceptance-support.js";

const { acceptanceSteps, plannedSteps } = buildCiPhasePlan();
const unsealedPlan = buildCiPlanSkeleton(buildAcceptancePackageSkeletons());
const packageScripts = (JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
}).scripts;
const generatedPlan = (JSON.parse(readFileSync("scripts/audit/generated/audit-plan.generated.json", "utf8")) as {
  entries: Array<{ bindings: Array<{ clauseId: string; evidenceMode: string; lawId: string }> }>;
}).entries;
const evidenceFacetForLeaf = (filePath: string): ClauseEvidenceFacet => {
  const binding = acceptanceLawBindings.get(filePath);
  if (!binding) throw new Error(`Acceptance law binding is missing for ${filePath}.`);
  const matches = generatedPlan.flatMap((entry) => entry.bindings)
    .filter((candidate) => candidate.lawId === binding.lawId && candidate.clauseId === binding.clauseId);
  if (matches.length !== 1) throw new Error(`Acceptance law binding does not resolve uniquely for ${filePath}.`);
  const facets = matches[0]!.evidenceMode.split("+") as ClauseEvidenceFacet[];
  if (facets.length > 1 && binding.evidenceFacet === undefined) {
    throw new Error(`Composite acceptance law binding is missing evidenceFacet for ${filePath}.`);
  }
  const facet = binding.evidenceFacet ?? facets[0];
  if (!facet || !facets.includes(facet)) throw new Error(`Acceptance evidenceFacet is outside law mode for ${filePath}.`);
  return facet;
};
const executableBindingPaths = [...acceptanceLawBindings.keys()]
  .filter((filePath) => !evidenceFacetIsDeferredDynamic(evidenceFacetForLeaf(filePath)));
const lawForDeferredLeaf = (filePath: string): boolean => {
  const binding = acceptanceLawBindings.get(filePath);
  return binding !== undefined
    && evidenceFacetIsDeferredDynamic(evidenceFacetForLeaf(filePath))
    && !acceptanceSteps.some((step) => step[2] === filePath);
};
const errorMessageIncludes = (fragment: string) => (error: unknown): boolean =>
  error instanceof Error && error.message.includes(fragment);

assert.equal(acceptanceSteps.length > 0, true, "ci:full must retain at least one governed physical acceptance leaf.");
assert.deepEqual(
  acceptanceSteps.map((step) => step[2]).sort(),
  executableBindingPaths.sort(),
  "CI acceptance leaves must equal every explicitly bound non-real-Chrome evidence facet.",
);
for (const filePath of [
  "scripts/acceptance/xuanxue-ai-production-browser-intervention.acceptance.ts",
  "scripts/acceptance/xuanxue-ai-production.acceptance.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-transient-lifecycle.acceptance.ts",
]) {
  assert.equal(acceptanceSteps.some((step) => step[2] === filePath && step[8] === "acceptance"), true,
    `${filePath} must execute and retain its composite acceptance-facet receipt.`);
}
assert.equal(lawForDeferredLeaf("scripts/acceptance/xuanxue-ai-production.real-chrome.ts"), true,
  "real Chrome production proof must remain explicitly bound and deferred by clause evidenceMode.");
assert.equal(lawForDeferredLeaf("scripts/acceptance/xuanxue-ai-production.real-provider.ts"), true,
  "persisted real-provider proof verification must remain explicitly bound and deferred by clause evidenceMode.");
assert.equal(lawForDeferredLeaf("scripts/acceptance/app-shell-ui.real-chrome.ts"), true,
  "App Shell physical cleanup must retain one candidate-bound real Chrome verifier.");
assert.equal(lawForDeferredLeaf("scripts/acceptance/dom-automation.real-chrome.ts"), true,
  "atomic DOM mutation must retain one candidate-bound real Chrome verifier.");
assert.equal(lawForDeferredLeaf("scripts/acceptance/dom-automation-exact-target.real-chrome.ts"), true,
  "exact target/document binding must retain one Browser-journal real Chrome verifier.");
assert.equal(lawForDeferredLeaf("scripts/acceptance/local-browser.real-chrome.ts"), true,
  "local Browser Authority must retain one proof-journal real Chrome verifier.");
assert.equal(
  evidenceFacetForLeaf("scripts/acceptance/xuanxue-ai-production.real-provider.ts"),
  "real-provider",
  "Provider proof must not masquerade as the real-Chrome facet.",
);
const missingCompositeFacetBindings = new Map(acceptanceLawBindings);
const compositeFixturePath = "scripts/acceptance/xuanxue-ai-production.acceptance.ts";
const compositeFixtureBinding = missingCompositeFacetBindings.get(compositeFixturePath);
if (!compositeFixtureBinding) throw new Error("Composite acceptance facet fixture is missing.");
missingCompositeFacetBindings.set(compositeFixturePath, {
  clauseId: compositeFixtureBinding.clauseId,
  lawId: compositeFixtureBinding.lawId,
});
assert.throws(
  () => buildAcceptanceLeafSkeletons(packageScripts, missingCompositeFacetBindings),
  errorMessageIncludes("explicitly bind one evidenceFacet"),
  "a composite clause must fail closed when only its acceptance-facet identity is removed",
);
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
assert.equal(acceptanceSteps.every((step) => step[7] !== null && step[8] !== null), true,
  "every acceptance receipt must retain a concrete clause and evidence facet.");
assert.equal(acceptanceSteps.every((step) => step[6] > 0), true, "every physical acceptance leaf must have a hard deadline.");
assert.equal(plannedSteps.every((step) => step[4] !== null && step[4].length > 0), true, "every sealed physical CI step must retain explicit law authority.");
assert.equal(typecheckStep[3], "APEX-CODE-PURITY-008-V1", "typecheck must bind the active type-escape law instead of using null authority.");
assert.equal(unsealedPlan.length, plannedSteps.length + 6,
  "the unsealed package skeleton must retain all six deferred dynamic facets until rebuilt authority classifies them.");
assert.equal(unsealedPlan.slice(5, -1).every((step) => step[3] === null && step[4] === null), true,
  "unsealed acceptance leaves must not claim law or owner authority before artifact rebuild.");
const lawForLeaf = (filePath: string): string | null => acceptanceSteps.find((step) => step[2] === filePath)?.[3] ?? null;
assert.equal(lawForLeaf("scripts/acceptance/app-shell-localization.acceptance.ts"), "GRASSEYE-APP-SHELL-UI-002-V1", "localization must bind its own law instead of the owner's first law.");
assert.equal(lawForLeaf("scripts/acceptance/amazon-invoice-upload-terminal.acceptance.ts"), "APEX-AMAZON-INVOICE-UPLOAD-001-V2", "Amazon terminal acceptance must bind the active terminal-authority law.");
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
runDynamicProofDenominatorAttacks();

const sampleSteps: StepResult[] = [
  {
    clauseId: null,
    command: "npm run sample",
    durationMs: 42,
    endedAt: "2026-05-24T00:00:42.000Z",
    evidenceFacet: null,
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

const facetFailureCompleted: StepResult[] = [];
const facetFailureSkeletons = buildAcceptancePackageSkeletons(packageScripts, missingCompositeFacetBindings);
const facetFailurePlan = buildCiPlanSkeleton(facetFailureSkeletons);
const facetFailFast = createFailFast(
  facetFailureCompleted,
  () => lawCoverage,
  () => ownerReports,
  () => facetFailurePlan,
);
assert.throws(
  () => sealCiPhasePlanOrFail(facetFailureSkeletons, facetFailFast, missingCompositeFacetBindings),
  (error) => error instanceof Error && error.message === "ci:full failed",
  "the real acceptance-authority phase must route a missing composite facet through fail-fast",
);
const facetFailureSummary = JSON.parse(readFileSync(ciFullSummaryPath, "utf8")) as {
  finalDecision: string;
  firstFailure: { message?: string } | null;
  skippedAfterFailure: Array<{ authorityStatus: string }>;
  status: string;
};
assert.equal(facetFailureSummary.status, "FAIL", "composite facet failure must replace any stale PASS summary.");
assert.equal(facetFailureSummary.finalDecision, "FAIL", "composite facet failure must change the final decision.");
assert.equal(facetFailureSummary.firstFailure?.message?.includes("explicitly bind one evidenceFacet"), true,
  "composite facet failure summary must retain the precise authority error.");
assert.equal(facetFailureSummary.skippedAfterFailure.length, facetFailurePlan.length - 3,
  "composite facet failure must retain the complete package skeleton as skipped authority-not-reached work.");

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
      clauseId: "apex-audit-001-requirement",
      command: "npm run later-step",
      durationMs: 0,
      endedAt: null,
      evidenceFacet: "static",
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
