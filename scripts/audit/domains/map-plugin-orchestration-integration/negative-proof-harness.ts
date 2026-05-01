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

const INSPECTOR_ENTRY = "scripts/audit/domains/map-plugin-orchestration-integration/inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_MAP_PLUGIN_ORCH_INTEGRATION_NEGATIVE_PROOF";

const MUTATIONS: Mutation[] = [
  {
    name: "ordinary-feed regression mutation",
    file: "src/features/commander-console/task-template-registry.ts",
    search: "listOrdinaryTaskTemplates()",
    replace: "listApprovedTaskTemplates()",
  },
  {
    name: "platform fallback mutation",
    file: "src/capabilities/orchestration/runtime/map-selection-gate.ts",
    search: '| "task_template_id"\n',
    replace: '| "platform_policy"\n',
  },
  {
    name: "binding-resolution bypass mutation",
    file: "src/lib/local-app-shell/task-start-flow.ts",
    search: "  const binding = resolveMissionStartBinding({\n    taskTemplateId: draft.taskTemplateId,\n    requestedPlatformId: draft.requestedPlatformId,\n    selectedMapId: draft.selectedMapId,\n  });",
    replace: "  const binding = {\n    ok: true,\n    taskTemplateId: draft.taskTemplateId ?? \"mutated-template\",\n    activationId: \"mutated-activation\",\n    requestedPlatformId: draft.requestedPlatformId ?? \"tiktok-web\",\n    selectedMapId: draft.selectedMapId ?? \"mutated-map\",\n  } as const;\n  // mutated: bypassed governed launch-binding resolution",
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
    const mutated = await runInspector();
    if (mutated.passed || mutated.violationCount === 0) {
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
        lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-006-V1",
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
        "Integration inspector baseline must pass before negative-proof mutations can run.",
        "Integration negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    await runMutations();

    return createPassResult("Integration negative-proof harness rejects ordinary-feed regression, platform fallback, and binding-resolution bypass mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Integration negative-proof harness failed.",
      "Integration negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}