import { readFile } from "node:fs/promises";

import { pathFromRepoRoot } from "../../core/paths.js";
import type { InspectorContext, InspectorResult } from "../../core/schema.js";
import { createPhase, finalizeInspectorResult } from "../../core/result.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";

import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runGeometryGuardChecks } from "./run-geometry-guard-checks.js";

const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_GEOMETRY_GUARD_NEGATIVE_PROOF";
const LAW_FILE = ".github/instructions/cursor-rules/modules/module-geometry-guard-capability.instructions.md";

const runLawBaselineCheck = async () => {
  const content = await readFile(pathFromRepoRoot(LAW_FILE), "utf8");
  const findings = [];

  if (content.includes("enforcementMode: manual-first")) {
    findings.push({
      lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-008-V3",
      file: LAW_FILE,
      line: 1,
      severity: "fatal" as const,
      message: "Geometry Guard active laws must remain machine-blocking.",
    });
  }
  if (content.includes("tier: P1")) {
    findings.push({
      lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-008-V3",
      file: LAW_FILE,
      line: 1,
      severity: "fatal" as const,
      message: "Geometry Guard active laws must remain P0.",
    });
  }
  if (content.includes("evidenceMode: law\n") || content.includes("evidenceMode: law\r\n")) {
    findings.push({
      lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-008-V3",
      file: LAW_FILE,
      line: 1,
      severity: "fatal" as const,
      message: "Geometry Guard active laws must keep law+inspector+negative-proof evidence mode.",
    });
  }

  return {
    findings,
    phase: createPhase(
      "law-baseline",
      findings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
      findings.length === 0,
      findings.length === 0
        ? "Geometry Guard active laws remain machine-blocking, P0, and negative-proof backed."
        : "Geometry Guard law baseline drifted away from the active enforcement contract.",
    ),
  };
};

const createSkippedNegativeProofResult = () => ({
  findings: [],
  phase: createPhase(
    "negative-proof-harness",
    "PASS",
    true,
    "Geometry Guard negative-proof harness was skipped for nested inspector execution.",
  ),
});

const runNegativeProofCheck = async () => process.env[SKIP_NEGATIVE_PROOF_ENV] === "1"
  ? createSkippedNegativeProofResult()
  : runNegativeProofHarness();

const buildInspectorResult = (
  base: Awaited<ReturnType<typeof runDomainOwnerInspection>>,
  lawBaseline: Awaited<ReturnType<typeof runLawBaselineCheck>>,
  checks: Awaited<ReturnType<typeof runGeometryGuardChecks>>,
  negativeProof: Awaited<ReturnType<typeof runNegativeProofCheck>>,
): Omit<InspectorResult, "passed" | "classification" | "violationCount"> => {
  const findings = [
    ...base.findings,
    ...lawBaseline.findings,
    ...checks.findings,
    ...negativeProof.findings,
  ];

  return {
    inspector: "GrassEye Geometry Guard Capability Owner Inspector",
    inspectorId: "geometry-guard-capability-owner",
    capabilityDomain: "geometry-guard-capability",
    findings,
    phases: [
      ...base.phases,
      lawBaseline.phase,
      ...checks.phases,
      negativeProof.phase,
    ],
    summary: findings.length === 0
      ? "geometry-guard-capability owner inspector passed owner-foundation, required-shape, forbidden-shape, boundary, anti-escape, and negative-proof phases"
      : "geometry-guard-capability owner inspector found chain, boundary, or enforcement violations",
  };
};

export async function inspectGeometryGuardCapability(context: InspectorContext): Promise<InspectorResult> {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: "geometry-guard-capability",
    inspectorId: "geometry-guard-capability-owner",
    inspectorEntry: "scripts/audit/domains/geometry-guard-capability/inspector.ts",
  });
  const lawBaseline = await runLawBaselineCheck();
  const checks = await runGeometryGuardChecks();
  const negativeProof = await runNegativeProofCheck();
  return finalizeInspectorResult(buildInspectorResult(base, lawBaseline, checks, negativeProof));
}

export const geometryGuardCapabilityInspector = inspectGeometryGuardCapability;