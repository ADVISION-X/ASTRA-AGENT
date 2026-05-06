import { readFile } from "node:fs/promises";

import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";
import { writeOwnerBindingProof } from "../_shared/owner-binding-proof-writer.js";
import { writeProductionMutationProof } from "../_shared/production-mutation-proof-writer.js";

type Mutation = {
  name: string;
  file: string;
  search: string;
  replace: string;
};

type InspectorRunResult = { passed: boolean; violationCount: number; output: string };
type InspectorRunner = () => Promise<InspectorRunResult>;
type MutationProofRecord = {
  mutation: Mutation;
  originalContent: string;
  mutatedContent: string;
  failOutput: string;
  passOutput: string;
  startedAt: string;
  endedAt: string;
};

const INSPECTOR_ENTRY = "scripts/audit/domains/mouse-click-capability/inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_MOUSE_CLICK_NEGATIVE_PROOF";
const OWNER_BINDING_MUTATION_NAMES = [
  "manual-first-enforcement mutation",
  "warning-only-p0 mutation",
  "workbench composition drift mutation",
] as const;
const LAW_IDS = {
  EXECUTION: "GRASSEYE-MOUSE-CLICK-CAPABILITY-001-V2",
  BOUNDARY: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V2",
  SCHEMA: "GRASSEYE-MOUSE-CLICK-CAPABILITY-003-V2",
  PIPELINE: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V2",
  RESULT: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V2",
  PROOF: "GRASSEYE-MOUSE-CLICK-CAPABILITY-006-V2",
  CHILDREN: "GRASSEYE-MOUSE-CLICK-CAPABILITY-007-V2",
  ENFORCEMENT: "GRASSEYE-MOUSE-CLICK-CAPABILITY-008-V2",
} as const;

