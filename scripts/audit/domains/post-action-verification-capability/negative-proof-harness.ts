import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { LAW_IDS } from "./config.js";

export type NegativeProofMutation = {
  name: string;
  file: string;
  oldText: string;
  newText: string;
  skipBuild?: boolean;
};

type NegativeProofMutationGroup = {
  name: string;
  mutations: NegativeProofMutation[];
  skipBuild: boolean;
};

export const POST_ACTION_NEGATIVE_PROOF_MUTATIONS: NegativeProofMutation[] = [
  {
    name: "manual-first-enforcement",
    file: ".github/instructions/cursor-rules/modules/module-post-action-verification-capability.instructions.md",
    oldText: "status: active\ntier: P0\ncapabilityDomain: post-action-verification-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    newText: "status: active\ntier: P0\ncapabilityDomain: post-action-verification-capability\nenforcementMode: manual-first\nevidenceMode: law+inspector+negative-proof",
    skipBuild: false,
  },
  {
    name: "warning-only-p0",
    file: ".github/instructions/cursor-rules/modules/module-post-action-verification-capability.instructions.md",
    oldText: "status: active\ntier: P0\ncapabilityDomain: post-action-verification-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    newText: "status: active\ntier: P1\ncapabilityDomain: post-action-verification-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    skipBuild: false,
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
    name: "negative-proof-invocation-removed",
    file: "scripts/audit/domains/post-action-verification-capability/inspector.ts",
    oldText: "    : await runNegativeProofHarness();",
    newText: "    : { findings: [], phase: { name: \"negative-proof-harness\", classification: \"PASS\" as const, passed: true, summary: \"mutated skip\" } };",
  },
];

export function getNegativeProofMutationPaths(): string[] {
  return POST_ACTION_NEGATIVE_PROOF_MUTATIONS.map((mutation) => pathFromRepoRoot(mutation.file));
}

function applyMutationOnce(source: string, mutation: NegativeProofMutation): string {
  const matchIndex = source.indexOf(mutation.oldText);
  if (matchIndex === -1) {
    throw new Error(`Mutation ${mutation.name} could not find target text in ${mutation.file}`);
  }

  return `${source.slice(0, matchIndex)}${mutation.newText}${source.slice(matchIndex + mutation.oldText.length)}`;
}

function runInspectorProcess(skipBuild = true): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    "node",
    ["--import", "tsx", "scripts/audit/domains/post-action-verification-capability/run-inspector.ts", ...(skipBuild ? ["--skip-build"] : [])],
    {
      cwd: pathFromRepoRoot("."),
      encoding: "utf8",
      env: { ...process.env, GRASSEYE_SKIP_POST_ACTION_NEGATIVE_PROOF: "1" },
    },
  );

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function createMutationGroups(): NegativeProofMutationGroup[] {
  const groups = new Map<string, NegativeProofMutationGroup>();
  for (const mutation of POST_ACTION_NEGATIVE_PROOF_MUTATIONS) {
    const skipBuild = mutation.skipBuild ?? true;
    const key = skipBuild ? "skip-build" : mutation.name;
    const existing = groups.get(key);
    if (existing) {
      existing.mutations.push(mutation);
      continue;
    }
    groups.set(key, { name: key, mutations: [mutation], skipBuild });
  }
  return [...groups.values()];
}

async function applyMutationGroup(group: NegativeProofMutationGroup): Promise<() => Promise<void>> {
  const originalByFile = new Map<string, string>();
  try {
    for (const mutation of group.mutations) {
      const absolutePath = pathFromRepoRoot(mutation.file);
      if (!originalByFile.has(absolutePath)) {
        originalByFile.set(absolutePath, await readFile(absolutePath, "utf8"));
      }
      const currentContent = await readFile(absolutePath, "utf8");
      await writeFile(absolutePath, applyMutationOnce(currentContent, mutation), "utf8");
    }
    return async () => {
      for (const [absolutePath, originalContent] of originalByFile) {
        await writeFile(absolutePath, originalContent, "utf8");
      }
    };
  } catch (error) {
    for (const [absolutePath, originalContent] of originalByFile) {
      await writeFile(absolutePath, originalContent, "utf8");
    }
    throw error;
  }
}

async function mutateGroupAndVerify(group: NegativeProofMutationGroup): Promise<string> {
  const rollback = await applyMutationGroup(group);
  try {
    const failRun = runInspectorProcess(group.skipBuild);
    if (failRun.status === 0) {
      throw new Error(`Mutation group ${group.name} did not fail inspector as expected.\n${failRun.stdout}\n${failRun.stderr}`);
    }
  } finally {
    await rollback();
  }

  return `${group.name}: ${group.mutations.map((mutation) => mutation.name).join(", ")} fail-ok`;
}

function createPassResult(summary: string): { findings: Finding[]; phase: InspectorPhase } {
  return {
    findings: [],
    phase: createPhase("negative-proof-harness", "PASS", true, summary),
  };
}

function createFatalResult(message: string, summary: string): { findings: Finding[]; phase: InspectorPhase } {
  return {
    findings: [
      createFinding({ lawId: LAW_IDS.PACKAGE, file: "scripts/audit/domains/post-action-verification-capability/inspector.ts", line: 1, severity: "fatal", message }),
    ],
    phase: createPhase("negative-proof-harness", "FAKE ENFORCEMENT", false, summary),
  };
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const reports: string[] = [];

  try {
    for (const group of createMutationGroups()) {
      reports.push(await mutateGroupAndVerify(group));
    }

    const rollbackRun = runInspectorProcess(false);
    if (rollbackRun.status !== 0) {
      throw new Error(`Post Action Verification mutations did not restore inspector PASS after rollback.\n${rollbackRun.stdout}\n${rollbackRun.stderr}`);
    }

    return createPassResult("Post Action Verification negative-proof harness rejects baseline drift, local-runtime builder drift, observation-only boundary regressions, runtime-path leakage, external verificationDecision fabrication, and owner-boundary regression mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Post Action Verification negative-proof harness failed.",
      "Post Action Verification negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}
