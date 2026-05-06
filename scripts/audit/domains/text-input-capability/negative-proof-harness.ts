import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import {
  createInspectorRunner,
  mutateAndVerify,
  writeMutationProofBundle,
  writeOwnerBindingBundle,
  type AuditMutation,
  type InspectorRunner,
  type MutationCoverage,
  type MutationProofRecord,
} from "../_shared/negative-proof-runtime.js";

import { LAW_IDS } from "./config.js";

type Mutation = AuditMutation;

const INSPECTOR_ENTRY = "scripts/audit/domains/text-input-capability/inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_TEXT_INPUT_NEGATIVE_PROOF";
const OWNER_BINDING_MUTATION_NAMES = [
  "manual-first-enforcement mutation",
  "warning-only-p0 mutation",
  "negative proof invocation removed mutation",
] as const;
const PACKAGE_PROOF_MUTATION_NAME = "negative proof invocation removed mutation";
const PACKAGE_PROOF_SCENARIO_ID = "text-input-negative-proof-invocation-removed";

const MUTATIONS: Mutation[] = [
  {
    name: "manual-first-enforcement mutation",
    file: ".github/instructions/cursor-rules/modules/module-text-input-capability.instructions.md",
    search: "status: active\ntier: P0\ncapabilityDomain: text-input-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    replace: "status: active\ntier: P0\ncapabilityDomain: text-input-capability\nenforcementMode: manual-first\nevidenceMode: law+inspector+negative-proof",
  },
  {
    name: "warning-only-p0 mutation",
    file: ".github/instructions/cursor-rules/modules/module-text-input-capability.instructions.md",
    search: "status: active\ntier: P0\ncapabilityDomain: text-input-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    replace: "status: active\ntier: P1\ncapabilityDomain: text-input-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
  },
  {
    name: "orchestration-direct-text-port mutation",
    file: "src/capabilities/orchestration/ability-group.ts",
    search: "import { listOrchestrationChildren } from \"./registry.js\";",
    replace: "import type { TextInputExecutionPort } from \"../text-input/ports/text-input-execution-port.js\";\nimport { listOrchestrationChildren } from \"./registry.js\";",
  },
  {
    name: "browser-controller-public-contract mutation",
    file: "src/capabilities/text-input/contract.ts",
    search: "import type { z } from \"zod\";",
    replace: "import type { z } from \"zod\";\nimport type { BrowserController } from \"../../lib/browser/browser-controller.js\";",
  },
  {
    name: "selector-public-input mutation",
    file: "src/capabilities/text-input/schema.ts",
    search: "  inputTargetRef: z.string().min(1),",
    replace: "  inputTargetRef: z.string().min(1),\n  targetSelector: z.string().min(1).optional(),",
  },
  {
    name: "platform-direct-text-write mutation",
    file: "src/lib/local-runtime/workbench-text-input-runtime.ts",
    search: "  textInputAbilityGroup: createWorkbenchTextInputAbilityGroup({",
    replace: "  platformDirectTextWrite: runtime.browserController.textInput({ targetLabel: \"mutated\", action: \"type-text\", text: \"mutated\", key: null, fallbackUsed: false, abortSignal: new AbortController().signal }),\n  textInputAbilityGroup: createWorkbenchTextInputAbilityGroup({",
  },
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

const PACKAGE_PROOF_COVERAGE: Record<string, MutationCoverage> = {
  [PACKAGE_PROOF_MUTATION_NAME]: {
    coveredLawIds: [LAW_IDS.PACKAGE],
    coverageReasonByLawId: {
      [LAW_IDS.PACKAGE]: "The mutation disconnects the Text Input inspector from its negative-proof harness, proving enforcement must close through the owner-local inspector plus negative-proof chain.",
    },
  },
};

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

async function runMutations(runInspector: InspectorRunner): Promise<MutationProofRecord[]> {
  const records: MutationProofRecord[] = [];
  for (const mutation of MUTATIONS) {
    const record = await mutateAndVerify(runInspector, mutation);
    records.push(record);
    await writeMutationProofBundle({
      owner: "text-input",
      ownerTitle: "Text Input",
      record,
      coverageByMutationName: PACKAGE_PROOF_COVERAGE,
      scenarioIdByMutationName: {
        [PACKAGE_PROOF_MUTATION_NAME]: PACKAGE_PROOF_SCENARIO_ID,
      },
    });
  }

  await writeOwnerBindingBundle({
    owner: "text-input",
    title: "Text Input",
    ownerBindingMutationNames: OWNER_BINDING_MUTATION_NAMES,
    records,
    rollbackOutput: records.find((record) => record.mutation.name === PACKAGE_PROOF_MUTATION_NAME)?.passOutput,
  });
  return records;
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    const runInspector = await createInspectorRunner({
      inspectorEntry: INSPECTOR_ENTRY,
      skipNegativeProofEnv: SKIP_NEGATIVE_PROOF_ENV,
    });
    const baseline = await runInspector();
    if (!baseline.passed) {
      return createFatalResult(
        "Text Input inspector baseline must pass before negative-proof mutation checks.",
        "Text Input negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    await runMutations(runInspector);

    return createPassResult("Text Input negative-proof harness rejects baseline drift, orchestration direct write imports, BrowserController public-contract leaks, selector-based public input, platform direct text-write bypass, chain-field weakening, approved-text bypass, raw debug leakage, fabricated runId, timeout escape, business-result leakage, child primitive bypass, forbidden browser imports, forbidden child expansion, and negative-proof removal mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Text Input negative-proof harness failed.",
      "Text Input negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}