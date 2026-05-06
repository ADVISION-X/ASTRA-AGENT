import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";
import { writeOwnerBindingProof } from "../_shared/owner-binding-proof-writer.js";
import { writeProductionMutationProof } from "../_shared/production-mutation-proof-writer.js";
import { openInspectionConstants as config } from "./inspection-constants.js";

type Mutation = {
  name: string;
  file: string;
  search: string;
  replace: string;
  skipBuild?: boolean;
};

const INSPECTOR_ENTRY = "scripts/audit/domains/open-capability/inspector.ts";
const EXPORT_STAR_MUTATION = `export ${"*"} from "./schema.js";`;
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_OPEN_NEGATIVE_PROOF";

type MutationProofRecord = {
  mutation: Mutation;
  originalContent: string;
  mutatedContent: string;
  failOutput: string;
  passOutput: string;
  startedAt: string;
  endedAt: string;
};

const MUTATIONS: Mutation[] = [
  {
    name: "manual-first-enforcement mutation",
    file: ".github/instructions/cursor-rules/modules/module-open-capability.instructions.md",
    search: "status: active\ntier: P0\ncapabilityDomain: open-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    replace: "status: active\ntier: P0\ncapabilityDomain: open-capability\nenforcementMode: manual-first\nevidenceMode: law+inspector+negative-proof",
    skipBuild: true,
  },
  {
    name: "warning-only-p0 mutation",
    file: ".github/instructions/cursor-rules/modules/module-open-capability.instructions.md",
    search: "status: active\ntier: P0\ncapabilityDomain: open-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    replace: "status: active\ntier: P1\ncapabilityDomain: open-capability\nenforcementMode: machine-blocking\nevidenceMode: law+inspector+negative-proof",
    skipBuild: true,
  },
  {
    name: "request chain mutation",
    file: "src/capabilities/open/schema-core.ts",
    search: "  stepId: z.string().min(1),",
    replace: "  // mutated stepId removed,",
  },
  {
    name: "result diagnostic mutation",
    file: "src/capabilities/open/schema-proof.ts",
    search: "  diagnosticPayloadRef: nullableString,\n  dataQualityFlags: z.array(OpenDataQualityFlagSchema).default([]),\n  runtimeProof: OpenRuntimeProofSchema,",
    replace: "  // mutated diagnosticPayloadRef removed,\n  dataQualityFlags: z.array(OpenDataQualityFlagSchema).default([]),\n  runtimeProof: OpenRuntimeProofSchema,",
  },
  {
    name: "proof browser-session mutation",
    file: "src/capabilities/open/schema-proof.ts",
    search: "  browserSessionRef: nullableString,",
    replace: "  // mutated browserSessionRef removed,",
  },
  {
    name: "proof chain mutation",
    file: "src/capabilities/open/runtime/open-proof-builder.ts",
    search: "  capabilityCallId: request.capabilityCallId,",
    replace: "  // mutated capabilityCallId removed,",
  },
  {
    name: "dispatch shape-hash mutation",
    file: "src/capabilities/open/runtime/open-dispatch-failure-builders.ts",
    search: '  receivedShapeHash: input.trace.parseDecision === "fallback_trace_only" ? input.trace.receivedShapeHash : null,',
    replace: "  receivedShapeHash: null,",
  },
  {
    name: "success handoff mutation",
    file: "src/capabilities/open/runtime/open-result-builder.ts",
    search: "    pageStateHandoffRef,\n    pageStateHandoffRequired: true,",
    replace: "    pageStateHandoffRequired: true,",
  },
  {
    name: "timeout abort mutation",
    file: "src/capabilities/open/runtime/navigation-runner-support.ts",
    search: "      abortSignal: abortController.signal,",
    replace: "      // mutated abortSignal removed,",
  },
  {
    name: "idempotency fail-open mutation",
    file: "src/capabilities/open/runtime/open-idempotency.ts",
    search: "    return buildDuplicateReviewRequiredReservation(idempotencyKey);",
    replace: "    return buildReservedReservation(idempotencyKey);",
  },
  {
    name: "dispatch fake allow mutation",
    file: "src/capabilities/open/runtime/open-dispatch-failure-builders.ts",
    search: "const buildOpenDispatchFailureTargetPolicyDecision = (input: OpenDispatchFailureInput) => ({\n  status: \"block\" as const,",
    replace: "const buildOpenDispatchFailureTargetPolicyDecision = (input: OpenDispatchFailureInput) => ({\n  status: \"allow\" as const,",
  },
  {
    name: "export star mutation",
    file: "src/capabilities/open/index.ts",
    search: 'export type { OpenBrowserPort } from "./ports/open-browser-port.js";',
    replace: `export type { OpenBrowserPort } from "./ports/open-browser-port.js";\n${EXPORT_STAR_MUTATION}`,
  },
  {
    name: "forbidden import mutation",
    file: "src/capabilities/open/runtime/open-executor.ts",
    search: 'import { executeOpenChildFlow } from "./open-executor-flow.js";',
    replace: 'import { executeOpenChildFlow } from "./open-executor-flow.js";\nimport type { ScreenshotAbilityGroup } from "../../screenshot/contract.js";',
  },
  {
    name: "external private-leak mutation",
    file: "src/lib/local-runtime/workbench-open-runtime.ts",
    search: 'import { createOpenAbilityGroup } from "../../capabilities/open/index.js";',
    replace: 'import { createOpenAbilityGroup } from "../../capabilities/open/index.js";\nimport { executeOpenChild } from "../../capabilities/open/runtime/open-executor.js";\nvoid executeOpenChild;',
  },
  {
    name: "remove open-local-program child mutation",
    file: "src/capabilities/open/shared/open-target-profile.ts",
    search: '  "open-local-program",',
    replace: "  // mutated open-local-program removed,",
  },
  {
    name: "remove macos-local platform mutation",
    file: "src/capabilities/open/shared/open-target-profile.ts",
    search: '  "macos-local",',
    replace: "  // mutated macos-local removed,",
  },
  {
    name: "remove local-program target kind mutation",
    file: "src/capabilities/open/shared/open-target-profile.ts",
    search: '  "local-program",',
    replace: "  // mutated local-program removed,",
  },
  {
    name: "registry local-program fake localhost mutation",
    file: "src/capabilities/open/registry.ts",
    search: '    targetProfileRef: OPEN_LOCAL_PROGRAM_TARGET_PROFILE_REF,',
    replace: '    allowedHostnames: ["localhost"],\n    defaultUrl: "http://127.0.0.1:3000",\n    allowedSchemes: ["http"],\n    targetProfileRef: OPEN_LOCAL_PROGRAM_TARGET_PROFILE_REF,',
  },
  {
    name: "local-program child raw shell mutation",
    file: "src/capabilities/open/children/open-local-program/implementation.ts",
    search: 'import { executeOpenChild } from "../../runtime/open-executor.js";',
    replace: 'import { executeOpenChild } from "../../runtime/open-executor.js";\nimport { spawn } from "node:child_process";\nvoid spawn;',
  },
  {
    name: "local-program missing window handoff proof mutation",
    file: "src/capabilities/open/runtime/local-program-runner.ts",
    search: "    windowHandoffRef: handoff.windowHandoffRef,\n    localAppStateHandoffRef: handoff.localAppStateHandoffRef,\n    localProgramSnapshotAvailable",
    replace: "    windowHandoffRef: null,\n    localAppStateHandoffRef: handoff.localAppStateHandoffRef,\n    localProgramSnapshotAvailable",
  },
  {
    name: "local-program missing local app state handoff proof mutation",
    file: "src/capabilities/open/runtime/local-program-runner.ts",
    search: "    windowHandoffRef: handoff.windowHandoffRef,\n    localAppStateHandoffRef: handoff.localAppStateHandoffRef,\n    localProgramSnapshotAvailable",
    replace: "    windowHandoffRef: handoff.windowHandoffRef,\n    localAppStateHandoffRef: null,\n    localProgramSnapshotAvailable",
  },
  {
    name: "remove OpenLocalProgramPort adapter injection mutation",
    file: "src/lib/local-runtime/workbench-open-runtime.ts",
    search: "    localProgram: createGovernedMacOSOpenLocalProgramAdapter(),\n",
    replace: "",
  },
  {
    name: "remove local-program readiness block mutation",
    file: "src/lib/local-runtime/workbench-status.ts",
    search: "BLOCKED_OPEN_LOCAL_PROGRAM_PORT_NOT_CONFIGURED",
    replace: "MUTATED_NO_LOCAL_PROGRAM_READINESS_BLOCK",
  },
  {
    name: "local-program adapter raw shell mutation",
    file: "src/lib/local-runtime/open-local-program-adapter.ts",
    search: "shell: false",
    replace: "shell: true",
  },
  {
    name: "catalog omits open-local-program supported targets mutation",
    file: "src/map-plugins/authoring/capability-catalog/builders/build-ai-open-entries.ts",
    search: '["macos-local", "local-program-window", "desktop-screen"]',
    replace: '["macos-local"]',
  },
  {
    name: "map workbench local-program confusion mutation",
    file: "src/map-plugins/builtins/macos-local-program-open-smoke.meta.map-package.json",
    search: '"childCapabilityId": "open-local-program",',
    replace: '"childCapabilityId": "open-local-workbench", "targetKind": "local-program",',
  },
  {
    name: "debug-loop direct local app launch mutation",
    file: "scripts/debug-loop/run-debug-loop.mjs",
    search: "import",
    replace: "const shellCommand = 'open -a iPhone Mirroring';\nvoid shellCommand;\nimport",
  },
];

