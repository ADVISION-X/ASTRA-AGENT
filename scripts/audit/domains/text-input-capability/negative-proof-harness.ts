import { readFile, writeFile } from "node:fs/promises";

import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";

type Mutation = {
  name: string;
  file: string;
  search: string;
  replace: string;
};

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
    file: "src/capabilities/text-input/runtime/text-input-executor.ts",
    search: "const targetGate = validateInputTargetProof({ request: input.request });",
    replace: 'const targetGate = { ok: true, policyDecision: "allow", statusMessage: "bypassed", dataQualityFlags: [] };',
  },
  {
    name: "focus gate bypass mutation",
    file: "src/capabilities/text-input/runtime/text-input-executor.ts",
    search: "const focusGate = validateFocusProof({",
    replace: "const focusGate = { ok: true, policyDecision: \"allow\", statusMessage: \"bypassed\", dataQualityFlags: [] };\n    // mutated from validateFocusProof({",
  },
  {
    name: "source proof gate bypass mutation",
    file: "src/capabilities/text-input/runtime/text-input-executor.ts",
    search: "const sourceGate = validateTextSourceProof({ request: input.request });",
    replace: 'const sourceGate = { ok: true, policyDecision: "allow", statusMessage: "bypassed", dataQualityFlags: [] };',
  },
  {
    name: "sensitive gate bypass mutation",
    file: "src/capabilities/text-input/runtime/text-input-executor.ts",
    search: "const sensitiveGate = validateSensitiveText({ request: input.request });",
    replace: 'const sensitiveGate = { ok: true, sensitiveTextDecision: "allowed", redactionDecision: "masked", redactedPreview: null, dataQualityFlags: [] };',
  },
  {
    name: "proof drop mutation",
    file: "src/capabilities/text-input/runtime/text-input-result-builder.ts",
    search: "const runtimeProof = buildTextInputRuntimeProof({",
    replace: "const proofRemoved = buildTextInputRuntimeProof({",
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
    file: "src/capabilities/text-input/runtime/text-input-executor.ts",
    search: "const commitGate = validateCommitPolicy({ request: input.request });",
    replace: 'const commitGate = { ok: true, commitPolicyRef: null, dataQualityFlags: [] };',
  },
  {
    name: "clipboard restore swallow mutation",
    file: "src/capabilities/text-input/runtime/text-input-executor.ts",
    search: "    finalResultInput.clipboardDecision = state.clipboardDecision;\n    finalResultInput.restoredClipboardHash = state.restoredClipboardHash;\n    finalResultInput.dataQualityFlags = mergeFlags(finalResultInput.dataQualityFlags, state.dataQualityFlags);",
    replace: "    finalResultInput.clipboardDecision = finalResultInput.clipboardDecision;\n    finalResultInput.restoredClipboardHash = finalResultInput.restoredClipboardHash;\n    finalResultInput.dataQualityFlags = finalResultInput.dataQualityFlags;",
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
  const original = await readFile(filePath, "utf8");

  if (!original.includes(mutation.search)) {
    throw new Error(`Mutation seed not found for ${mutation.name} in ${mutation.file}`);
  }

  await writeFile(filePath, original.replace(mutation.search, mutation.replace), "utf8");

  try {
    const result = await runInspector();
    if (result.passed || result.violationCount === 0) {
      throw new Error(`Inspector did not fail for ${mutation.name}`);
    }
  } finally {
    await writeFile(filePath, original, "utf8");
  }

  const restored = await runInspector();
  if (!restored.passed) {
    throw new Error(`Rollback verification failed for ${mutation.name}`);
  }
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    const baseline = await runInspector();
    if (!baseline.passed) {
      return {
        findings: [
          createFinding({
            lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-007-V1",
            file: INSPECTOR_ENTRY,
            line: 1,
            severity: "fatal",
            message: "Text Input inspector baseline must pass before negative-proof mutation checks.",
          }),
        ],
        phase: createPhase(
          "negative-proof-harness",
          "FAKE ENFORCEMENT",
          false,
          "Text Input negative-proof harness cannot start because the baseline inspector is not passing.",
        ),
      };
    }

    for (const mutation of MUTATIONS) {
      await mutateAndVerify(mutation);
    }

    return {
      findings: [],
      phase: createPhase(
        "negative-proof-harness",
        "PASS",
        true,
        "Text Input negative-proof harness rejects export laundering, source/target/focus gate bypass, proof drop, output-boundary escape, runner timeout escape, clipboard proof swallowing, and fallback mutations.",
      ),
    };
  } catch (error) {
    return {
      findings: [
        createFinding({
          lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-007-V1",
          file: INSPECTOR_ENTRY,
          line: 1,
          severity: "fatal",
          message: error instanceof Error ? error.message : "Text Input negative-proof harness failed.",
        }),
      ],
      phase: createPhase(
        "negative-proof-harness",
        "FAKE ENFORCEMENT",
        false,
        "Text Input negative-proof harness failed to prove mutation rejection and rollback recovery.",
      ),
    };
  }
}