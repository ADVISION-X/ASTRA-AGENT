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

const INSPECTOR_ENTRY = "scripts/audit/domains/mouse-scroll-capability/inspector.ts";

const MUTATIONS: Mutation[] = [
  {
    name: "export-star escape mutation",
    file: "src/capabilities/mouse-scroll/index.ts",
    search: 'export { listMouseScrollChildren } from "./registry.js";',
    replace: 'export { listMouseScrollChildren } from "./registry.js";\nexport * from "./schema.js";',
  },
  {
    name: "policy gate bypass mutation",
    file: "src/capabilities/mouse-scroll/runtime/mouse-scroll-executor.ts",
    search: "const policyGate = validateScrollPolicy({ request: input.request, expectedCoordinateSpace: input.expectedCoordinateSpace, nowIsoTimestamp: policySnapshot.isoTimestamp });",
    replace: "const policyDecision = validateScrollPolicy({ request: input.request, expectedCoordinateSpace: input.expectedCoordinateSpace, nowIsoTimestamp: policySnapshot.isoTimestamp });",
  },
  {
    name: "proof drop mutation",
    file: "src/capabilities/mouse-scroll/runtime/mouse-scroll-result-builder.ts",
    search: "const runtimeProof = buildMouseScrollRuntimeProof({",
    replace: "const proofRemoved = buildMouseScrollRuntimeProof({",
  },
  {
    name: "timeout race removal mutation",
    file: "src/capabilities/mouse-scroll/runtime/primitive-scroll-runner.ts",
    search: "const primitiveResult = await Promise.race([",
    replace: "const primitiveResult = await Promise.all([",
  },
  {
    name: "computed scroll escape mutation",
    file: "src/capabilities/mouse-scroll/runtime/primitive-scroll-runner.ts",
    search: "input.context.primitivePort.scroll({",
    replace: 'input.context.primitivePort["scroll"]({',
  },
  {
    name: "workbench composition drift mutation",
    file: "src/lib/local-runtime/workbench.ts",
    search: 'import { createMouseScrollExecutionContext } from "../../capabilities/mouse-scroll/runtime/mouse-scroll-execution-context.js";',
    replace: 'import { createSystemMouseScrollClock } from "../../capabilities/mouse-scroll/runtime/mouse-scroll-clock.js";',
  },
];

async function runInspector(): Promise<{ passed: boolean; violationCount: number }> {
  await buildAuditArtifacts();
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const inspector = await loadInspector(INSPECTOR_ENTRY);
  const result = await inspector(context);
  return { passed: result.passed, violationCount: result.violationCount };
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
        lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V1",
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
        "Mouse Scroll inspector baseline must pass before negative-proof mutation checks.",
        "Mouse Scroll negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    await runMutations();

    return createPassResult("Mouse Scroll negative-proof harness rejects gate bypass, proof drop, timeout escape, computed scroll, and composition drift mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Mouse Scroll negative-proof harness failed.",
      "Mouse Scroll negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}