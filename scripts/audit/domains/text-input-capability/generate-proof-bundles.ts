import { readFile } from "node:fs/promises";

import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";
import { writeOwnerBindingProof } from "../_shared/owner-binding-proof-writer.js";
import { writeProductionMutationProof } from "../_shared/production-mutation-proof-writer.js";

import { LAW_IDS } from "./config.js";

type Mutation = {
  name: string;
  file: string;
  search: string;
  replace: string;
  expectedNeedle: string;
};

type ProofMutation = Mutation & {
  lawId: string;
  scenarioId: string;
  coverageReason: string;
};

type InspectorRunResult = {
  passed: boolean;
  violationCount: number;
  output: string;
};

type MutationRecord = {
  mutation: Mutation;
  originalContent: string;
  mutatedContent: string;
  failOutput: string;
  passOutput: string;
  startedAt: string;
  endedAt: string;
};

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

async function createInspectorRunner(): Promise<() => Promise<InspectorRunResult>> {
  await buildAuditArtifacts();
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const inspector = await loadInspector(INSPECTOR_ENTRY);

  return async () => {
    const previous = process.env[SKIP_NEGATIVE_PROOF_ENV];
    process.env[SKIP_NEGATIVE_PROOF_ENV] = "1";
    try {
      const result = await inspector(context);
      return {
        passed: result.passed,
        violationCount: result.violationCount,
        output: [
          `classification: ${result.classification}`,
          `passed: ${result.passed}`,
          `violationCount: ${result.violationCount}`,
          `summary: ${result.summary}`,
          "",
          ...result.findings.map((finding) => `${finding.severity.toUpperCase()} ${finding.lawId ?? "no-law"} ${finding.file}:${finding.line} ${finding.message}`),
          "",
        ].join("\n"),
      };
    } finally {
      if (previous === undefined) {
        delete process.env[SKIP_NEGATIVE_PROOF_ENV];
      } else {
        process.env[SKIP_NEGATIVE_PROOF_ENV] = previous;
      }
    }
  };
}

async function verifyMutation(runInspector: () => Promise<InspectorRunResult>, mutation: Mutation): Promise<MutationRecord> {
  const filePath = pathFromRepoRoot(mutation.file);
  const state = await readAuditFileState(filePath);
  const startedAt = new Date().toISOString();
  await applyAuditMutation(filePath, state.original, mutation);
  const mutatedContent = await readFile(filePath, "utf8");
  let failOutput = "";

  try {
    const result = await runInspector();
    failOutput = result.output;
    if (result.passed || result.violationCount === 0) {
      throw new Error(`Inspector did not fail for ${mutation.name}`);
    }
    if (!failOutput.includes(mutation.expectedNeedle)) {
      throw new Error(`Mutation ${mutation.name} failed without the expected reason: ${mutation.expectedNeedle}`);
    }
  } finally {
    await restoreAuditFileState(filePath, state);
  }

  const restored = await runInspector();
  if (!restored.passed) {
    throw new Error(`Rollback verification failed for ${mutation.name}`);
  }

  return {
    mutation,
    originalContent: state.original,
    mutatedContent,
    failOutput,
    passOutput: restored.output,
    startedAt,
    endedAt: new Date().toISOString(),
  };
}

async function writeLawProof(record: MutationRecord, mutation: ProofMutation): Promise<void> {
  await writeProductionMutationProof({
    owner: "text-input",
    ownerTitle: "Text Input",
    mutationName: mutation.name,
    scenarioId: mutation.scenarioId,
    coveredLawIds: [mutation.lawId],
    coverageReasonByLawId: { [mutation.lawId]: mutation.coverageReason },
    mutatedFile: mutation.file,
    originalContent: record.originalContent,
    mutatedContent: record.mutatedContent,
    failOutput: record.failOutput,
    passOutput: record.passOutput,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
  });
}

async function writeOwnerBindingBundle(records: MutationRecord[]): Promise<void> {
  const scenarios = records.map((record) => ({
    scenario: record.mutation.name,
    outputFileName: `${record.mutation.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}-fail.txt`,
    output: record.failOutput,
  }));
  await writeOwnerBindingProof({
    owner: "text-input",
    title: "Text Input",
    scenarios,
    rollbackOutput: records.at(-1)?.passOutput ?? "rollback restored baseline PASS",
  });
}

async function main(): Promise<void> {
  const runInspector = await createInspectorRunner();
  const baseline = await runInspector();
  if (!baseline.passed) {
    throw new Error(`Text Input inspector baseline must pass before proof generation.\n${baseline.output}`);
  }

  for (const mutation of PROOF_MUTATIONS) {
    const record = await verifyMutation(runInspector, mutation);
    await writeLawProof(record, mutation);
  }

  const ownerBindingRecords: MutationRecord[] = [];
  for (const mutation of OWNER_BINDING_MUTATIONS) {
    ownerBindingRecords.push(await verifyMutation(runInspector, mutation));
  }
  await writeOwnerBindingBundle(ownerBindingRecords);

  process.stdout.write(`[TEXT-INPUT-PROOF-BUNDLES] generated ${PROOF_MUTATIONS.length} law proofs and ${ownerBindingRecords.length} owner-binding scenarios\n`);
}

void main();