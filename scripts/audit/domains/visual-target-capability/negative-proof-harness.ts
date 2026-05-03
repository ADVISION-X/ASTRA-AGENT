import { spawnSync } from "node:child_process";
import { access, readFile, unlink, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

const INSPECTOR_ENTRY = "scripts/audit/domains/visual-target-capability/inspector.ts";
const RUN_INSPECTOR_ENTRY = "scripts/audit/domains/visual-target-capability/run-inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_VISUAL_TARGET_NEGATIVE_PROOF";

type ReplaceMutation = {
  kind: "replace";
  name: string;
  file: string;
  oldText: string;
  newText: string;
  expectedNeedle: string;
};

type CreateFileMutation = {
  kind: "create-file";
  name: string;
  file: string;
  content: string;
  expectedNeedle: string;
};

type NegativeProofMutation = ReplaceMutation | CreateFileMutation;

const hasErrorCode = (error: unknown, code: string): boolean => typeof error === "object"
  && error !== null
  && "code" in error
  && error.code === code;

const VISUAL_TARGET_NEGATIVE_PROOF_MUTATIONS: NegativeProofMutation[] = [
  {
    kind: "replace",
    name: "manual-first-enforcement-reintroduced",
    file: ".github/instructions/cursor-rules/modules/module-visual-target-capability.instructions.md",
    oldText: "status: active  \ntier: P0  \ncapabilityDomain: visual-target-capability  \nenforcementMode: machine-blocking  \nevidenceMode: law+inspector+negative-proof",
    newText: "status: active  \ntier: P0  \ncapabilityDomain: visual-target-capability  \nenforcementMode: manual-first  \nevidenceMode: law+inspector+negative-proof",
    expectedNeedle: "must remain machine-blocking",
  },
  {
    kind: "replace",
    name: "turn-p0-into-warning-only",
    file: ".github/instructions/cursor-rules/modules/module-visual-target-capability.instructions.md",
    oldText: "status: active  \ntier: P0  \ncapabilityDomain: visual-target-capability  \nenforcementMode: machine-blocking  \nevidenceMode: law+inspector+negative-proof",
    newText: "status: active  \ntier: P1  \ncapabilityDomain: visual-target-capability  \nenforcementMode: machine-blocking  \nevidenceMode: law+inspector+negative-proof",
    expectedNeedle: "must remain P0",
  },
  {
    kind: "replace",
    name: "remove-capabilityCallId-from-input",
    file: "src/capabilities/visual-target/shared/visual-target-governance.ts",
    oldText: "  capabilityCallId: limitedString(200),",
    newText: "  capabilityCallIdRemoved: limitedString(200),",
    expectedNeedle: "VisualTargetAbilityInputSchema is missing capabilityCallId.",
  },
  {
    kind: "replace",
    name: "remove-activationSnapshotRef-from-input",
    file: "src/capabilities/visual-target/shared/visual-target-governance.ts",
    oldText: "  activationSnapshotRef: limitedString(200),",
    newText: "  activationSnapshotRefRemoved: limitedString(200),",
    expectedNeedle: "VisualTargetAbilityInputSchema is missing activationSnapshotRef.",
  },
  {
    kind: "replace",
    name: "remove-nerveBusEnvelopeId-from-input",
    file: "src/capabilities/visual-target/shared/visual-target-governance.ts",
    oldText: "  nerveBusEnvelopeId: limitedString(200),",
    newText: "  nerveBusEnvelopeIdRemoved: limitedString(200),",
    expectedNeedle: "VisualTargetAbilityInputSchema is missing nerveBusEnvelopeId.",
  },
  {
    kind: "replace",
    name: "ai-candidate-without-aiProofRef",
    file: "src/capabilities/visual-target/schema.ts",
    oldText: "  aiProofRef: limitedString(200),",
    newText: "  aiProofRefRemoved: limitedString(200),",
    expectedNeedle: "VisualTargetAiSourceProofSchema is missing aiProofRef.",
  },
  {
    kind: "replace",
    name: "candidate-without-sourceProofRef",
    file: "src/capabilities/visual-target/schema.ts",
    oldText: "  coordinateSpace: VisualTargetCoordinateSpaceSchema,\n  sourceProofRef: limitedString(200),\n  capturedAt: z.string().datetime(),",
    newText: "  coordinateSpace: VisualTargetCoordinateSpaceSchema,\n  sourceProofRefRemoved: limitedString(200),\n  capturedAt: z.string().datetime(),",
    expectedNeedle: "VisualTargetCandidateSchema is missing sourceProofRef.",
  },
  {
    kind: "replace",
    name: "coordinateSpace-ai_input-action-success",
    file: "src/capabilities/visual-target/schema.ts",
    oldText: "  sourcePageStateProofRef: limitedString(200),\n  coordinateSpace: VisualTargetCoordinateSpaceSchema.exclude([\"ai_input\", \"contact_sheet\"]),\n  originalCandidateCoordinateSpace: VisualTargetCoordinateSpaceSchema,",
    newText: "  sourcePageStateProofRef: limitedString(200),\n  coordinateSpace: VisualTargetCoordinateSpaceSchema.exclude([\"contact_sheet\"]),\n  originalCandidateCoordinateSpace: VisualTargetCoordinateSpaceSchema,",
    expectedNeedle: "VisualTargetActionOutputSchema must exclude ai_input from actionable success coordinateSpace.",
  },
  {
    kind: "replace",
    name: "geometryGuardHandoffRequired-false",
    file: "src/capabilities/visual-target/runtime/visual-target-output-boundary-gate.ts",
    oldText: "    geometryGuardHandoffRequired: true,",
    newText: "    geometryGuardHandoffRequired: false,",
    expectedNeedle: "Action output must keep geometryGuardHandoffRequired=true.",
  },
  {
    kind: "replace",
    name: "proof-runId-from-session-child",
    file: "src/capabilities/visual-target/runtime/visual-target-proof-builder.ts",
    oldText: "    ...chain,\n    sessionId: input.trace.sessionId,",
    newText: "    ...chain,\n    runId: buildStableVisualTargetRef(\"visual-target-run\", [input.trace.sessionId, input.trace.childCapabilityId, input.trace.roundId, input.trace.videoVisitId]),\n    sessionId: input.trace.sessionId,",
    expectedNeedle: "Runtime proof must not fabricate runId from local stable refs.",
  },
  {
    kind: "create-file",
    name: "external-import-of-child-implementation",
    file: "src/app/visual-target-private-import-probe.ts",
    content: 'import "../capabilities/visual-target/children/detect-comments-button/implementation.js";\nexport const probe = true;\n',
    expectedNeedle: "External code must not import Visual Target internal surface",
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

function runInspectorProcess(): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    "node",
    ["--import", "tsx", RUN_INSPECTOR_ENTRY],
    {
      cwd: pathFromRepoRoot("."),
      encoding: "utf8",
      env: {
        ...process.env,
        [SKIP_NEGATIVE_PROOF_ENV]: "1",
      },
    },
  );

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function applyMutationOnce(source: string, mutation: ReplaceMutation): string {
  const matchIndex = source.indexOf(mutation.oldText);
  if (matchIndex === -1) {
    throw new Error(`Mutation ${mutation.name} could not find target text in ${mutation.file}`);
  }

  return `${source.slice(0, matchIndex)}${mutation.newText}${source.slice(matchIndex + mutation.oldText.length)}`;
}

async function applyMutation(mutation: NegativeProofMutation): Promise<() => Promise<void>> {
  const absolutePath = pathFromRepoRoot(mutation.file);

  if (mutation.kind === "replace") {
    const originalContent = await readFile(absolutePath, "utf8");
    const mutatedContent = applyMutationOnce(originalContent, mutation);
    await writeFile(absolutePath, mutatedContent, "utf8");
    return async () => {
      await writeFile(absolutePath, originalContent, "utf8");
    };
  }

  let fileExisted = true;
  try {
    await access(absolutePath);
  } catch (error) {
    if (!hasErrorCode(error, "ENOENT")) {
      throw error;
    }
    fileExisted = false;
  }
  if (fileExisted) {
    throw new Error(`Create-file mutation ${mutation.name} expected ${mutation.file} to be absent before mutation.`);
  }

  await writeFile(absolutePath, mutation.content, "utf8");
  return async () => {
    await unlink(absolutePath);
  };
}

async function mutateAndVerify(mutation: NegativeProofMutation): Promise<string> {
  const rollback = await applyMutation(mutation);
  try {
    const failRun = runInspectorProcess();
    const combinedOutput = `${failRun.stdout}\n${failRun.stderr}`;
    if (failRun.status === 0) {
      throw new Error(`Mutation ${mutation.name} did not fail inspector as expected.\n${combinedOutput}`);
    }
    if (!combinedOutput.includes(mutation.expectedNeedle)) {
      throw new Error(`Mutation ${mutation.name} failed, but not for the expected reason. Missing needle: ${mutation.expectedNeedle}`);
    }
  } finally {
    await rollback();
  }

  const rollbackRun = runInspectorProcess();
  if (rollbackRun.status !== 0) {
    throw new Error(`Mutation ${mutation.name} did not restore inspector PASS after rollback.\n${rollbackRun.stdout}\n${rollbackRun.stderr}`);
  }

  return `${mutation.name}: fail-ok rollback-ok`;
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
        lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-008-V2",
        file: INSPECTOR_ENTRY,
        line: 1,
        severity: "fatal",
        message,
      }),
    ],
    phase: createPhase("negative-proof-harness", "FAKE ENFORCEMENT", false, summary),
  };
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    const baseline = runInspectorProcess();
    if (baseline.status !== 0) {
      return createFatalResult(
        "Visual Target inspector baseline must pass before negative-proof mutation checks.",
        "Visual Target negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    const reports: string[] = [];
    for (const mutation of VISUAL_TARGET_NEGATIVE_PROOF_MUTATIONS) {
      reports.push(await mutateAndVerify(mutation));
    }

    return createPassResult(`Visual Target negative-proof harness rejects ${reports.join(", ")}.`);
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Visual Target negative-proof harness failed.",
      "Visual Target negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}

async function main(): Promise<void> {
  const result = await runNegativeProofHarness();
  process.stdout.write(`[VISUAL-TARGET-NEGATIVE-PROOF] ${result.phase.summary}\n`);
  if (!result.phase.passed || result.findings.length > 0) {
    for (const finding of result.findings) {
      process.stdout.write(`- ${finding.message}\n`);
    }
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  void main();
}