import { readFile, writeFile } from "node:fs/promises";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { createInspectorContext, loadGeneratedArtifacts } from "../../core/runtime.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";
import { runGeometryGuardChecks } from "./run-geometry-guard-checks.js";

const INSPECTOR_ENTRY = "scripts/audit/domains/geometry-guard-capability/inspector.ts";
const LAW_FILE = ".github/instructions/cursor-rules/modules/module-geometry-guard-capability.instructions.md";

type ReplaceMutation = {
  kind: "replace";
  name: string;
  file: string;
  oldText: string;
  newText: string;
};

type NegativeProofMutation = ReplaceMutation;

const MUTATIONS: NegativeProofMutation[] = [
  {
    kind: "replace",
    name: "manual-first-enforcement-reintroduced",
    file: ".github/instructions/cursor-rules/modules/module-geometry-guard-capability.instructions.md",
    oldText: "status: active  \ntier: P0  \ncapabilityDomain: geometry-guard-capability  \nenforcementMode: machine-blocking  \nevidenceMode: law+inspector+negative-proof",
    newText: "status: active  \ntier: P0  \ncapabilityDomain: geometry-guard-capability  \nenforcementMode: manual-first  \nevidenceMode: law+inspector+negative-proof",
  },
  {
    kind: "replace",
    name: "turn-p0-into-warning-only",
    file: ".github/instructions/cursor-rules/modules/module-geometry-guard-capability.instructions.md",
    oldText: "status: active  \ntier: P0  \ncapabilityDomain: geometry-guard-capability  \nenforcementMode: machine-blocking  \nevidenceMode: law+inspector+negative-proof",
    newText: "status: active  \ntier: P1  \ncapabilityDomain: geometry-guard-capability  \nenforcementMode: machine-blocking  \nevidenceMode: law+inspector+negative-proof",
  },
  {
    kind: "replace",
    name: "remove-capabilityCallId-from-input",
    file: "src/capabilities/geometry-guard/schema-input.ts",
    oldText: "  capabilityCallId: nullableString,",
    newText: "  capabilityCallIdRemoved: nullableString,",
  },
  {
    kind: "replace",
    name: "remove-activationSnapshotRef-from-input",
    file: "src/capabilities/geometry-guard/schema-input.ts",
    oldText: "  activationSnapshotRef: nullableString,",
    newText: "  activationSnapshotRefRemoved: nullableString,",
  },
  {
    kind: "replace",
    name: "remove-nerveBusEnvelopeId-from-input",
    file: "src/capabilities/geometry-guard/schema-input.ts",
    oldText: "  nerveBusEnvelopeId: nullableString,",
    newText: "  nerveBusEnvelopeIdRemoved: nullableString,",
  },
  {
    kind: "replace",
    name: "silent-clamp-introduced",
    file: "src/capabilities/geometry-guard/shared/geometry-transform.ts",
    oldText: "    width: roundValue(bbox.width, policy),",
    newText: "    width: Math.max(1, roundValue(bbox.width, policy)),",
  },
  {
    kind: "replace",
    name: "proof-runId-from-session-child",
    file: "src/capabilities/geometry-guard/runtime/geometry-proof-builder.ts",
    oldText: "    runId: input.request.runId,",
    newText: "    runId: buildStableGeometryRef([input.request.sessionId, input.request.childCapabilityId, input.request.roundId, input.request.videoVisitId]),",
  },
  {
    kind: "replace",
    name: "allow-without-outputRef",
    file: "src/capabilities/geometry-guard/runtime/geometry-result-builder.ts",
    oldText: "    outputRef: allowSuccess ? buildStableGeometryRef([geometryGuardRef, \"output\", input.request.idempotencyKey]) : null,",
    newText: "    outputRef: null,",
  },
  {
    kind: "replace",
    name: "failed-with-output",
    file: "src/capabilities/geometry-guard/runtime/geometry-result-builder.ts",
    oldText: "    output: decisionState.allowSuccess ? input.output : null,",
    newText: "    output: input.output,",
  },
  {
    kind: "replace",
    name: "child-imports-browser-controller",
    file: "src/capabilities/geometry-guard/children/validate-click-point/implementation.ts",
    oldText: "import { createGeometryGuardChildCapability } from \"../../runtime/geometry-child-capability.js\";",
    newText: "import { BrowserController } from \"../../../lib/browser/browser-controller.js\";\nimport { createGeometryGuardChildCapability } from \"../../runtime/geometry-child-capability.js\";",
  },
  {
    kind: "replace",
    name: "child-returns-boolean",
    file: "src/capabilities/geometry-guard/children/validate-click-point/implementation.ts",
    oldText: "  return createGeometryGuardChildCapability(\"validate-click-point\");",
    newText: "  return true;",
  },
];

