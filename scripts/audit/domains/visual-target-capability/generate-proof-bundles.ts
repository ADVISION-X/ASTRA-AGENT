import { spawnSync } from "node:child_process";
import { access, readFile, unlink, writeFile } from "node:fs/promises";

import { pathFromRepoRoot } from "../../core/paths.js";
import { writeOwnerBindingProof } from "../_shared/owner-binding-proof-writer.js";
import { writeProductionMutationProof } from "../_shared/production-mutation-proof-writer.js";

const RUN_INSPECTOR_ENTRY = "scripts/audit/domains/visual-target-capability/run-inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_VISUAL_TARGET_NEGATIVE_PROOF";
const LAW_IDS = {
  OWNER: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V2",
  BOUNDARY: "GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V2",
  INPUT_CHAIN: "GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V2",
  OUTPUT_BOUNDARY: "GRASSEYE-VISUAL-TARGET-CAPABILITY-004-V2",
  PIPELINE: "GRASSEYE-VISUAL-TARGET-CAPABILITY-005-V2",
  PROOF_CHAIN: "GRASSEYE-VISUAL-TARGET-CAPABILITY-006-V2",
  CHILDREN: "GRASSEYE-VISUAL-TARGET-CAPABILITY-007-V2",
  PACKAGE: "GRASSEYE-VISUAL-TARGET-CAPABILITY-008-V2",
} as const;

type ReplaceMutation = {
  kind: "replace";
  name: string;
  file: string;
  oldText: string;
  newText: string;
  expectedNeedle: string;
  skipBuild?: boolean;
};

type CreateFileMutation = {
  kind: "create-file";
  name: string;
  file: string;
  content: string;
  expectedNeedle: string;
  skipBuild?: boolean;
};

