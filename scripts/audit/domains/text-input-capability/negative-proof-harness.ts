import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";

import { LAW_IDS } from "./config.js";

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
    name: "activation snapshot optional mutation",
    file: "src/capabilities/text-input/schema.ts",
    search: "  activationSnapshotRef: z.string().min(1),",
    replace: "  activationSnapshotRef: nullableString,",
  },
  {
    name: "nerve bus envelope optional mutation",
    file: "src/capabilities/text-input/schema.ts",
    search: "  nerveBusEnvelopeId: z.string().min(1),",
    replace: "  nerveBusEnvelopeId: nullableString,",
  },
  {
    name: "capability call optional mutation",
    file: "src/capabilities/text-input/schema.ts",
    search: "  capabilityCallId: z.string().min(1),",
    replace: "  capabilityCallId: nullableString,",
  },
  {
    name: "approved text ref gate bypass mutation",
    file: "src/capabilities/text-input/runtime/approved-text-gate.ts",
    search: "  if (!input.request.approvedTextRef || input.request.approvedTextRef.length === 0) {",
    replace: "  if (false && (!input.request.approvedTextRef || input.request.approvedTextRef.length === 0)) {",
  },
  {
    name: "approved text hash parity bypass mutation",
    file: "src/capabilities/text-input/runtime/approved-text-gate.ts",
    search: "  if (input.request.inputTextHash !== input.request.approvedTextHash || (input.request.inputText ?? \"\") !== (input.request.approvedText ?? \"\")) {",
    replace: "  if (false && (input.request.inputTextHash !== input.request.approvedTextHash || (input.request.inputText ?? \"\") !== (input.request.approvedText ?? \"\"))) {",
  },
  {
    name: "press key arbitrary schema mutation",
    file: "src/capabilities/text-input/schema.ts",
    search: "  key: TextInputKeySchema,",
    replace: "  key: z.string().min(1),",
  },
  {
    name: "commit approved ref bypass mutation",
    file: "src/capabilities/text-input/runtime/commit-policy-gate.ts",
    search: "  if (!input.request.policy.commitPolicy.requireApprovedCommitRef || (input.request.approvedCommitRef?.length ?? 0) > 0) {",
    replace: "  if (true) {",
  },
  {
    name: "raw text debug leak mutation",
    file: "src/capabilities/text-input/runtime/text-input-debug-events.ts",
    search: "    emittedEventTypes,",
    replace: "    rawInputText: payloadText,\n    emittedEventTypes,",
  },
  {
    name: "fabricated run id mutation",
    file: "src/capabilities/text-input/runtime/text-input-proof-builder.ts",
    search: "    runId: input.runId,",
    replace: "    runId: buildStableTextInputRef(\"text-input-run\", [input.attemptRef]),",
  },
  {
    name: "abort signal removal mutation",
    file: "src/capabilities/text-input/runtime/primitive-text-input-runner.ts",
    search: "        abortSignal: abortController.signal,",
    replace: "        abortSignal: undefined as never,",
  },
  {
    name: "retry loop mutation",
    file: "src/capabilities/text-input/runtime/primitive-text-input-runner.ts",
    search: "  const abortController = new AbortController();",
    replace: "  for (let retry = 0; retry < 2; retry += 1) {}\n  const abortController = new AbortController();",
  },
  {
    name: "pav handoff removal mutation",
    file: "src/capabilities/text-input/runtime/text-input-result-builder.ts",
    search: "  const postActionVerificationHandoffRef = buildPostActionVerificationHandoffRef(input);",
    replace: "  const postActionVerificationHandoffRef = null;",
  },
  {
    name: "business result field mutation",
    file: "src/capabilities/text-input/runtime/text-input-result-builder-support.ts",
    search: "    runtimeProof,\n  };",
    replace: "    runtimeProof,\n    sendSuccess: outputBoundary.status === \"success\",\n  };",
  },
  {
    name: "child direct primitive mutation",
    file: "src/capabilities/text-input/children/type-text/implementation.ts",
    search: "      const parsedInput = TypeTextAbilityInputSchema.parse(input);\n      return executeTextInput({ request: parsedInput, context });",
    replace: "      const parsedInput = TypeTextAbilityInputSchema.parse(input);\n      await context.executionPort.execute({} as never);\n      return executeTextInput({ request: parsedInput, context });",
  },
  {
    name: "child forbidden browser import mutation",
    file: "src/capabilities/text-input/children/type-text/implementation.ts",
    search: "import { TypeTextAbilityInputSchema } from \"./schema.js\";",
    replace: "import type { BrowserControllerTextInputRuntimePorts } from \"../../../../lib/browser/text-input-primitive-port.js\";\nimport { TypeTextAbilityInputSchema } from \"./schema.js\";",
  },
  {
    name: "forbidden child registry mutation",
    file: "src/capabilities/text-input/registry.ts",
    search: "  createCommitInputCapability(),\n] as const;",
    replace: "  createCommitInputCapability(),\n  { childCapabilityId: \"send-message\" } as never,\n] as const;",
  },
  {
    name: "negative proof invocation removed mutation",
    file: "scripts/audit/domains/text-input-capability/inspector.ts",
    search: "      : await runNegativeProofHarness();",
    replace: "      : { findings: [], phase: { name: \"negative-proof-harness\", classification: \"PASS\" as const, passed: true, summary: \"mutated skip\" } };",
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
        lawId: LAW_IDS.PACKAGE,
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

    return createPassResult("Text Input negative-proof harness rejects chain-field weakening, approved-text bypass, raw debug leakage, fabricated runId, timeout escape, business-result leakage, child primitive bypass, forbidden browser imports, forbidden child expansion, and negative-proof removal mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Text Input negative-proof harness failed.",
      "Text Input negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}