async function collectLawBaselineFindings(): Promise<Finding[]> {
  const content = await readFile(pathFromRepoRoot(LAW_FILE), "utf8");
  const findings: Finding[] = [];

  if (content.includes("enforcementMode: manual-first")) {
    findings.push({
      lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-008-V3",
      file: LAW_FILE,
      line: 1,
      severity: "fatal",
      message: "Geometry Guard active laws must remain machine-blocking.",
    });
  }
  if (content.includes("tier: P1")) {
    findings.push({
      lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-008-V3",
      file: LAW_FILE,
      line: 1,
      severity: "fatal",
      message: "Geometry Guard active laws must remain P0.",
    });
  }
  if (content.includes("evidenceMode: law\n") || content.includes("evidenceMode: law\r\n")) {
    findings.push({
      lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-008-V3",
      file: LAW_FILE,
      line: 1,
      severity: "fatal",
      message: "Geometry Guard active laws must keep law+inspector+negative-proof evidence mode.",
    });
  }

  return findings;
}

async function runInspector(): Promise<{ passed: boolean; violationCount: number }> {
  await buildAuditArtifacts();
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "geometry-guard-capability",
    inspectorId: "geometry-guard-capability-owner",
    inspectorEntry: INSPECTOR_ENTRY,
  });
  const lawBaselineFindings = await collectLawBaselineFindings();
  const checks = await runGeometryGuardChecks();
  const findings = [...base.findings, ...lawBaselineFindings, ...checks.findings];

  return {
    passed: findings.length === 0,
    violationCount: findings.length,
  };
}

function applyReplaceMutation(source: string, mutation: ReplaceMutation): string {
  const matchIndex = source.indexOf(mutation.oldText);
  if (matchIndex === -1) {
    throw new Error(`Mutation ${mutation.name} could not find target text in ${mutation.file}`);
  }

  return `${source.slice(0, matchIndex)}${mutation.newText}${source.slice(matchIndex + mutation.oldText.length)}`;
}

async function applyMutation(mutation: NegativeProofMutation): Promise<() => Promise<void>> {
  const absolutePath = pathFromRepoRoot(mutation.file);
  const originalContent = await readFile(absolutePath, "utf8");
  const mutatedContent = applyReplaceMutation(originalContent, mutation);
  await writeFile(absolutePath, mutatedContent, "utf8");
  return async () => {
    await writeFile(absolutePath, originalContent, "utf8");
  };
}

async function mutateAndVerify(mutation: NegativeProofMutation): Promise<void> {
  const rollback = await applyMutation(mutation);
  try {
    const mutated = await runInspector();
    if (mutated.passed || mutated.violationCount === 0) {
      throw new Error(`Inspector did not fail for ${mutation.name}`);
    }
  } finally {
    await rollback();
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
        lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-008-V3",
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
    const baseline = await runInspector();
    if (!baseline.passed) {
      return createFatalResult(
        "Geometry Guard inspector baseline must pass before negative-proof mutation checks.",
        "Geometry Guard negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    for (const mutation of MUTATIONS) {
      await mutateAndVerify(mutation);
    }

    return createPassResult("Geometry Guard negative-proof harness rejects law weakening, input chain drift, silent clamp, fabricated proof chain, output-boundary drift, and child boundary escape mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Geometry Guard negative-proof harness failed.",
      "Geometry Guard negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}