export type NegativeProofMutation = {
  name: string;
  file: string;
  oldText: string;
  newText: string;
  skipBuild?: boolean;
};

export const OWNER_BINDING_MUTATION_NAMES = [
  "manual-first-enforcement",
  "warning-only-p0",
  "negative-proof-invocation-removed",
] as const;

export const POST_ACTION_NEGATIVE_PROOF_MUTATIONS: NegativeProofMutation[] = [
  {
    name: "manual-first-enforcement",
    file: ".github/instructions/cursor-rules/modules/module-post-action-verification-capability.instructions.md",
    oldText: "status: active\ntier: P0\ncapabilityDomain: post-action-verification-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    newText: "status: active\ntier: P0\ncapabilityDomain: post-action-verification-capability\nenforcementMode: manual-first\nevidenceMode: law+inspector+negative-proof",
    skipBuild: true,
  },
  {
    name: "warning-only-p0",
    file: ".github/instructions/cursor-rules/modules/module-post-action-verification-capability.instructions.md",
    oldText: "status: active\ntier: P0\ncapabilityDomain: post-action-verification-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    newText: "status: active\ntier: P1\ncapabilityDomain: post-action-verification-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    skipBuild: true,
  },
  {
    name: "ability-group-creates-clock",
    file: "src/capabilities/post-action-verification/ability-group.ts",
    oldText: "export function createPostActionVerificationAbilityGroup(input: CreatePostActionVerificationAbilityGroupInput): PostActionVerificationAbilityGroup {",
    newText: "export function createPostActionVerificationAbilityGroup(input: CreatePostActionVerificationAbilityGroupInput): PostActionVerificationAbilityGroup {\n  createSystemPostActionVerificationClock();",
  },
  {
    name: "contract-exposes-child-interface",
    file: "src/capabilities/post-action-verification/contract.ts",
    oldText: "interface PostActionVerificationAbilityGroup {",
    newText: "interface PostActionVerificationChildCapability { execute(input: PostActionVerificationAbilityInput): Promise<PostActionVerificationAbilityResult>; }\n\ninterface PostActionVerificationAbilityGroup {",
  },
  {
    name: "schema-allows-non-success-output",
    file: "src/capabilities/post-action-verification/schema.ts",
    oldText: "failed/review_required result must not expose output",
    newText: "failed/review_required result may retain output",
  },
  {
    name: "input-schema-missing-capability-call-id",
    file: "src/capabilities/post-action-verification/schema.ts",
    oldText: "  capabilityCallId: requiredString,",
    newText: "  capabilityCallId: nullableString,",
  },
  {
    name: "input-schema-missing-activation-snapshot-ref",
    file: "src/capabilities/post-action-verification/schema.ts",
    oldText: "  activationSnapshotRef: requiredString,",
    newText: "  activationSnapshotRef: nullableString,",
  },
  {
    name: "input-schema-missing-nerve-bus-envelope-id",
    file: "src/capabilities/post-action-verification/schema.ts",
    oldText: "  nerveBusEnvelopeId: requiredString,",
    newText: "  nerveBusEnvelopeId: nullableString,",
  },
  {
    name: "local-runtime-builder-drops-run-id",
    file: "src/lib/local-runtime/workbench-post-action-dispatch-input.ts",
    oldText: "    runId: envelope.runId,",
    newText: "    runId: null,",
  },
  {
    name: "local-runtime-builder-strips-www-host",
    file: "src/lib/local-runtime/workbench-post-action-dispatch-input.ts",
    oldText: "    return \"www.tiktok.com\";",
    newText: "    return \"tiktok.com\";",
  },
  {
    name: "observation-only-boundary-regression",
    file: "src/capabilities/post-action-verification/runtime/post-action-output-boundary-gate.ts",
    oldText: "  if (input.assessment.supportingEvidenceRefs.length > 0 || input.assessment.supportingObservationRefs.length >= 2 || hasObservationOnlySupport) {",
    newText: "  if (input.assessment.supportingEvidenceRefs.length > 0 || input.assessment.supportingObservationRefs.length >= 2) {",
  },
  {
    name: "external-imports-runtime-path",
    file: "src/lib/local-runtime/workbench-post-action-runtime.ts",
    oldText: "import { createPostActionVerificationAbilityGroup } from \"../../capabilities/post-action-verification/index.js\";",
    newText: "import { createPostActionVerificationAbilityGroup } from \"../../capabilities/post-action-verification/index.js\";\nimport type { PostActionVerificationRuntimeContext } from \"../../capabilities/post-action-verification/runtime/post-action-verification-runtime-context.js\";",
  },
  {
    name: "page-state-claims-verification-decision",
    file: "src/capabilities/page-state/shared/page-state-result.ts",
    oldText: "export type { PageStateClassificationOutcome } from \"./page-state-types.js\";",
    newText: "export type { PageStateClassificationOutcome } from \"./page-state-types.js\";\nconst verificationDecision = \"verified\";",
  },
  {
    name: "mouse-click-returns-verified",
    file: "src/capabilities/mouse-click/runtime/mouse-click-result-builder.ts",
    oldText: "    runtimeProof,",
    newText: "    runtimeProof,\n    verificationDecision: \"verified\",",
  },
  {
    name: "orchestration-fabricates-verification-decision",
    file: "src/capabilities/orchestration/ability-group.ts",
    oldText: "import { createOrchestrationRuntimeContext } from \"./runtime/orchestration-runtime-context.js\";",
    newText: "import { createOrchestrationRuntimeContext } from \"./runtime/orchestration-runtime-context.js\";\nconst verificationDecision = \"verified\";",
  },
  {
    name: "proof-builder-fabricates-run-id",
    file: "src/capabilities/post-action-verification/runtime/verification-proof-builder.ts",
    oldText: "    runId: request?.runId ?? input.inputRef,",
    newText: "    runId: `post-action-verification-run:${input.proofFingerprint}`,",
  },
  {
    name: "proof-builder-fabricates-mission-id",
    file: "src/capabilities/post-action-verification/runtime/verification-proof-builder.ts",
    oldText: "    missionId: request?.missionId ?? null,",
    newText: "    missionId: request?.sessionId ?? null,",
  },
  {
    name: "child-imports-screenshot-implementation",
    file: "src/capabilities/post-action-verification/children/verify-page-opened/implementation.ts",
    oldText: "import { VerifyPageOpenedOutputSchema } from \"./schema.js\";",
    newText: "import { VerifyPageOpenedOutputSchema } from \"./schema.js\";\nimport { createScreenshotAbilityGroup } from \"../../../screenshot/index.js\";",
  },
  {
    name: "child-returns-boolean",
    file: "src/capabilities/post-action-verification/children/verify-page-opened/implementation.ts",
    oldText: "      return VerifyPageOpenedOutputSchema.parse(await executeVerifyPageOpened({\n        observations: context.evidenceReadPort.listObservations(input),\n        expectedUrlHost: input.expectedOutcome.expectedUrlHost,\n        expectedUrlPrefix: input.expectedOutcome.expectedUrlPrefix,\n      }));",
    newText: "      return true as never;",
  },
  {
    name: "child-builds-final-result",
    file: "src/capabilities/post-action-verification/children/verify-page-opened/implementation.ts",
    oldText: "      return VerifyPageOpenedOutputSchema.parse(await executeVerifyPageOpened({",
    newText: "      buildPostActionVerificationResult({} as never);\n      return VerifyPageOpenedOutputSchema.parse(await executeVerifyPageOpened({",
  },
  {
    name: "negative-proof-invocation-removed",
    file: "scripts/audit/domains/post-action-verification-capability/inspector.ts",
    oldText: "    : await runNegativeProofHarness();",
    newText: "    : { findings: [], phase: { name: \"negative-proof-harness\", classification: \"PASS\" as const, passed: true, summary: \"mutated skip\" } };",
  },
];

