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

const INSPECTOR_ENTRY = "scripts/audit/domains/mouse-click-capability/inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_MOUSE_CLICK_NEGATIVE_PROOF";

const MUTATIONS: Mutation[] = [
  {
    name: "export-star escape mutation",
    file: "src/capabilities/mouse-click/index.ts",
    search: 'export { listMouseClickChildren } from "./registry.js";',
    replace: 'export { listMouseClickChildren } from "./registry.js";\nexport * from "./schema.js";',
  },
  {
    name: "policy gate bypass mutation",
    file: "src/capabilities/mouse-click/runtime/mouse-click-executor.ts",
    search: "const policyGate = validateClickPolicy({ request: input.request, nowIsoTimestamp: input.context.clock.now().isoTimestamp });",
    replace: "const policyDecision = validateClickPolicy({ request: input.request, nowIsoTimestamp: input.context.clock.now().isoTimestamp });",
  },
  {
    name: "proof drop mutation",
    file: "src/capabilities/mouse-click/runtime/mouse-click-result-builder.ts",
    search: "const runtimeProof = buildMouseClickRuntimeProof({",
    replace: "const proofRemoved = buildMouseClickRuntimeProof({",
  },
  {
    name: "timeout race removal mutation",
    file: "src/capabilities/mouse-click/runtime/primitive-click-runner.ts",
    search: "const primitiveResult = await Promise.race([",
    replace: "const primitiveResult = await Promise.all([",
  },
  {
    name: "computed click escape mutation",
    file: "src/capabilities/mouse-click/runtime/primitive-click-runner.ts",
    search: "input.context.primitivePort.click({",
    replace: 'input.context.primitivePort["click"]({',
  },
  {
    name: "workbench composition drift mutation",
    file: "src/lib/local-runtime/workbench.ts",
    search: 'import { createSystemMouseClickClock } from "../../capabilities/mouse-click/runtime/mouse-click-clock.js";',
    replace: 'import { createSystemMouseClickClock } from "../../capabilities/mouse-click/runtime/system-clock.js";',
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
        lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V1",
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
        "Mouse Click inspector baseline must pass before negative-proof mutation checks.",
        "Mouse Click negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    await runMutations();

    return createPassResult("Mouse Click negative-proof harness rejects gate bypass, proof drop, timeout escape, computed click, and composition drift mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Mouse Click negative-proof harness failed.",
      "Mouse Click negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}