const OWNER_BINDING_MUTATION_NAMES = [
  "manual-first-enforcement mutation",
  "warning-only-p0 mutation",
  "external private-leak mutation",
] as const;

const MUTATION_LAW_COVERAGE: Record<string, {
  coveredLawIds: string[];
  coverageReasonByLawId: Record<string, string>;
}> = {
  "external private-leak mutation": {
    coveredLawIds: [config.LAW_PUBLIC_CONTRACT],
    coverageReasonByLawId: {
      [config.LAW_PUBLIC_CONTRACT]: "The mutation lets external runtime code import a private Open executor surface, proving governed open behavior must remain owned by the Open Ability Group public contract.",
    },
  },
  "forbidden import mutation": {
    coveredLawIds: [config.LAW_BOUNDARY],
    coverageReasonByLawId: {
      [config.LAW_BOUNDARY]: "The mutation imports screenshot capability types into Open runtime, proving Open boundary must stay pure and must not own screenshot, AI, or action truth.",
    },
  },
  "request chain mutation": {
    coveredLawIds: [config.LAW_INPUT_CHAIN],
    coverageReasonByLawId: {
      [config.LAW_INPUT_CHAIN]: "The mutation removes required step chain data from Open schema, proving every Open request must preserve the governed mission/map/step chain.",
    },
  },
  "timeout abort mutation": {
    coveredLawIds: [config.LAW_RUNTIME_GOVERNANCE],
    coverageReasonByLawId: {
      [config.LAW_RUNTIME_GOVERNANCE]: "The mutation bypasses abort handling in navigation runner support, proving Open runtime governance must enforce timeout and cancellation behavior.",
    },
  },
  "success handoff mutation": {
    coveredLawIds: [config.LAW_PAGE_STATE_HANDOFF],
    coverageReasonByLawId: {
      [config.LAW_PAGE_STATE_HANDOFF]: "The mutation drops page-state handoff ref construction from Open success results, proving Open success cannot exist without governed page-state handoff.",
    },
  },
  "proof chain mutation": {
    coveredLawIds: [config.LAW_RESULT_PROOF],
    coverageReasonByLawId: {
      [config.LAW_RESULT_PROOF]: "The mutation removes capabilityCallId from Open runtime proof construction, proving Open result and proof must preserve real chain and browser-session truth.",
    },
  },
  "export star mutation": {
    coveredLawIds: [config.LAW_PACKAGE_SHAPE],
    coverageReasonByLawId: {
      [config.LAW_PACKAGE_SHAPE]: "The mutation reintroduces export-star on the Open package root, proving package shape must stay canonical and explicit.",
    },
  },
  "warning-only-p0 mutation": {
    coveredLawIds: [config.LAW_ENFORCEMENT],
    coverageReasonByLawId: {
      [config.LAW_ENFORCEMENT]: "The mutation downgrades Open active law severity from P0 to warning-only, proving enforcement must remain machine-blocking and negative-proof backed.",
    },
  },
  "remove macos-local platform mutation": {
    coveredLawIds: [config.LAW_LOCAL_PROGRAM],
    coverageReasonByLawId: {
      [config.LAW_LOCAL_PROGRAM]: "The mutation removes the macOS local-program platform from Open target profile support, proving the governed local-program path must remain present and complete.",
    },
  },
};

