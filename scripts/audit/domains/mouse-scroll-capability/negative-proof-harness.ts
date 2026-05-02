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
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_MOUSE_SCROLL_NEGATIVE_PROOF";

type InspectorRunResult = { passed: boolean; violationCount: number };
type InspectorRunner = () => Promise<InspectorRunResult>;

const MUTATIONS: Mutation[] = [
  {
    name: "export-star escape mutation",
    file: "src/capabilities/mouse-scroll/index.ts",
    search: 'export { listMouseScrollChildren } from "./registry.js";',
    replace: 'export { listMouseScrollChildren } from "./registry.js";\nexport * from "./schema.js";',
  },
  {
    name: "policy gate bypass mutation",
    file: "src/capabilities/mouse-scroll/runtime/mouse-scroll-execution-validator.ts",
    search: "  const policyGate = validatePolicyGate(input, seed);",
    replace: "  const policyDecision = validatePolicyGate(input, seed);",
  },
  {
    name: "proof drop mutation",
    file: "src/capabilities/mouse-scroll/runtime/mouse-scroll-result-builder.ts",
    search: "  const runtimeProof = buildMouseScrollRuntimeProofForResult(input, outputRef, postActionVerificationHandoffRef);",
    replace: "  const proofRemoved = buildMouseScrollRuntimeProofForResult(input, outputRef, postActionVerificationHandoffRef);",
  },
  {
    name: "timeout abort removal mutation",
    file: "src/capabilities/mouse-scroll/runtime/primitive-scroll-port-call.ts",
    search: "    input.abortController.abort(new Error(`Mouse Scroll primitive timed out after ${input.input.timeoutMs}ms.`));",
    replace: "    void input.input.timeoutMs;",
  },
  {
    name: "computed scroll escape mutation",
    file: "src/capabilities/mouse-scroll/runtime/primitive-scroll-port-call.ts",
    search: "  return input.input.context.primitivePort.scroll({",
    replace: '  return input.input.context.primitivePort["scroll"]({',
  },
  {
    name: "workbench composition drift mutation",
    file: "src/lib/local-runtime/workbench-mouse-scroll-ability-group.ts",
    search: ") => createMouseScrollAbilityGroupWithPrimitivePort(...input);",
    replace: ") => input[0] as never;",
  },
];

async function createInspectorRunner(): Promise<InspectorRunner> {
  await buildAuditArtifacts();
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const inspector = await loadInspector(INSPECTOR_ENTRY);

  return async () => {
    const previous = process.env[SKIP_NEGATIVE_PROOF_ENV];
    process.env[SKIP_NEGATIVE_PROOF_ENV] = "1";

    try {
      const result = await inspector(context);
      return { passed: result.passed, violationCount: result.violationCount };
    } finally {
      if (previous === undefined) {
        delete process.env[SKIP_NEGATIVE_PROOF_ENV];
      } else {
        process.env[SKIP_NEGATIVE_PROOF_ENV] = previous;
      }
    }
  };
}

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

async function mutateAndVerify(runInspectorOnce: InspectorRunner, mutation: Mutation): Promise<void> {
  const filePath = pathFromRepoRoot(mutation.file);
  const state = await readAuditFileState(filePath);
  await applyAuditMutation(filePath, state.original, mutation);

  try {
    const result = await runInspectorOnce();
    if (result.passed || result.violationCount === 0) {
      throw new Error(`Inspector did not fail for ${mutation.name}`);
    }
  } finally {
    await restoreAuditFileState(filePath, state);
  }

  const restored = await runInspectorOnce();
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

async function runMutations(runInspectorOnce: InspectorRunner): Promise<void> {
  for (const mutation of MUTATIONS) {
    await mutateAndVerify(runInspectorOnce, mutation);
  }
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    const runInspectorOnce = await createInspectorRunner();
    const baseline = await runInspectorOnce();
    if (!baseline.passed) {
      return createFatalResult(
        "Mouse Scroll inspector baseline must pass before negative-proof mutation checks.",
        "Mouse Scroll negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    await runMutations(runInspectorOnce);

    return createPassResult("Mouse Scroll negative-proof harness rejects gate bypass, proof drop, timeout abort escape, computed scroll, and composition drift mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Mouse Scroll negative-proof harness failed.",
      "Mouse Scroll negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}