export type TargetNegativeProofPhase =
  | "law-baseline"
  | "required"
  | "forbidden"
  | "boundary"
  | "write-ownership"
  | "anti-escape";

export type NegativeProofMutation = {
  name: string;
  file: string;
  oldText: string;
  newText: string;
  expectedNeedle: string;
  phase: TargetNegativeProofPhase;
  skipBuild?: boolean;
};

export type NegativeProofMutationGroup = {
  name: string;
  mutations: NegativeProofMutation[];
  phase: TargetNegativeProofPhase;
  skipBuild: boolean;
};

export const TEXT_INPUT_NEGATIVE_PROOF_MUTATIONS: NegativeProofMutation[] = [
  {
    name: "manual-first-enforcement mutation",
    file: ".github/instructions/cursor-rules/modules/module-text-input-capability.instructions.md",
    oldText: "status: active\ntier: P0\ncapabilityDomain: text-input-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    newText: "status: active\ntier: P0\ncapabilityDomain: text-input-capability\nenforcementMode: manual-first\nevidenceMode: law+inspector+negative-proof",
    expectedNeedle: "Text Input active laws must remain machine-blocking.",
    phase: "law-baseline",
    skipBuild: false,
  },
  {
    name: "warning-only-p0 mutation",
    file: ".github/instructions/cursor-rules/modules/module-text-input-capability.instructions.md",
    oldText: "status: active\ntier: P0\ncapabilityDomain: text-input-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    newText: "status: active\ntier: P1\ncapabilityDomain: text-input-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    expectedNeedle: "Text Input active laws must remain P0.",
    phase: "law-baseline",
    skipBuild: false,
  },
  {
    name: "orchestration-direct-text-port mutation",
    file: "src/capabilities/orchestration/ability-group.ts",
    oldText: "import { listOrchestrationChildren } from \"./registry.js\";",
    newText: "import type { TextInputExecutionPort } from \"../text-input/ports/text-input-execution-port.js\";\nimport { listOrchestrationChildren } from \"./registry.js\";",
    expectedNeedle: "External owners must not import Text Input execution or clipboard adapters directly.",
    phase: "write-ownership",
  },
  {
    name: "browser-controller-public-contract mutation",
    file: "src/capabilities/text-input/contract.ts",
    oldText: "import type { z } from \"zod\";",
    newText: "import type { z } from \"zod\";\nimport type { BrowserController } from \"../../lib/browser/browser-controller.js\";",
    expectedNeedle: "Text Input public contract must not expose BrowserController or browser text-input primitive types.",
    phase: "write-ownership",
  },
  {
    name: "selector-public-input mutation",
    file: "src/capabilities/text-input/schema.ts",
    oldText: "  inputTargetRef: z.string().min(1),",
    newText: "  inputTargetRef: z.string().min(1),\n  targetSelector: z.string().min(1).optional(),",
    expectedNeedle: "Text Input public contract must not accept DOM selector, CSS selector, or locator fields.",
    phase: "write-ownership",
  },
  {
    name: "platform-direct-text-write mutation",
    file: "src/lib/local-runtime/workbench-text-input-runtime.ts",
    oldText: "  textInputAbilityGroup: createWorkbenchTextInputAbilityGroup({",
    newText: "  platformDirectTextWrite: runtime.browserController.textInput({ targetLabel: \"mutated\", action: \"type-text\", text: \"mutated\", key: null, fallbackUsed: false, abortSignal: new AbortController().signal }),\n  textInputAbilityGroup: createWorkbenchTextInputAbilityGroup({",
    expectedNeedle: "Platform adapters and runtime helpers must not call browserController.textInput outside the Text Input primitive adapter.",
    phase: "write-ownership",
  },
  {
    name: "activation snapshot optional mutation",
    file: "src/capabilities/text-input/schema.ts",
    oldText: "  activationSnapshotRef: z.string().min(1),",
    newText: "  activationSnapshotRef: nullableString,",
    expectedNeedle: "TextInputBaseSchema must keep activationSnapshotRef machine-required.",
    phase: "required",
  },
  {
    name: "nerve bus envelope optional mutation",
    file: "src/capabilities/text-input/schema.ts",
    oldText: "  nerveBusEnvelopeId: z.string().min(1),",
    newText: "  nerveBusEnvelopeId: nullableString,",
    expectedNeedle: "TextInputBaseSchema must keep nerveBusEnvelopeId machine-required.",
    phase: "required",
  },
  {
    name: "capability call optional mutation",
    file: "src/capabilities/text-input/schema.ts",
    oldText: "  capabilityCallId: z.string().min(1),",
    newText: "  capabilityCallId: nullableString,",
    expectedNeedle: "TextInputBaseSchema must keep capabilityCallId machine-required.",
    phase: "required",
  },
  {
    name: "approved text ref gate bypass mutation",
    file: "src/capabilities/text-input/runtime/approved-text-gate.ts",
    oldText: "  if (!input.request.approvedTextRef || input.request.approvedTextRef.length === 0) {",
    newText: "  if (false && (!input.request.approvedTextRef || input.request.approvedTextRef.length === 0)) {",
    expectedNeedle: "Approved-text gate must enforce approved refs and hash parity.",
    phase: "required",
  },
  {
    name: "approved text hash parity bypass mutation",
    file: "src/capabilities/text-input/runtime/approved-text-gate.ts",
    oldText: "  if (input.request.inputTextHash !== input.request.approvedTextHash || (input.request.inputText ?? \"\") !== (input.request.approvedText ?? \"\")) {",
    newText: "  if (false && (input.request.inputTextHash !== input.request.approvedTextHash || (input.request.inputText ?? \"\") !== (input.request.approvedText ?? \"\"))) {",
    expectedNeedle: "Approved-text gate must enforce approved refs and hash parity.",
    phase: "required",
  },
  {
    name: "press key arbitrary schema mutation",
    file: "src/capabilities/text-input/schema.ts",
    oldText: "  key: TextInputKeySchema,",
    newText: "  key: z.string().min(1),",
    expectedNeedle: "PressKeyAbilityInputSchema must keep key machine-required.",
    phase: "required",
  },
  {
    name: "commit approved ref bypass mutation",
    file: "src/capabilities/text-input/runtime/commit-policy-gate.ts",
    oldText: "  if (!input.request.policy.commitPolicy.requireApprovedCommitRef || (input.request.approvedCommitRef?.length ?? 0) > 0) {",
    newText: "  if (true) {",
    expectedNeedle: "Commit policy gate must enforce approvedCommitRef and governed approval policy.",
    phase: "required",
  },
  {
    name: "raw text debug leak mutation",
    file: "src/capabilities/text-input/runtime/text-input-debug-events.ts",
    oldText: "    emittedEventTypes,",
    newText: "    rawInputText: payloadText,\n    emittedEventTypes,",
    expectedNeedle: "Text Input debug material must not expose raw sensitive text or clipboard plaintext.",
    phase: "forbidden",
  },
  {
    name: "fabricated run id mutation",
    file: "src/capabilities/text-input/runtime/text-input-proof-builder.ts",
    oldText: "    runId: input.runId,",
    newText: "    runId: buildStableTextInputRef(\"text-input-run\", [input.attemptRef]),",
    expectedNeedle: "Text Input proof builder must not fabricate runId from attemptRef.",
    phase: "required",
  },
  {
    name: "abort signal removal mutation",
    file: "src/capabilities/text-input/runtime/primitive-text-input-runner.ts",
    oldText: "        abortSignal: abortController.signal,",
    newText: "        abortSignal: undefined as never,",
    expectedNeedle: "Text Input primitive runner must pass abortController.signal into the execution port call.",
    phase: "anti-escape",
  },
  {
    name: "primitive adapter bare hash mutation",
    file: "src/lib/browser/text-input-primitive-port.ts",
    oldText: "  return `sha256:${createHash(\"sha256\").update(text).digest(\"hex\")}`;",
    newText: "  return createHash(\"sha256\").update(text).digest(\"hex\");",
    expectedNeedle: "Text Input primitive adapter hashText must return schema-canonical sha256-prefixed hashes, not bare hex.",
    phase: "required",
  },
  {
    name: "retry loop mutation",
    file: "src/capabilities/text-input/runtime/primitive-text-input-runner.ts",
    oldText: "  const abortController = new AbortController();",
    newText: "  for (let retry = 0; retry < 2; retry += 1) {}\n  const abortController = new AbortController();",
    expectedNeedle: "Text Input primitive runner must not reintroduce retry loops.",
    phase: "anti-escape",
  },
  {
    name: "pav handoff removal mutation",
    file: "src/capabilities/text-input/runtime/text-input-result-builder.ts",
    oldText: "  const postActionVerificationHandoffRef = buildPostActionVerificationHandoffRef(input);",
    newText: "  const postActionVerificationHandoffRef = null;",
    expectedNeedle: "Text Input result builder must preserve output boundary, debug bundle, proof, and PAV handoff checkpoints.",
    phase: "required",
  },
  {
    name: "business result field mutation",
    file: "src/capabilities/text-input/runtime/text-input-result-builder-support.ts",
    oldText: "    runtimeProof,\n  };",
    newText: "    runtimeProof,\n    sendSuccess: outputBoundary.status === \"success\",\n  };",
    expectedNeedle: "Text Input must not expose forbidden business result field sendSuccess.",
    phase: "forbidden",
  },
  {
    name: "child direct primitive mutation",
    file: "src/capabilities/text-input/children/type-text/implementation.ts",
    oldText: "      const parsedInput = TypeTextAbilityInputSchema.parse(input);\n      return executeTextInput({ request: parsedInput, context });",
    newText: "      const parsedInput = TypeTextAbilityInputSchema.parse(input);\n      await context.executionPort.execute({} as never);\n      return executeTextInput({ request: parsedInput, context });",
    expectedNeedle: "executionPort.execute must not appear outside primitive-text-input-runner.",
    phase: "forbidden",
  },
  {
    name: "child forbidden browser import mutation",
    file: "src/capabilities/text-input/children/type-text/implementation.ts",
    oldText: "import { TypeTextAbilityInputSchema } from \"./schema.js\";",
    newText: "import type { BrowserControllerTextInputRuntimePorts } from \"../../../../lib/browser/text-input-primitive-port.js\";\nimport { TypeTextAbilityInputSchema } from \"./schema.js\";",
    expectedNeedle: "Text Input write-only boundary must not import foreign owner or browser internals.",
    phase: "forbidden",
  },
  {
    name: "forbidden child registry mutation",
    file: "src/capabilities/text-input/registry.ts",
    oldText: "  createCommitInputCapability(),\n] as const;",
    newText: "  createCommitInputCapability(),\n  { childCapabilityId: \"send-message\" } as never,\n] as const;",
    expectedNeedle: "Text Input registry must not expose forbidden child send-message.",
    phase: "required",
  },
  {
    name: "negative proof invocation removed mutation",
    file: "scripts/audit/domains/text-input-capability/inspector.ts",
    oldText: "      : await runNegativeProofHarness();",
    newText: "      : { findings: [], phase: { name: \"negative-proof-harness\", classification: \"PASS\" as const, passed: true, summary: \"mutated skip\" } };",
    expectedNeedle: "Text Input inspector must invoke the negative-proof harness.",
    phase: "required",
  },
];