const LAW_IDS = {
  CHILDREN: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-007-V2",
  PACKAGE: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-008-V2",
} as const;

export const MUTATION_LAW_COVERAGE: Record<string, {
  coveredLawIds: string[];
  coverageReasonByLawId: Record<string, string>;
}> = {
  "child-imports-screenshot-implementation": {
    coveredLawIds: [LAW_IDS.CHILDREN],
    coverageReasonByLawId: {
      [LAW_IDS.CHILDREN]: "The mutation makes a PAV child import a foreign screenshot implementation, proving child capabilities must remain narrow verification behaviors on the unified runtime path.",
    },
  },
  "child-returns-boolean": {
    coveredLawIds: [LAW_IDS.CHILDREN],
    coverageReasonByLawId: {
      [LAW_IDS.CHILDREN]: "The mutation makes a PAV child return a raw boolean, proving child capabilities must return governed child assessment payloads rather than bypassing the unified executor path.",
    },
  },
  "child-builds-final-result": {
    coveredLawIds: [LAW_IDS.CHILDREN],
    coverageReasonByLawId: {
      [LAW_IDS.CHILDREN]: "The mutation lets a PAV child call the final result builder, proving final result and runtime proof construction must stay in the unified runtime path.",
    },
  },
  "negative-proof-invocation-removed": {
    coveredLawIds: [LAW_IDS.PACKAGE],
    coverageReasonByLawId: {
      [LAW_IDS.PACKAGE]: "The mutation removes nested guarded negative-proof invocation from the inspector, proving PAV enforcement must close through the owner-local inspector, runner, and negative-proof harness.",
    },
  },
  "warning-only-p0": {
    coveredLawIds: [LAW_IDS.PACKAGE],
    coverageReasonByLawId: {
      [LAW_IDS.PACKAGE]: "The mutation downgrades the active PAV law from P0 to warning-only, proving package enforcement must remain machine-blocking and release-gating.",
    },
  },
};