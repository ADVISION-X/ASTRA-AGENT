import {
  createInspectorRunner,
  mutateAndVerify,
  writeMutationProofBundle,
  writeOwnerBindingBundle,
  type AuditMutation,
  type MutationCoverage,
  type MutationProofRecord,
} from "../_shared/negative-proof-runtime.js";

import { LAW_IDS } from "./config.js";

type Mutation = AuditMutation & {
  expectedNeedle: string;
};

type ProofMutation = Mutation & {
  lawId: string;
  scenarioId: string;
  coverageReason: string;
};

type MutationRecord = MutationProofRecord<Mutation>;

const INSPECTOR_ENTRY = "scripts/audit/domains/text-input-capability/inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_TEXT_INPUT_NEGATIVE_PROOF";

const OWNER_BINDING_MUTATIONS: Mutation[] = [
  {
    name: "manual-first-enforcement mutation",
    file: ".github/instructions/cursor-rules/modules/module-text-input-capability.instructions.md",
    search: "status: active\ntier: P0\ncapabilityDomain: text-input-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    replace: "status: active\ntier: P0\ncapabilityDomain: text-input-capability\nenforcementMode: manual-first\nevidenceMode: law+inspector+negative-proof",
    expectedNeedle: "Text Input active laws must remain machine-blocking.",
  },
  {
    name: "warning-only-p0 mutation",
    file: ".github/instructions/cursor-rules/modules/module-text-input-capability.instructions.md",
    search: "status: active\ntier: P0\ncapabilityDomain: text-input-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    replace: "status: active\ntier: P1\ncapabilityDomain: text-input-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    expectedNeedle: "Text Input active laws must remain P0.",
  },
  {
    name: "negative proof invocation removed mutation",
    file: "scripts/audit/domains/text-input-capability/inspector.ts",
    search: "      : await runNegativeProofHarness();",
    replace: "      : { findings: [], phase: { name: \"negative-proof-harness\", classification: \"PASS\" as const, passed: true, summary: \"mutated skip\" } };",
    expectedNeedle: "Text Input inspector must invoke the negative-proof harness.",
  },
];

const PROOF_MUTATIONS: ProofMutation[] = [
  {
    name: "orchestration-direct-text-port mutation",
    file: "src/capabilities/orchestration/ability-group.ts",
    search: "import { listOrchestrationChildren } from \"./registry.js\";",
    replace: "import type { TextInputExecutionPort } from \"../text-input/ports/text-input-execution-port.js\";\nimport { listOrchestrationChildren } from \"./registry.js\";",
    expectedNeedle: "External owners must not import Text Input execution or clipboard adapters directly.",
    lawId: LAW_IDS.PUBLIC,
    scenarioId: "text-input-orchestration-direct-port-import",
    coverageReason: "The mutation imports the Text Input execution port directly into Orchestration, proving governed write ownership stays inside the Text Input owner boundary.",
  },
  {
    name: "child forbidden browser import mutation",
    file: "src/capabilities/text-input/children/type-text/implementation.ts",
    search: "import { TypeTextAbilityInputSchema } from \"./schema.js\";",
    replace: "import type { BrowserControllerTextInputRuntimePorts } from \"../../../../lib/browser/text-input-primitive-port.js\";\nimport { TypeTextAbilityInputSchema } from \"./schema.js\";",
    expectedNeedle: "Text Input write-only boundary must not import foreign owner or browser internals.",
    lawId: LAW_IDS.WRITE_ONLY,
    scenarioId: "text-input-write-only-browser-import",
    coverageReason: "The mutation imports browser runtime internals into a Text Input child, proving the write-only boundary rejects foreign-owner and browser-internal dependencies.",
  },
  {
    name: "capability call optional mutation",
    file: "src/capabilities/text-input/schema.ts",
    search: "  capabilityCallId: z.string().min(1),",
    replace: "  capabilityCallId: nullableString,",
    expectedNeedle: "TextInputBaseSchema must keep capabilityCallId machine-required.",
    lawId: LAW_IDS.SHAPE,
    scenarioId: "text-input-capability-call-optional",
    coverageReason: "The mutation weakens a required chain field in the input schema, proving Text Input input shape must preserve the full governed mission/capability chain.",
  },
  {
    name: "abort signal removal mutation",
    file: "src/capabilities/text-input/runtime/primitive-text-input-runner.ts",
    search: "        abortSignal: abortController.signal,",
    replace: "        abortSignal: undefined as never,",
    expectedNeedle: "Text Input primitive runner must pass abortController.signal into the execution port call.",
    lawId: LAW_IDS.EXECUTION,
    scenarioId: "text-input-abort-signal-removed",
    coverageReason: "The mutation removes AbortSignal handoff from the primitive runner, proving Text Input execution must preserve governed timeout and cancellation enforcement.",
  },
  {
    name: "raw text debug leak mutation",
    file: "src/capabilities/text-input/runtime/text-input-debug-events.ts",
    search: "    emittedEventTypes,",
    replace: "    rawInputText: payloadText,\n    emittedEventTypes,",
    expectedNeedle: "Text Input debug material must not expose raw sensitive text or clipboard plaintext.",
    lawId: LAW_IDS.SENSITIVE,
    scenarioId: "text-input-raw-debug-leak",
    coverageReason: "The mutation leaks raw input text into the debug bundle, proving Text Input must keep sensitive text transient and redacted outside request scope.",
  },
  {
    name: "pav handoff removal mutation",
    file: "src/capabilities/text-input/runtime/text-input-result-builder.ts",
    search: "  const postActionVerificationHandoffRef = buildPostActionVerificationHandoffRef(input);",
    replace: "  const postActionVerificationHandoffRef = null;",
    expectedNeedle: "Text Input result builder must preserve output boundary, debug bundle, proof, and PAV handoff checkpoints.",
    lawId: LAW_IDS.RESULT,
    scenarioId: "text-input-pav-handoff-removed",
    coverageReason: "The mutation removes the Post-action Verification handoff from the result builder, proving Text Input success truth must hand off to PAV instead of claiming verified outcome locally.",
  },
  {
    name: "fabricated run id mutation",
    file: "src/capabilities/text-input/runtime/text-input-proof-builder.ts",
    search: "    runId: input.runId,",
    replace: "    runId: buildStableTextInputRef(\"text-input-run\", [input.attemptRef]),",
    expectedNeedle: "Text Input proof builder must not fabricate runId from attemptRef.",
    lawId: LAW_IDS.PROOF,
    scenarioId: "text-input-fabricated-run-id",
    coverageReason: "The mutation fabricates runId inside the runtime proof builder, proving Text Input proof truth must preserve the real chain rather than local synthetic refs.",
  },
  {
    name: "forbidden child registry mutation",
    file: "src/capabilities/text-input/registry.ts",
    search: "  createCommitInputCapability(),\n] as const;",
    replace: "  createCommitInputCapability(),\n  { childCapabilityId: \"send-message\" } as never,\n] as const;",
    expectedNeedle: "Text Input registry must not expose forbidden child send-message.",
    lawId: LAW_IDS.CHILDREN,
    scenarioId: "text-input-forbidden-child-registry",
    coverageReason: "The mutation adds a non-governed send-message child into the registry, proving Text Input children must stay within the canonical primitive writing set.",
  },
  {
    name: "negative proof invocation removed mutation",
    file: "scripts/audit/domains/text-input-capability/inspector.ts",
    search: "      : await runNegativeProofHarness();",
    replace: "      : { findings: [], phase: { name: \"negative-proof-harness\", classification: \"PASS\" as const, passed: true, summary: \"mutated skip\" } };",
    expectedNeedle: "Text Input inspector must invoke the negative-proof harness.",
    lawId: LAW_IDS.PACKAGE,
    scenarioId: "text-input-negative-proof-removed",
    coverageReason: "The mutation disconnects the Text Input inspector from its negative-proof harness, proving release truth requires live inspector plus negative-proof wiring.",
  },
];

