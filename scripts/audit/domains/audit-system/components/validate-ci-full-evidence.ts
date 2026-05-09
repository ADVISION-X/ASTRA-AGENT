import { createFinding, createPhase } from "../../../core/result.js";
import { fileExists } from "../../../core/filesystem.js";
import { generatedArtifactPaths } from "../../../core/generated-artifact-paths.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { CI_FULL_LAYER_ORDER } from "../../../core/ci-full-check-ownership.js";
import { getCiFullLayerStatus, readCiFullSummary, type CiFullSummary } from "../../../core/ci-full-summary.js";

const LAW_ID = "GRASSEYE-AUDIT-SYSTEM-002-V1";

type CiFullStepSummary = CiFullSummary["layers"][number]["steps"][number];

const createSummaryFinding = (message: string): Finding =>
  createFinding({
    lawId: LAW_ID,
    file: generatedArtifactPaths.ciFullSummary,
    line: 1,
    severity: "fatal",
    message,
  });

const isValidStatus = (value: string): value is CiFullStepSummary["status"] =>
  value === "PASS" || value === "FAIL" || value === "SKIPPED";

const validateStepShape = (step: CiFullStepSummary): Finding[] => {
  const findings: Finding[] = [];

  if (typeof step.checkId !== "string" || step.checkId.trim().length === 0) {
    findings.push(createSummaryFinding("ci-full summary step must include a checkId."));
  }

  if (typeof step.layer !== "string" || step.layer.trim().length === 0) {
    findings.push(createSummaryFinding("ci-full summary step must include a layer label."));
  }

  if (typeof step.command !== "string" || step.command.trim().length === 0) {
    findings.push(createSummaryFinding("ci-full summary step must include a command string."));
  }

  if (typeof step.producer !== "string" || step.producer.trim().length === 0) {
    findings.push(createSummaryFinding("ci-full summary step must include a producer."));
  }

  if (!Array.isArray(step.allowedConsumers) || !step.allowedConsumers.every((value) => typeof value === "string")) {
    findings.push(createSummaryFinding("ci-full summary step must include allowedConsumers as an array."));
  }

  if (step.exclusive !== true) {
    findings.push(createSummaryFinding("ci-full summary step must mark exclusive=true."));
  }

  if (!isValidStatus(step.status)) {
    findings.push(createSummaryFinding("ci-full summary step has an invalid status."));
  }

  if (typeof step.exitCode !== "number" && step.exitCode !== null) {
    findings.push(createSummaryFinding("ci-full summary step exitCode must be a number or null."));
  }

  if (!Number.isFinite(step.durationMs) || step.durationMs < 0) {
    findings.push(createSummaryFinding("ci-full summary step durationMs must be a non-negative finite number."));
  }

  if (!Number.isFinite(step.memoryPeakMb) || step.memoryPeakMb < 0) {
    findings.push(createSummaryFinding("ci-full summary step memoryPeakMb must be a non-negative finite number."));
  }

  if (!Array.isArray(step.artifactPaths) || !step.artifactPaths.every((value) => typeof value === "string")) {
    findings.push(createSummaryFinding("ci-full summary step artifactPaths must be an array."));
  }

  return findings;
};

const validateLayerShape = (summary: CiFullSummary): Finding[] => {
  const findings: Finding[] = [];

  if (typeof summary.generatedAt !== "string" || summary.generatedAt.trim().length === 0) {
    findings.push(createSummaryFinding("ci-full summary must include generatedAt."));
  }

  if (summary.layers.length !== CI_FULL_LAYER_ORDER.length) {
    findings.push(createSummaryFinding("ci-full summary must contain exactly the three governed layers."));
  }

  CI_FULL_LAYER_ORDER.forEach((label, index) => {
    const layer = summary.layers[index];
    if (!layer) {
      findings.push(createSummaryFinding(`ci-full summary is missing layer ${label}.`));
      return;
    }

    if (layer.label !== label) {
      findings.push(createSummaryFinding(`ci-full summary layer order must be foundation-layer, map-layer, then ability-group-layer.`));
    }

    if (layer.status !== "PASS" && layer.status !== "FAIL" && layer.status !== "SKIPPED") {
      findings.push(createSummaryFinding(`ci-full summary layer ${label} has an invalid status.`));
    }

    if (layer.steps.length === 0) {
      findings.push(createSummaryFinding(`ci-full summary layer ${label} must record at least one step.`));
    }

    findings.push(...layer.steps.flatMap(validateStepShape));

    const computedLayerStatus = getCiFullLayerStatus(layer.steps);
    if (layer.status !== computedLayerStatus) {
      findings.push(createSummaryFinding(`ci-full summary layer ${label} status must match its step statuses.`));
    }
  });

  const computedSummaryStatus = summary.layers.every((layer) => layer.status === "PASS") ? "PASS" : "FAIL";
  if (summary.status !== computedSummaryStatus) {
    findings.push(createSummaryFinding("ci-full summary status must match the aggregate layer outcomes."));
  }

  if (summary.status === "PASS" && summary.layers.some((layer) => layer.status !== "PASS")) {
    findings.push(createSummaryFinding("ci-full summary cannot be PASS when any layer is not PASS."));
  }

  return findings;
};

const createCiFullEvidencePhase = (findings: Finding[]): InspectorPhase =>
  createPhase(
    "ci-full-evidence",
    findings.length === 0 ? "PASS" : "EVIDENCE GAP",
    findings.length === 0,
    findings.length === 0
      ? "ci-full summary evidence is present, structured, and layer-complete."
      : "ci-full summary evidence is missing or malformed.",
  );

export const validateCiFullEvidence = async (
  _context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  if (!(await fileExists(generatedArtifactPaths.ciFullSummary))) {
    const findings = [createSummaryFinding("ci-full summary artifact is missing.")];
    return { findings, phases: [createCiFullEvidencePhase(findings)] };
  }

  let summary: CiFullSummary;
  try {
    summary = await readCiFullSummary();
  } catch {
    const findings = [createSummaryFinding("ci-full summary artifact is unreadable or malformed JSON.")];
    return { findings, phases: [createCiFullEvidencePhase(findings)] };
  }

  const findings = validateLayerShape(summary);
  return {
    findings,
    phases: [createCiFullEvidencePhase(findings)],
  };
};