type Mutation = ReplaceMutation | CreateFileMutation;
type ProofMutation = Mutation & {
  lawId: string;
  scenarioId: string;
  coverageReason: string;
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

const hasErrorCode = (error: unknown, code: string): boolean => typeof error === "object"
  && error !== null
  && "code" in error
  && error.code === code;

const OWNER_BINDING_MUTATIONS: Mutation[] = [
  {
    kind: "replace",
    name: "manual-first-enforcement-reintroduced",
    file: ".github/instructions/cursor-rules/modules/module-visual-target-capability.instructions.md",
    oldText: "status: active\ntier: P0\ncapabilityDomain: visual-target-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof\n\nsummary: Visual Target is the only owner of governed visual target result normalization.",
    newText: "status: active\ntier: P0\ncapabilityDomain: visual-target-capability\nenforcementMode: manual-first\nevidenceMode: law+inspector+negative-proof\n\nsummary: Visual Target is the only owner of governed visual target result normalization.",
    expectedNeedle: "must remain machine-blocking",
    skipBuild: false,
  },
  {
    kind: "replace",
    name: "turn-p0-into-warning-only",
    file: ".github/instructions/cursor-rules/modules/module-visual-target-capability.instructions.md",
    oldText: "status: active\ntier: P0\ncapabilityDomain: visual-target-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof\n\nsummary: Visual Target is the only owner of governed visual target result normalization.",
    newText: "status: active\ntier: P1\ncapabilityDomain: visual-target-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof\n\nsummary: Visual Target is the only owner of governed visual target result normalization.",
    expectedNeedle: "must remain P0",
    skipBuild: false,
  },
  {
    kind: "replace",
    name: "remove-negative-proof-invocation",
    file: "scripts/audit/domains/visual-target-capability/inspector.ts",
    oldText: "  : await runNegativeProofHarness();",
    newText: "    : { findings: [], phase: { name: \"negative-proof-harness\", classification: \"PASS\" as const, passed: true, summary: \"negative-proof removed by mutation\" } };",
    expectedNeedle: "must invoke and report the negative-proof harness",
  },
];

const PROOF_MUTATIONS: ProofMutation[] = [
  {
    kind: "create-file",
    name: "external-import-of-child-implementation",
    file: "src/app/visual-target-private-import-probe.ts",
    content: 'import "../capabilities/visual-target/children/observe-comments-button/implementation.js";\nexport const probe = true;\n',
    expectedNeedle: "External code must not import Visual Target internal surface",
    lawId: LAW_IDS.OWNER,
    scenarioId: "visual-target-external-private-import",
    coverageReason: "The mutation imports a Visual Target child implementation from outside the owner package, proving target-truth ownership remains exclusive to the Visual Target public contract.",
  },
  {
    kind: "create-file",
    name: "visual-target-local-ai-import",
    file: "src/capabilities/visual-target/runtime/local-ai-import-probe.ts",
    content: 'import { LocalAiGateway } from "../../../lib/local-ai/local-ai-gateway.js";\nexport const probe = LocalAiGateway;\n',
    expectedNeedle: "Visual Target imported forbidden owner surface",
    lawId: LAW_IDS.BOUNDARY,
    scenarioId: "visual-target-local-ai-import",
    coverageReason: "The mutation imports Local AI directly inside Visual Target runtime code, proving the boundary rejects foreign-owner execution surfaces.",
  },
  {
    kind: "replace",
    name: "remove-capabilityCallId-from-input",
    file: "src/capabilities/visual-target/shared/visual-target-governance.ts",
    oldText: "  capabilityCallId: limitedString(200),",
    newText: "  capabilityCallIdRemoved: limitedString(200),",
    expectedNeedle: "VisualTargetAbilityInputSchema is missing capabilityCallId.",
    lawId: LAW_IDS.INPUT_CHAIN,
    scenarioId: "visual-target-missing-capability-call-id",
    coverageReason: "The mutation removes a required chain field from the governed input schema, proving Visual Target rejects incomplete chain-bearing inputs.",
  },
  {
    kind: "replace",
    name: "geometryGuardHandoffRequired-false",
    file: "src/capabilities/visual-target/runtime/visual-target-output-boundary-gate.ts",
    oldText: "    geometryGuardHandoffRequired: true,",
    newText: "    geometryGuardHandoffRequired: false,",
    expectedNeedle: "Action output must keep geometryGuardHandoffRequired=true.",
    lawId: LAW_IDS.OUTPUT_BOUNDARY,
    scenarioId: "visual-target-geometry-guard-handoff-disabled",
    coverageReason: "The mutation marks action output as not requiring Geometry Guard handoff, proving Visual Target success output must remain non-executable until Geometry Guard approval.",
  },
  {
    kind: "replace",
    name: "critical-data-quality-fail-open",
    file: "src/capabilities/visual-target/runtime/visual-target-output-boundary-gate.ts",
    oldText: '  "critical_data_quality",',
    newText: '  "critical_data_quality_removed",',
    expectedNeedle: "Output boundary must fail closed on critical_data_quality.",
    lawId: LAW_IDS.PIPELINE,
    scenarioId: "visual-target-critical-data-quality-fail-open",
    coverageReason: "The mutation removes critical_data_quality from the boundary's fail-closed set, proving the governed gate pipeline must stop on critical data-quality drift.",
  },
  {
    kind: "replace",
    name: "proof-runId-from-session-child",
    file: "src/capabilities/visual-target/runtime/visual-target-proof-builder.ts",
    oldText: "    ...chain,\n    sessionId: input.trace.sessionId,",
    newText: "    ...chain,\n    runId: buildStableVisualTargetRef(\"visual-target-run\", [input.trace.sessionId, input.trace.childCapabilityId, input.trace.roundId, input.trace.videoVisitId]),\n    sessionId: input.trace.sessionId,",
    expectedNeedle: "Runtime proof must not fabricate runId from local stable refs.",
    lawId: LAW_IDS.PROOF_CHAIN,
    scenarioId: "visual-target-fabricated-run-id",
    coverageReason: "The mutation fabricates runId inside the runtime proof builder, proving Visual Target proof truth must propagate real chain fields instead of local stable refs.",
  },
  {
    kind: "replace",
    name: "child-boolean-return",
    file: "src/capabilities/visual-target/children/observe-comments-button/implementation.ts",
    oldText: "      return executeVisualTarget({ request, context });",
    newText: "      return true;",
    expectedNeedle: "Child observe-comments-button must not return boolean shortcuts.",
    lawId: LAW_IDS.CHILDREN,
    scenarioId: "visual-target-child-boolean-shortcut",
    coverageReason: "The mutation replaces the governed child runtime call with a boolean shortcut, proving child capabilities must route through executeVisualTarget() and keep the shared runtime contract.",
  },
  {
    kind: "replace",
    name: "remove-negative-proof-invocation",
    file: "scripts/audit/domains/visual-target-capability/inspector.ts",
    oldText: "  : await runNegativeProofHarness();",
    newText: "    : { findings: [], phase: { name: \"negative-proof-harness\", classification: \"PASS\" as const, passed: true, summary: \"negative-proof removed by mutation\" } };",
    expectedNeedle: "must invoke and report the negative-proof harness",
    lawId: LAW_IDS.PACKAGE,
    scenarioId: "visual-target-negative-proof-removed",
    coverageReason: "The mutation removes the owner-local negative-proof harness invocation, proving Visual Target package enforcement requires inspector plus negative-proof wiring as live release truth.",
  },
];

const runInspectorProcess = (skipBuild = true) => {
  const result = spawnSync("node", ["--import", "tsx", RUN_INSPECTOR_ENTRY, ...(skipBuild ? ["--skip-build"] : [])], {
    cwd: pathFromRepoRoot("."),
    encoding: "utf8",
    env: { ...process.env, [SKIP_NEGATIVE_PROOF_ENV]: "1" },
  });
  return { status: result.status, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
};

const applyReplaceMutation = (source: string, mutation: ReplaceMutation): string => {
  const matchIndex = source.indexOf(mutation.oldText);
  if (matchIndex === -1) {
    throw new Error(`Mutation ${mutation.name} could not find target text in ${mutation.file}`);
  }
  return `${source.slice(0, matchIndex)}${mutation.newText}${source.slice(matchIndex + mutation.oldText.length)}`;
};

async function applyMutation(mutation: Mutation): Promise<{ rollback: () => Promise<void>; originalContent: string; mutatedContent: string }> {
  const absolutePath = pathFromRepoRoot(mutation.file);
  if (mutation.kind === "replace") {
    const originalContent = await readFile(absolutePath, "utf8");
    const mutatedContent = applyReplaceMutation(originalContent, mutation);
    await writeFile(absolutePath, mutatedContent, "utf8");
    return {
      originalContent,
      mutatedContent,
      rollback: async () => writeFile(absolutePath, originalContent, "utf8"),
    };
  }

  try {
    await access(absolutePath);
    throw new Error(`Create-file mutation ${mutation.name} expected ${mutation.file} to be absent before mutation.`);
  } catch (error) {
    if (!hasErrorCode(error, "ENOENT")) {
      throw error;
    }
  }

  await writeFile(absolutePath, mutation.content, "utf8");
  return {
    originalContent: "",
    mutatedContent: mutation.content,
    rollback: async () => unlink(absolutePath),
  };
}

async function verifyMutation(mutation: Mutation): Promise<MutationRecord> {
  const startedAt = new Date().toISOString();
  const { rollback, originalContent, mutatedContent } = await applyMutation(mutation);
  let failOutput = "";
  try {
    const failRun = runInspectorProcess(mutation.skipBuild ?? true);
    failOutput = failRun.output;
    if (failRun.status === 0) {
      throw new Error(`Mutation ${mutation.name} did not fail inspector as expected.\n${failOutput}`);
    }
    if (!failOutput.includes(mutation.expectedNeedle)) {
      throw new Error(`Mutation ${mutation.name} failed without the expected reason: ${mutation.expectedNeedle}`);
    }
  } finally {
    await rollback();
  }

  const passRun = runInspectorProcess(false);
  if (passRun.status !== 0) {
    throw new Error(`Rollback verification failed for ${mutation.name}.\n${passRun.output}`);
  }

  return {
    mutation,
    originalContent,
    mutatedContent,
    failOutput,
    passOutput: passRun.output,
    startedAt,
    endedAt: new Date().toISOString(),
  };
}

async function writeLawProof(record: MutationRecord, mutation: ProofMutation): Promise<void> {
  await writeProductionMutationProof({
    owner: "visual-target",
    ownerTitle: "Visual Target",
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
    owner: "visual-target",
    title: "Visual Target",
    scenarios,
    rollbackOutput: records.at(-1)?.passOutput ?? "rollback restored baseline PASS",
  });
}

async function main(): Promise<void> {
  const baseline = runInspectorProcess(true);
  if (baseline.status !== 0) {
    throw new Error(`Visual Target inspector baseline must pass before proof generation.\n${baseline.output}`);
  }

  for (const mutation of PROOF_MUTATIONS) {
    const record = await verifyMutation(mutation);
    await writeLawProof(record, mutation);
  }

  const ownerBindingRecords: MutationRecord[] = [];
  for (const mutation of OWNER_BINDING_MUTATIONS) {
    ownerBindingRecords.push(await verifyMutation(mutation));
  }
  await writeOwnerBindingBundle(ownerBindingRecords);

  process.stdout.write(`[VISUAL-TARGET-PROOF-BUNDLES] generated ${PROOF_MUTATIONS.length} law proofs and ${ownerBindingRecords.length} owner-binding scenarios\n`);
}

void main();