const MUTATIONS: Mutation[] = [
  {
    name: "manual-first-enforcement mutation",
    file: ".github/instructions/cursor-rules/modules/module-mouse-click-capability.instructions.md",
    search: "status: active\ntier: P0\ncapabilityDomain: mouse-click-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    replace: "status: active\ntier: P0\ncapabilityDomain: mouse-click-capability\nenforcementMode: manual-first\nevidenceMode: law+inspector+negative-proof",
  },
  {
    name: "warning-only-p0 mutation",
    file: ".github/instructions/cursor-rules/modules/module-mouse-click-capability.instructions.md",
    search: "status: active\ntier: P0\ncapabilityDomain: mouse-click-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    replace: "status: active\ntier: P1\ncapabilityDomain: mouse-click-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
  },
  {
    name: "browser-controller-public-contract mutation",
    file: "src/capabilities/mouse-click/contract.ts",
    search: "import type { z } from \"zod\";",
    replace: "import type { z } from \"zod\";\nimport type { BrowserController } from \"../../lib/browser/browser-controller.js\";",
  },
  {
    name: "platform-adapter-direct-click mutation",
    file: "src/lib/local-runtime/workbench-mouse-click-runtime.ts",
    search: "  mouseClickAbilityGroup: createWorkbenchMouseClickAbilityGroup({",
    replace: "  platformClickStrategy: runtime.browserController.click({ x: 0, y: 0, button: \"left\", clickCount: 1 }),\n  mouseClickAbilityGroup: createWorkbenchMouseClickAbilityGroup({",
  },
  {
    name: "mouse-click-final-action-log mutation",
    file: "src/capabilities/mouse-click/runtime/mouse-click-result-builder.ts",
    search: "    postActionVerificationHandoffRef: verification.postActionVerificationHandoffRef,",
    replace: "    postActionVerificationHandoffRef: verification.postActionVerificationHandoffRef,\n    actionLogRef: input.seed.attemptRef,",
  },
  {
    name: "platform-business-verb-child mutation",
    file: "src/capabilities/mouse-click/registry.ts",
    search: "  createClickDesktopCoordinateCapability(),",
    replace: "  createClickDesktopCoordinateCapability(),\n  \"open_comments\" as never,",
  },
  {
    name: "export-star escape mutation",
    file: "src/capabilities/mouse-click/index.ts",
    search: 'export { listMouseClickChildren } from "./registry.js";',
    replace: 'export { listMouseClickChildren } from "./registry.js";\nexport * from "./schema.js";',
  },
  {
    name: "policy gate bypass mutation",
    file: "src/capabilities/mouse-click/runtime/mouse-click-preflight-stages.ts",
    search: "const policyGate = validateClickPolicy({ request: input.request, nowIsoTimestamp: input.context.clock.now().isoTimestamp });",
    replace: "const policyDecision = validateClickPolicy({ request: input.request, nowIsoTimestamp: input.context.clock.now().isoTimestamp });",
  },
  {
    name: "proof drop mutation",
    file: "src/capabilities/mouse-click/runtime/mouse-click-result-builder.ts",
    search: "const runtimeProof = buildMouseClickRuntimeProof(buildRuntimeProofInput(input, outputRef, diagnosticPayloadRef, verification));",
    replace: "const proofRemoved = buildMouseClickRuntimeProof(buildRuntimeProofInput(input, outputRef, diagnosticPayloadRef, verification));",
  },
  {
    name: "input capabilityCallId removal mutation",
    file: "src/capabilities/mouse-click/schema.ts",
    search: "  activationSnapshotRef: z.string().min(1),\n  capabilityCallId: z.string().min(1),\n  nerveBusEnvelopeId: z.string().min(1),\n  requestedBy: z.string().min(1),",
    replace: "  activationSnapshotRef: z.string().min(1),\n  nerveBusEnvelopeId: z.string().min(1),\n  requestedBy: z.string().min(1),",
  },
  {
    name: "proof fabricated runId mutation",
    file: "src/capabilities/mouse-click/runtime/mouse-click-proof-builder.ts",
    search: "    runId: input.runId,\n",
    replace: "    runId: buildStableMouseClickRef(\"mouse-click-run\", [input.attemptRef, input.childCapabilityId]),\n",
  },
  {
    name: "success without PAV handoff mutation",
    file: "src/capabilities/mouse-click/runtime/mouse-click-result-builder.ts",
    search: "    postActionVerificationHandoffRef: verification.postActionVerificationHandoffRef,\n    dataQualityFlags: input.dataQualityFlags,\n    runtimeProof,",
    replace: "    postActionVerificationHandoffRef: null,\n    dataQualityFlags: input.dataQualityFlags,\n    runtimeProof,",
  },
  {
    name: "timeout race removal mutation",
    file: "src/capabilities/mouse-click/runtime/primitive-click-runner.ts",
    search: "return Promise.race([",
    replace: "return Promise.all([",
  },
  {
    name: "computed click escape mutation",
    file: "src/capabilities/mouse-click/runtime/primitive-click-runner.ts",
    search: "input.context.primitivePort.click({",
    replace: 'input.context.primitivePort["click"]({',
  },
  {
    name: "abort signal removal mutation",
    file: "src/capabilities/mouse-click/runtime/primitive-click-runner.ts",
    search: "      abortSignal: abortController.signal,\n",
    replace: "",
  },
  {
    name: "workbench composition drift mutation",
    file: "src/lib/local-runtime/workbench-mouse-click-runtime.ts",
    search: "mouseClickAbilityGroup: createWorkbenchMouseClickAbilityGroup({",
    replace: "mouseClickAbilityGroup: createMouseClickAbilityGroupWithPrimitivePort({",
  },
];