const PROOF_MUTATION_COVERAGE: Record<string, MutationCoverage> = Object.fromEntries(
  PROOF_MUTATIONS.map((mutation) => [
    mutation.name,
    {
      coveredLawIds: [mutation.lawId],
      coverageReasonByLawId: {
        [mutation.lawId]: mutation.coverageReason,
      },
    },
  ]),
);

const PROOF_MUTATION_SCENARIO_IDS: Record<string, string> = Object.fromEntries(
  PROOF_MUTATIONS.map((mutation) => [mutation.name, mutation.scenarioId]),
);

async function verifyMutation(
  runInspector: Awaited<ReturnType<typeof createInspectorRunner>>,
  mutation: Mutation,
): Promise<MutationRecord> {
  const record = await mutateAndVerify(runInspector, mutation);
  if (!record.failOutput.includes(mutation.expectedNeedle)) {
    throw new Error(`Mutation ${mutation.name} failed without the expected reason: ${mutation.expectedNeedle}`);
  }
  return record;
}

async function writeLawProof(record: MutationRecord): Promise<void> {
  await writeMutationProofBundle({
    owner: "text-input",
    ownerTitle: "Text Input",
    record,
    coverageByMutationName: PROOF_MUTATION_COVERAGE,
    scenarioIdByMutationName: PROOF_MUTATION_SCENARIO_IDS,
  });
}

async function main(): Promise<void> {
  const runInspector = await createInspectorRunner({
    inspectorEntry: INSPECTOR_ENTRY,
    skipNegativeProofEnv: SKIP_NEGATIVE_PROOF_ENV,
  });
  const baseline = await runInspector();
  if (!baseline.passed) {
    throw new Error(`Text Input inspector baseline must pass before proof generation.\n${baseline.output}`);
  }

  for (const mutation of PROOF_MUTATIONS) {
    const record = await verifyMutation(runInspector, mutation);
    await writeLawProof(record);
  }

  const ownerBindingRecords: MutationRecord[] = [];
  for (const mutation of OWNER_BINDING_MUTATIONS) {
    ownerBindingRecords.push(await verifyMutation(runInspector, mutation));
  }
  await writeOwnerBindingBundle({
    owner: "text-input",
    title: "Text Input",
    ownerBindingMutationNames: OWNER_BINDING_MUTATIONS.map((mutation) => mutation.name),
    records: ownerBindingRecords,
  });

  process.stdout.write(`[TEXT-INPUT-PROOF-BUNDLES] generated ${PROOF_MUTATIONS.length} law proofs and ${ownerBindingRecords.length} owner-binding scenarios\n`);
}

void main();