async function runInspector(skipBuild = false): Promise<{ passed: boolean; violationCount: number; output: string }> {
  if (!skipBuild) {
    await buildAuditArtifacts();
  }
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const inspector = await loadInspector(INSPECTOR_ENTRY);
  const previousSkip = process.env[SKIP_NEGATIVE_PROOF_ENV];
  process.env[SKIP_NEGATIVE_PROOF_ENV] = "1";
  let result;
  try {
    result = await inspector(context);
  } finally {
    if (previousSkip === undefined) {
      delete process.env[SKIP_NEGATIVE_PROOF_ENV];
    } else {
      process.env[SKIP_NEGATIVE_PROOF_ENV] = previousSkip;
    }
  }
  return {
    passed: result.passed,
    violationCount: result.violationCount,
    output: [
      `passed: ${result.passed}`,
      `violationCount: ${result.violationCount}`,
      "",
      ...result.findings.map((finding) => `${finding.severity.toUpperCase()} ${finding.lawId ?? "no-law"} ${finding.file}:${finding.line} ${finding.message}`),
      "",
    ].join("\n"),
  };
}

async function mutateAndVerify(mutation: Mutation): Promise<MutationProofRecord> {
  const filePath = pathFromRepoRoot(mutation.file);
  const state = await readAuditFileState(filePath);
  const startedAt = new Date().toISOString();
  await applyAuditMutation(filePath, state.original, mutation);
  const mutatedContent = state.mode === "missing"
    ? mutation.replace
    : state.original.replace(mutation.search, mutation.replace);
  let failOutput = "";

  try {
    const result = await runInspector(mutation.skipBuild ?? false);
    failOutput = result.output;
    if (result.passed || result.violationCount === 0) {
      throw new Error(`Inspector did not fail for ${mutation.name}`);
    }
  } finally {
    await restoreAuditFileState(filePath, state);
  }

  const restored = await runInspector(mutation.skipBuild ?? false);
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

async function writeMutationProof(record: MutationProofRecord): Promise<void> {
  const coverage = MUTATION_LAW_COVERAGE[record.mutation.name];
  if (!coverage) {
    return;
  }

  await writeProductionMutationProof({
    owner: "open",
    ownerTitle: "Open",
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
}

async function writeOwnerBindingBundle(records: MutationProofRecord[]): Promise<void> {
  const scenarios = OWNER_BINDING_MUTATION_NAMES.flatMap((mutationName) => {
    const record = records.find((candidate) => candidate.mutation.name === mutationName);
    return record
      ? [{
        scenario: mutationName.replace(/-/g, " "),
        outputFileName: `${mutationName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}-fail.txt`,
        output: record.failOutput,
      }]
      : [];
  });

  await writeOwnerBindingProof({
    owner: "open",
    title: "Open",
    scenarios,
    rollbackOutput: records.at(-1)?.passOutput ?? "rollback restored baseline PASS",
  });
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
      createFinding({ lawId: config.LAW_ENFORCEMENT, file: INSPECTOR_ENTRY, line: 1, severity: "fatal", message }),
    ],
    phase: createPhase("negative-proof-harness", "FAKE ENFORCEMENT", false, summary),
  };
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    const baseline = await runInspector();
    if (!baseline.passed) {
      throw new Error("Baseline open-capability inspector must pass before negative proof.");
    }

    const records: MutationProofRecord[] = [];
    for (const mutation of MUTATIONS) {
      const record = await mutateAndVerify(mutation);
      records.push(record);
      await writeMutationProof(record);
    }

    await writeOwnerBindingBundle(records);

    return createPassResult("Open negative-proof harness rejects enforcement drift, open ownership leaks, forbidden imports, chain loss, runtime governance escape, missing page-state handoff, package-shape drift, and local-program regressions.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Open negative-proof harness failed.",
      "Open negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}

async function main(): Promise<void> {
  const result = await runNegativeProofHarness();
  if (!result.phase.passed) {
    throw new Error(result.findings[0]?.message ?? "Open negative-proof harness failed.");
  }
}

void main();