const MUTATION_LAW_COVERAGE: Record<string, {
  coveredLawIds: string[];
  coverageReasonByLawId: Record<string, string>;
}> = {
  "manual-first-enforcement mutation": {
    coveredLawIds: [LAW_IDS.ENFORCEMENT],
    coverageReasonByLawId: {
      [LAW_IDS.ENFORCEMENT]: "The mutation downgrades Mouse Click enforcement to manual-first, proving this domain must remain machine-blocking through its owner-local inspector and negative-proof chain.",
    },
  },
  "platform-adapter-direct-click mutation": {
    coveredLawIds: [LAW_IDS.EXECUTION],
    coverageReasonByLawId: {
      [LAW_IDS.EXECUTION]: "The mutation lets the workbench composition root invoke a click primitive directly, proving governed click execution truth remains owned by Mouse Click.",
    },
  },
  "mouse-click-final-action-log mutation": {
    coveredLawIds: [LAW_IDS.BOUNDARY, LAW_IDS.RESULT],
    coverageReasonByLawId: {
      [LAW_IDS.BOUNDARY]: "The mutation leaks final action-log ownership into Mouse Click result building, proving Mouse Click cannot perform foreign-owner work.",
      [LAW_IDS.RESULT]: "The mutation adds final action-log truth to a Mouse Click result, proving result success must stay limited to primitive click plus PAV handoff.",
    },
  },
  "input capabilityCallId removal mutation": {
    coveredLawIds: [LAW_IDS.SCHEMA],
    coverageReasonByLawId: {
      [LAW_IDS.SCHEMA]: "The mutation removes a required chain field from Mouse Click input schema, proving execution input must preserve full upstream chain identity.",
    },
  },
  "policy gate bypass mutation": {
    coveredLawIds: [LAW_IDS.PIPELINE],
    coverageReasonByLawId: {
      [LAW_IDS.PIPELINE]: "The mutation bypasses the governed click policy gate, proving Mouse Click must keep its fixed execution pipeline intact before any primitive click runs.",
    },
  },
  "proof fabricated runId mutation": {
    coveredLawIds: [LAW_IDS.PROOF],
    coverageReasonByLawId: {
      [LAW_IDS.PROOF]: "The mutation fabricates a runtime proof identity field, proving Mouse Click runtime proof must preserve the real upstream execution chain.",
    },
  },
  "platform-business-verb-child mutation": {
    coveredLawIds: [LAW_IDS.CHILDREN],
    coverageReasonByLawId: {
      [LAW_IDS.CHILDREN]: "The mutation injects a platform business verb into the Mouse Click child registry, proving children must remain narrow primitive bindings only.",
    },
  },
};

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

async function mutateAndVerify(runInspector: InspectorRunner, mutation: Mutation): Promise<MutationProofRecord> {
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

const writeMutationProof = async (record: MutationProofRecord) => {
  const coverage = MUTATION_LAW_COVERAGE[record.mutation.name];
  if (!coverage) {
    return;
  }

  await writeProductionMutationProof({
    owner: "mouse-click",
    ownerTitle: "Mouse Click",
    mutationName: record.mutation.name,
    scenarioId: record.mutation.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    coveredLawIds: coverage.coveredLawIds,
    coverageReasonByLawId: coverage.coverageReasonByLawId,
    mutatedFile: record.mutation.file,
    originalContent: record.originalContent,
    mutatedContent: record.mutatedContent,
    failOutput: record.failOutput,
    passOutput: record.passOutput,
    startedAt: record.startedAt,
    endedAt: record.endedAt,
  });
};

const writeOwnerBindingBundle = async (records: MutationProofRecord[]) => {
  const scenarios = OWNER_BINDING_MUTATION_NAMES.flatMap((mutationName) => {
    const record = records.find((candidate) => candidate.mutation.name === mutationName);
    return record
      ? [{
          scenario: mutationName.replace(/ mutation$/, ""),
          outputFileName: `${mutationName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}-fail.txt`,
          output: record.failOutput,
        }]
      : [];
  });

  await writeOwnerBindingProof({
    owner: "mouse-click",
    title: "Mouse Click",
    scenarios,
    rollbackOutput: records.at(-1)?.passOutput ?? "rollback restored baseline PASS",
  });
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
        lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-007-V2",
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
    await writeMutationProof(record);
  }

  await writeOwnerBindingBundle(records);
  return records;
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    const runInspector = await createInspectorRunner();
    const baseline = await runInspector();
    if (!baseline.passed) {
      return createFatalResult(
        "Mouse Click inspector baseline must pass before negative-proof mutation checks.",
        "Mouse Click negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    await runMutations(runInspector);

    return createPassResult("Mouse Click negative-proof harness rejects baseline drift, BrowserController public-contract leak, platform direct click ownership, final action-log leakage, platform business-verb child drift, gate bypass, proof drop, timeout escape, computed click, and composition drift mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Mouse Click negative-proof harness failed.",
      "Mouse Click negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}
