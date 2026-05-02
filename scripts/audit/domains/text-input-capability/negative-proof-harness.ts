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

type InspectorRunResult = { passed: boolean; violationCount: number };
type InspectorRunner = () => Promise<InspectorRunResult>;

const INSPECTOR_ENTRY = "scripts/audit/domains/text-input-capability/inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_TEXT_INPUT_NEGATIVE_PROOF";

const MUTATIONS: Mutation[] = [
  {
    name: "export-star escape mutation",
    file: "src/capabilities/text-input/index.ts",
    search: 'export { listTextInputChildren } from "./registry.js";',
    replace: 'export { listTextInputChildren } from "./registry.js";\nexport * from "./schema.js";',
  },
  {
    name: "target gate bypass mutation",
    file: "src/capabilities/text-input/runtime/text-input-execution-gates.ts",
    search: "const targetGate = validateInputTargetProof({ request: input.request });",
    replace: 'const targetGate = { ok: true, policyDecision: "allow", statusMessage: "bypassed", dataQualityFlags: [] };',
  },
  {
    name: "focus gate bypass mutation",
    file: "src/capabilities/text-input/runtime/text-input-execution-gates.ts",
    search: "const focusGate = validateFocusProof({",
    replace: "const focusGate = { ok: true, policyDecision: \"allow\", statusMessage: \"bypassed\", dataQualityFlags: [] };\n    // mutated from validateFocusProof({",
  },
  {
    name: "source proof gate bypass mutation",
    file: "src/capabilities/text-input/runtime/text-input-execution-gates.ts",
    search: "const sourceGate = validateTextSourceProof({ request: input.request });",
    replace: 'const sourceGate = { ok: true, policyDecision: "allow", statusMessage: "bypassed", dataQualityFlags: [] };',
  },
  {
    name: "sensitive gate bypass mutation",
    file: "src/capabilities/text-input/runtime/text-input-execution-gates.ts",
    search: "const sensitiveGate = validateSensitiveText({ request: input.request });",
    replace: 'const sensitiveGate = { ok: true, sensitiveTextDecision: "allowed", redactionDecision: "masked", redactedPreview: null, dataQualityFlags: [] };',
  },
  {
    name: "proof drop mutation",
    file: "src/capabilities/text-input/runtime/text-input-result-builder.ts",
    search: "const runtimeProof = buildRuntimeProofForResult(input, {",
    replace: "const proofRemoved = buildRuntimeProofForResult(input, {",
  },
  {
    name: "output boundary bypass mutation",
    file: "src/capabilities/text-input/runtime/text-input-result-builder.ts",
    search: "const outputBoundary = validateTextInputOutputBoundary({",
    replace: "const outputBoundary = { status: input.status, failureReason: input.failureReason as never, reviewRequiredReason: input.reviewRequiredReason, statusMessage: input.statusMessage, outputBoundaryDecision: \"valid\" as const, dataQualityFlags: input.dataQualityFlags, output: candidateOutput };\n  // mutated from validateTextInputOutputBoundary({",
  },
  {
    name: "debug bundle drop mutation",
    file: "src/capabilities/text-input/runtime/text-input-result-builder.ts",
    search: "const debugBundle = buildTextInputDebugBundle({",
    replace: 'const debugBundle = { diagnosticPayloadRef: "fake-diagnostic", debugLogRef: "fake-debug", structuredRuntimeEventRef: "fake-runtime-event" };\n  // mutated from buildTextInputDebugBundle({',
  },
  {
    name: "runner abort removal mutation",
    file: "src/capabilities/text-input/runtime/primitive-text-input-runner.ts",
    search: "const abortController = new AbortController();",
    replace: "const abortController = { signal: input.context.executionPort as never, abort() {} } as never;",
  },
  {
    name: "input gate child fallback mutation",
    file: "src/capabilities/text-input/runtime/text-input-input-gate.ts",
    search: "    ? value as TextInputChildCapabilityId\n    : null;",
    replace: "    ? value as TextInputChildCapabilityId\n    : \"type-text\";",
  },
  {
    name: "commit gate bypass mutation",
    file: "src/capabilities/text-input/runtime/text-input-execution-gates.ts",
    search: "const commitGate = validateCommitPolicy({ request: input.request });",
    replace: 'const commitGate = { ok: true, keyPolicyDecision: "allowed", commitPolicyRef: null, dataQualityFlags: [] };',
  },
  {
    name: "clipboard restore swallow mutation",
    file: "src/capabilities/text-input/runtime/text-input-executor-finalize.ts",
    search: "  input.executionResult.state.clipboardDecision = input.state.clipboardDecision;\n  input.executionResult.state.restoredClipboardHash = input.state.restoredClipboardHash;\n  input.executionResult.state.dataQualityFlags = mergeFlags(input.executionResult.state.dataQualityFlags, input.state.dataQualityFlags);",
    replace: "  input.executionResult.state.clipboardDecision = input.executionResult.state.clipboardDecision;\n  input.executionResult.state.restoredClipboardHash = input.executionResult.state.restoredClipboardHash;\n  input.executionResult.state.dataQualityFlags = input.executionResult.state.dataQualityFlags;",
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

async function mutateAndVerify(runInspector: InspectorRunner, mutation: Mutation): Promise<void> {
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
        lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-007-V1",
        file: INSPECTOR_ENTRY,
        line: 1,
        severity: "fatal",
        message,
      }),
    ],
    phase: createPhase("negative-proof-harness", "FAKE ENFORCEMENT", false, summary),
  };
}

async function runMutations(runInspector: InspectorRunner): Promise<void> {
  for (const mutation of MUTATIONS) {
    await mutateAndVerify(runInspector, mutation);
  }
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    const runInspector = await createInspectorRunner();
    const baseline = await runInspector();
    if (!baseline.passed) {
      return createFatalResult(
        "Text Input inspector baseline must pass before negative-proof mutation checks.",
        "Text Input negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    await runMutations(runInspector);

    return createPassResult("Text Input negative-proof harness rejects export laundering, source/target/focus gate bypass, proof drop, output-boundary escape, runner timeout escape, clipboard proof swallowing, and fallback mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Text Input negative-proof harness failed.",
      "Text Input negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}