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

const INSPECTOR_ENTRY = "scripts/audit/domains/map-plugin-package/inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_MAP_PLUGIN_NEGATIVE_PROOF";

const MUTATIONS: Mutation[] = [
  {
    name: "builtin executable handler mutation",
    file: "src/map-plugins/builtins/tiktok-product-discovery.map-package.json",
    search: '  "signature": null\n',
    replace: '  "handler": "evil.js",\n  "signature": null\n',
  },
  {
    name: "orchestration platform fallback mutation",
    file: "src/capabilities/orchestration/runtime/map-selection-gate.ts",
    search: '| "task_template_id"\n',
    replace: '| "platform_policy"\n',
  },
  {
    name: "ai draft activation mutation",
    file: "src/map-plugins/builtins/ai-draft-map-placeholder.map-package.json",
    search: '    "approvalStatus": "draft",\n',
    replace: '    "approvalStatus": "approved",\n',
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
        lawId: "GRASSEYE-MAP-PLUGIN-007-V1",
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
        "Map package inspector baseline must pass before negative-proof mutations can run.",
        "Map package negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    await runMutations();

    return createPassResult("Map package negative-proof harness rejects executable payload, hardcoded fallback, and AI draft activation mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Map package negative-proof harness failed.",
      "Map package negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}
