export type ReplaceMutation = {
  kind: "replace";
  name: string;
  file: string;
  oldText: string;
  newText: string;
  expectedNeedle: string;
  phase: TargetNegativeProofPhase;
  skipBuild?: boolean;
};

export type CreateFileMutation = {
  kind: "create-file";
  name: string;
  file: string;
  content: string;
  expectedNeedle: string;
  phase: TargetNegativeProofPhase;
  skipBuild?: boolean;
};

export type NegativeProofMutation = ReplaceMutation | CreateFileMutation;
export type NegativeProofMutationGroup = {
  name: string;
  mutations: NegativeProofMutation[];
  phase: TargetNegativeProofPhase;
  skipBuild: boolean;
};
export type TargetNegativeProofPhase =
  | "required"
  | "forbidden"
  | "boundary"
  | "truth-ownership"
  | "anti-escape"
  | "enforcement-coverage";

export const PAGE_STATE_NEGATIVE_PROOF_MUTATIONS: NegativeProofMutation[] = [
  {
    kind: "replace",
    name: "manual-first-enforcement-reintroduced",
    file: ".github/instructions/cursor-rules/modules/module-page-state-capability.instructions.md",
    oldText: "status: active  \ntier: P0  \ncapabilityDomain: page-state-capability  \nenforcementMode: machine-blocking  \nevidenceMode: law+inspector+negative-proof",
    newText: "status: active  \ntier: P0  \ncapabilityDomain: page-state-capability  \nenforcementMode: manual-first  \nevidenceMode: law+inspector+negative-proof",
    expectedNeedle: "machine-blocking",
    phase: "enforcement-coverage",
    skipBuild: false,
  },
  {
    kind: "replace",
    name: "turn-p0-into-warning-only",
    file: ".github/instructions/cursor-rules/modules/module-page-state-capability.instructions.md",
    oldText: "status: active  \ntier: P0  \ncapabilityDomain: page-state-capability  \nenforcementMode: machine-blocking  \nevidenceMode: law+inspector+negative-proof",
    newText: "status: active  \ntier: P1  \ncapabilityDomain: page-state-capability  \nenforcementMode: machine-blocking  \nevidenceMode: law+inspector+negative-proof",
    expectedNeedle: "must remain P0",
    phase: "enforcement-coverage",
    skipBuild: false,
  },
  {
    kind: "create-file",
    name: "open-feed-ready-classifier-outside-page-state",
    file: "src/capabilities/open/runtime/page-state-feed-ready-classifier-probe.ts",
    content: "export const feedReadyClassifier = () => \"feed_ready\";\n",
    expectedNeedle: "truth classifiers or truth helpers",
    phase: "truth-ownership",
  },
  {
    kind: "create-file",
    name: "platform-login-wall-truth-helper-outside-page-state",
    file: "src/lib/browser/page-state-login-wall-truth-helper.ts",
    content: "export const loginWallTruthHelper = () => \"login_required\";\n",
    expectedNeedle: "truth classifiers or truth helpers",
    phase: "truth-ownership",
  },
  {
    kind: "replace",
    name: "accept-action-completion-as-page-state-proof",
    file: "src/capabilities/page-state/schema.ts",
    oldText: "    kind: z.literal(\"post_action_verification\"),",
    newText: "    kind: z.literal(\"action_completion\"),",
    expectedNeedle: "action completion as governed page-state proof",
    phase: "truth-ownership",
  },
  {
    kind: "replace",
    name: "remove-capabilityCallId-from-input",
    file: "src/capabilities/page-state/schema.ts",
    oldText: "  capabilityCallId: z.string().min(1),",
    newText: "  capabilityCallIdRemoved: z.string().min(1),",
    expectedNeedle: "must include capabilityCallId",
    phase: "required",
  },
  {
    kind: "replace",
    name: "remove-activationSnapshotRef-from-input",
    file: "src/capabilities/page-state/schema.ts",
    oldText: "  activationSnapshotRef: z.string().min(1),",
    newText: "  activationSnapshotRefRemoved: z.string().min(1),",
    expectedNeedle: "must include activationSnapshotRef",
    phase: "required",
  },
  {
    kind: "replace",
    name: "remove-nerveBusEnvelopeId-from-input",
    file: "src/capabilities/page-state/schema.ts",
    oldText: "  nerveBusEnvelopeId: z.string().min(1),",
    newText: "  nerveBusEnvelopeIdRemoved: z.string().min(1),",
    expectedNeedle: "must include nerveBusEnvelopeId",
    phase: "required",
  },
  {
    kind: "replace",
    name: "remove-snapshot-sourceProofRef",
    file: "src/capabilities/page-state/schema.ts",
    oldText: "  sourceChildCapabilityId: z.string().min(1),\n  sourceProofRef: z.string().min(1),\n});\n\nconst PageStateFreshnessPolicySchema = z.object({",
    newText: "  sourceChildCapabilityId: z.string().min(1),\n});\n\nconst PageStateFreshnessPolicySchema = z.object({",
    expectedNeedle: "PageStateSnapshotSchema must include sourceProofRef",
    phase: "required",
  },
  {
    kind: "replace",
    name: "observation-without-sourceProofRef",
    file: "src/capabilities/page-state/schema.ts",
    oldText: "    sourceChildCapabilityId: z.string().min(1),\n    sourceProofRef: z.string().min(1),\n    payload: RuntimeSignalObservationPayloadSchema,",
    newText: "    sourceChildCapabilityId: z.string().min(1),\n    payload: RuntimeSignalObservationPayloadSchema,",
    expectedNeedle: "sourceProofRef on snapshot and every governed observation shape",
    phase: "required",
  },
  {
    kind: "replace",
    name: "success-without-evidenceRefs",
    file: "src/capabilities/page-state/page-state-schema-validation.ts",
    oldText: "    addIssue(ctx, [\"evidenceRefs\"], \"success result must retain evidenceRefs\");",
    newText: "    // evidenceRefs requirement removed by mutation",
    expectedNeedle: "evidence backing",
    phase: "anti-escape",
  },
  {
    kind: "replace",
    name: "result-adds-verificationDecision",
    file: "src/capabilities/page-state/runtime/page-state-result-builder.ts",
    oldText: "    runtimeProof: input.runtimeProof,",
    newText: "    verificationDecision: \"verified\",\n    runtimeProof: input.runtimeProof,",
    expectedNeedle: "post-action verification truth fields",
    phase: "forbidden",
  },
  {
    kind: "replace",
    name: "failed-result-retains-output",
    file: "src/capabilities/page-state/page-state-schema-validation.ts",
    oldText: "    addIssue(ctx, [\"output\"], \"failed or review_required result must null output\");",
    newText: "    addIssue(ctx, [\"output\"], \"failed or review_required result may retain output\");",
    expectedNeedle: "must forbid non-null output or outputRef",
    phase: "anti-escape",
  },
  {
    kind: "replace",
    name: "proof-runId-from-fingerprint",
    file: "src/capabilities/page-state/runtime/page-state-proof-builder.ts",
    oldText: "    runId: input.request.runId,",
    newText: "    runId: input.pageStateFingerprint,",
    expectedNeedle: "must propagate input.request.runId",
    phase: "required",
  },
  {
    kind: "replace",
    name: "proof-missing-activationSnapshotRef",
    file: "src/capabilities/page-state/runtime/page-state-proof-builder.ts",
    oldText: "    activationSnapshotRef: input.request.activationSnapshotRef,",
    newText: "    activationSnapshotRef: null,",
    expectedNeedle: "must propagate input.request.activationSnapshotRef",
    phase: "required",
  },
  {
    kind: "replace",
    name: "child-imports-screenshot-implementation",
    file: "src/capabilities/page-state/children/detect-login-state/implementation.ts",
    oldText: "import type { DetectLoginStateChildCapability } from \"./contract.js\";",
    newText: "import type { DetectLoginStateChildCapability } from \"./contract.js\";\nimport { createScreenshotAbilityGroup } from \"../../../screenshot/index.js\";",
    expectedNeedle: "must not import forbidden capability implementations",
    phase: "forbidden",
  },
  {
    kind: "replace",
    name: "child-returns-boolean",
    file: "src/capabilities/page-state/children/detect-login-state/implementation.ts",
    oldText: "      return DetectLoginStateChildOutputSchema.parse(buildLoginStateOutput(request));",
    newText: "      return true as never;",
    expectedNeedle: "ChildOutputSchema.parse boundary",
    phase: "required",
  },
  {
    kind: "replace",
    name: "child-hardcodes-tiktok-feed-path",
    file: "src/capabilities/page-state/children/detect-feed-ready/implementation.ts",
    oldText: "  if (resolvedProfile && hasFeedEvidence && urlMatchesFeedPath(request.snapshot.currentUrl, resolvedProfile)) {",
    newText: "  if (resolvedProfile && hasFeedEvidence && request.snapshot.currentUrl.includes(\"/foryou\")) {",
    expectedNeedle: "hardcode TikTok-only paths",
    phase: "anti-escape",
  },
  {
    kind: "create-file",
    name: "external-import-of-child-implementation",
    file: "src/app/page-state-private-import-probe.ts",
    content: 'import "../capabilities/page-state/children/detect-login-state/implementation.js";\nexport const probe = true;\n',
    expectedNeedle: "must not import page-state runtime or child internals",
    phase: "boundary",
  },
  {
    kind: "create-file",
    name: "add-verify-page-state-capabilities",
    file: "src/capabilities/page-state/verify-page-state-capabilities.ts",
    content: "export const verifyPageStateCapabilities = true;\n",
    expectedNeedle: "must not add verify/capability-check side paths",
    phase: "forbidden",
  },
  {
    kind: "replace",
    name: "remove-negative-proof-invocation",
    file: "scripts/audit/domains/page-state-capability/inspector.ts",
    oldText: "    : await runNegativeProofHarness();",
    newText: "      : { findings: [], phase: { name: \"negative-proof-harness\", classification: \"PASS\" as const, passed: true, summary: \"negative-proof removed by mutation\" } };",
    expectedNeedle: "must invoke and report the negative-proof harness",
    phase: "anti-escape",
  },
  {
    kind: "replace",
    name: "remove-negative-proof-phase-grouping",
    file: "scripts/audit/domains/page-state-capability/negative-proof-harness.ts",
    oldText: "    for (const group of createMutationGroups()) {\n      reports.push(await mutateGroupAndVerifyFailure(group));\n    }",
    newText: "    for (const group of PAGE_STATE_NEGATIVE_PROOF_MUTATIONS.map((mutation) => ({ name: mutation.name, mutations: [mutation], phase: mutation.phase, skipBuild: mutation.skipBuild ?? true }))) {\n      reports.push(await mutateGroupAndVerifyFailure(group));\n    }",
    expectedNeedle: "must iterate grouped mutations instead of replaying the full inspector per mutation",
    phase: "anti-escape",
  },
];
