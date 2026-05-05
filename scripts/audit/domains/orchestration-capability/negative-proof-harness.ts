import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
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
    name: "step transition runtime event removal mutation",
    file: "src/capabilities/orchestration/runtime/orchestration-executor-loop-iteration.ts",
    search: 'eventType: "STEP_TRANSITION_EVALUATED",',
    replace: 'eventType: "STEP_TRANSITION_SKIPPED",',
  },
  {
    name: "success proof ref closure removal mutation",
    file: "src/capabilities/orchestration/runtime/orchestration-executor-loop-iteration.ts",
    search: "const persistedState = toMissionControlState(state, details.endedAt, {\n    lastRuntimeProofRef: runtimeProofId,\n    runtimeProofRefs: [...state.runtimeProofRefs, runtimeProofId],\n  });",
    replace: "const persistedState = toMissionControlState(state, details.endedAt, {\n    lastRuntimeProofRef: null,\n    runtimeProofRefs: [...state.runtimeProofRefs, runtimeProofId],\n  });",
  },
  {
    name: "post-action action log writer removal mutation",
    file: "src/capabilities/orchestration/runtime/orchestration-step-trace-recorder.ts",
    search: "writeStructuredActionLog({",
    replace: "writeStructuredRuntimeEvent({",
  },
];

async function runInspector(): Promise<{ passed: boolean; violationCount: number }> {
  const previous = process.env[SKIP_NEGATIVE_PROOF_ENV];
  process.env[SKIP_NEGATIVE_PROOF_ENV] = "1";

  try {
    await buildAuditArtifacts();
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
  for (const mutation of MUTATIONS) {
    await mutateAndVerify(mutation);
  }
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    const baseline = await runInspector();
    if (!baseline.passed) {
      return createFatalResult(
        "Orchestration inspector baseline must pass before negative-proof mutation checks.",
        "Orchestration negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    await runMutations();

    return createPassResult("Orchestration negative-proof harness rejects execute-type escape, floating resume map lookup, step-trace event removal, success-proof closure loss, action-log writer loss, unknown-child proof drop, and post-action verification bypass mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Orchestration negative-proof harness failed.",
      "Orchestration negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}
