import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";

type Mutation = {
  name: string;
  file: string;
  search: string;
  replace: string;
};

const INSPECTOR_ENTRY = "scripts/audit/domains/orchestration-capability/inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_ORCHESTRATION_NEGATIVE_PROOF";

const MUTATIONS: Mutation[] = [
  {
    name: "runtime proof runId schema removal mutation",
    file: "src/capabilities/orchestration/schema.ts",
    search: "const RuntimeProofSchema = z.object({\n  proofId: z.string().min(1),\n  runId: z.string().min(1),\n",
    replace: "const RuntimeProofSchema = z.object({\n  proofId: z.string().min(1),\n",
  },
  {
    name: "runtime proof builder runId removal mutation",
    file: "src/capabilities/orchestration/runtime/orchestration-proof-builder.ts",
    search: "input.runId, missionId: input.missionId",
    replace: "missionId: input.missionId",
  },
  {
    name: "human command start runId drop mutation",
    file: "src/lib/local-runtime/workbench-human-command.ts",
    search: "    missionId: envelope.missionId,\n    runId: envelope.runId,\n    humanGoal:",
    replace: "    missionId: envelope.missionId,\n    runId: null,\n    humanGoal:",
  },
  {
    name: "orchestration start received log removal mutation",
    file: "src/lib/local-runtime/workbench-human-command-debug-events.ts",
    search: "ORCHESTRATION_START_RECEIVED",
    replace: "ORCHESTRATION_START_MISSING",
  },
  {
    name: "activation snapshot early boundary removal mutation",
    file: "src/lib/local-runtime/workbench-human-command.ts",
    search: "  await recordMissionActivationSnapshotFrozen(runtime, {\n    envelope,\n    selectedMapId: parsedSelectedMapId,\n    taskTemplateId,\n    activationSnapshotRef,\n  });\n",
    replace: "",
  },
  {
    name: "command accepted early boundary removal mutation",
    file: "src/lib/local-runtime/workbench-human-command.ts",
    search: "  await recordCommandAccepted(runtime, {\n    envelope,\n    selectedMapId: parsedSelectedMapId,\n    taskTemplateId,\n    activationSnapshotRef,\n  });\n",
    replace: "",
  },
  {
    name: "mission command schema preflight dry-run removal mutation",
    file: "src/lib/local-runtime/workbench-mission-command-preflight.ts",
    search: "}) => MissionCommandSchema.safeParse({",
    replace: "}) => MissionCommandSchema.parse({",
  },
  {
    name: "governed execute type escape mutation",
    file: "src/capabilities/orchestration/contract.ts",
    search: "execute(input: OrchestrationExecuteInput): Promise<OrchestrationExecuteResult>;",
    replace: "execute(input: OrchestrationExecuteInput): Promise<unknown>;",
  },
  {
    name: "floating active map resume mutation",
    file: "src/capabilities/orchestration/runtime/orchestration-executor-resume.ts",
    search: "const mapRecord = await resolveFrozenActivationMapRecord(input.context.mapStore, state);",
    replace: "const mapRecord = await input.context.mapStore.getActiveMapRecord(state.mapId);",
  },
  {
    name: "unknown child proof drop mutation",
    file: "src/capabilities/orchestration/runtime/orchestration-child-runner.ts",
    search: "dataQualityFlags: [\"unknown_child_capability\"],",
    replace: "runtimeProof: null,\n      dataQualityFlags: [\"unknown_child_capability\"],",
  },
  {
    name: "post-action verification gate bypass mutation",
    file: "src/capabilities/orchestration/runtime/step-dispatcher.ts",
    search: "const postActionVerificationReason = ensurePostActionVerificationDispatchGate(input.map, input.step.stepId);",
    replace: "const postActionVerificationReason = null;",
  },
  {
    name: "ai step timeout policy bypass mutation",
    file: "src/capabilities/orchestration/runtime/step-dispatch-request-builders.ts",
    search: "timeoutMs: resolveStepTimeoutMs(input.step),",
    replace: "timeoutMs: 30_000,",
  },
  {
    name: "ai dispatch abort signal drop mutation",
    file: "src/capabilities/orchestration/runtime/step-dispatcher.ts",
    search: "    async (signal) => input.context.nerveBus.sendRequestToAi({\n      ...buildAiDispatchRequest({ ...input, ...prepared.value }),\n      signal,\n    }),\n",
    replace: "    async (_signal) => input.context.nerveBus.sendRequestToAi(buildAiDispatchRequest({ ...input, ...prepared.value })),\n",
  },
  {
    name: "step transition runtime event removal mutation",
    file: "src/capabilities/orchestration/runtime/orchestration-loop-iteration-events.ts",
    search: 'eventType: "STEP_TRANSITION_EVALUATED",',
    replace: 'eventType: "STEP_TRANSITION_SKIPPED",',
  },
  {
    name: "capability call started event removal mutation",
    file: "src/capabilities/orchestration/runtime/orchestration-loop-iteration-events.ts",
    search: '    eventType: "CAPABILITY_CALL_STARTED",',
    replace: '    eventType: "CAPABILITY_CALL_SKIPPED",',
  },
  {
    name: "round budget per-step mutation",
    file: "src/capabilities/orchestration/runtime/orchestration-executor-loop-iteration-support.ts",
    search: "  const nextRoundIndex = shouldAdvanceMissionRound({\n    currentStepId: details.currentStepId,\n    nextStepId,\n    nextStatus,\n    initialStepId: input.map.initialStepId,\n    currentRoundIndex: input.state.currentRoundIndex,\n  });\n",
    replace: "  const nextRoundIndex = input.state.currentRoundIndex + 1;\n",
  },
  {
    name: "video visit id dropped from dispatch chain mutation",
    file: "src/capabilities/orchestration/runtime/step-dispatch-shared.ts",
    search: "      videoVisitId: `${state.missionId}:video-visit:${state.currentRoundIndex}`,\n",
    replace: "      videoVisitId: null,\n",
  },
  {
    name: "verified next-video round boundary removal mutation",
    file: "src/capabilities/orchestration/runtime/orchestration-executor-loop-iteration-support.ts",
    search: "  const verifiedNextVideoAndReturnedToCapture = input.currentStepId === \"verify-video-changed-after-scroll\"\n    && input.nextStepId === \"capture-video-viewport\";\n\n  return returnedToInitialStep || verifiedNextVideoAndReturnedToCapture\n",
    replace: "  const verifiedNextVideoAndReturnedToCapture = false;\n\n  return returnedToInitialStep || verifiedNextVideoAndReturnedToCapture\n",
  },
  {
    name: "post-action verification started event removal mutation",
    file: "src/capabilities/orchestration/runtime/orchestration-loop-iteration-events.ts",
    search: '    eventType: "POST_ACTION_VERIFICATION_STARTED",',
    replace: '    eventType: "POST_ACTION_VERIFICATION_SKIPPED",',
  },
  {
    name: "success proof ref closure removal mutation",
    file: "src/capabilities/orchestration/runtime/orchestration-executor-loop-iteration-support.ts",
    search: "const persistedState = toMissionControlState(state, details.endedAt, {\n    lastRuntimeProofRef: runtimeProofId,\n    runtimeProofRefs: [...state.runtimeProofRefs, runtimeProofId],\n  });",
    replace: "const persistedState = toMissionControlState(state, details.endedAt, {\n    lastRuntimeProofRef: null,\n    runtimeProofRefs: [...state.runtimeProofRefs, runtimeProofId],\n  });",
  },
  {
    name: "post-action action log writer removal mutation",
    file: "src/capabilities/orchestration/runtime/orchestration-step-trace-recorder.ts",
    search: "input.context.forensics.writeStructuredActionLog(",
    replace: "input.context.forensics.writeStructuredRuntimeEvent(",
  },
];

async function runInspector(): Promise<{ passed: boolean; violationCount: number }> {
  const previous = process.env[SKIP_NEGATIVE_PROOF_ENV];
  process.env[SKIP_NEGATIVE_PROOF_ENV] = "1";

  try {
    // artifacts already built by the outer run-inspector.ts entry — skip rebuild
    const artifacts = await loadGeneratedArtifacts();
    const context = await createInspectorContext(artifacts);
    const inspector = await loadInspector(INSPECTOR_ENTRY);
    const result = await inspector(context);
    return { passed: result.passed, violationCount: result.violationCount };
  } finally {
    if (previous === undefined) {
      delete process.env[SKIP_NEGATIVE_PROOF_ENV];
    } else {
      process.env[SKIP_NEGATIVE_PROOF_ENV] = previous;
    }
  }
}

async function mutateAndVerify(mutation: Mutation): Promise<void> {
  const filePath = pathFromRepoRoot(mutation.file);
  const state = await readAuditFileState(filePath);
  await applyAuditMutation(filePath, state.original, mutation);

  try {
    const result = await runInspector();
    if (result.passed || result.violationCount === 0) {
      throw new Error(`Inspector did not fail for ${mutation.name}`);
    }
  } finally {
    await restoreAuditFileState(filePath, state);
  }

  const restored = await runInspector();
  if (!restored.passed) {
    throw new Error(`Rollback verification failed for ${mutation.name}`);
  }
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
      createFinding({
        lawId: "GRASSEYE-ORCHESTRATION-CAPABILITY-004-V1",
        file: INSPECTOR_ENTRY,
        line: 1,
        severity: "fatal",
        message,
      }),
    ],
    phase: createPhase("negative-proof-harness", "FAKE ENFORCEMENT", false, summary),
  };
}

async function runMutations(): Promise<void> {
  for (const [index, mutation] of MUTATIONS.entries()) {
    process.stdout.write(`[orchestration:negative-proof] [${index + 1}/${MUTATIONS.length}] ${mutation.name}\n`);
    await mutateAndVerify(mutation);
  }
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    process.stdout.write(`[orchestration:negative-proof] Verifying baseline (${MUTATIONS.length} mutations queued)...\n`);
    const baseline = await runInspector();
    if (!baseline.passed) {
      return createFatalResult(
        "Orchestration inspector baseline must pass before negative-proof mutation checks.",
        "Orchestration negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    await runMutations();

    return createPassResult("Orchestration negative-proof harness rejects early start-boundary loss, round-budget step drift, capability-call-start event loss, PAV-start event loss, execute-type escape, floating resume map lookup, step-trace event removal, success-proof closure loss, action-log writer loss, unknown-child proof drop, post-action verification bypass, and AI step timeout policy bypass mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Orchestration negative-proof harness failed.",
      "Orchestration negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}
