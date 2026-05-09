import { createFinding, createPhase } from "../../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { generatedArtifactPaths } from "../../../core/generated-artifact-paths.js";
import { CI_FULL_CHECK_OWNERS, CI_FULL_SUMMARY_CONSUMER, CI_FULL_LAYER_ORDER } from "../../../core/ci-full-check-ownership.js";
import { buildCiFullCommand, readCiFullSummary } from "../../../core/ci-full-summary.js";

const LAW_ID = "GRASSEYE-AUDIT-SYSTEM-003-V1";
const CLOSURE_MODE_ENV = "GRASSEYE_CI_FULL_CLOSURE";
const RUN_ID_ENV = "GRASSEYE_CI_FULL_RUN_ID";

const VALID_CONSUMERS = new Set([...CI_FULL_CHECK_OWNERS.map((owner) => owner.checkId), CI_FULL_SUMMARY_CONSUMER]);

const getExpectedRunId = (): string | undefined => process.env[RUN_ID_ENV]?.trim();

const createOwnershipFinding = (message: string): Finding =>
  createFinding({
    lawId: LAW_ID,
    file: generatedArtifactPaths.ciFullSummary,
    line: 1,
    severity: "fatal",
    message,
  });

const hasUniqueValues = (values: string[]): boolean => new Set(values).size === values.length;

const isSymbolicConsumerName = (value: string): boolean => /^[a-z0-9-]+$/.test(value);

const validateMatrixShape = (): Finding[] => {
  const findings: Finding[] = [];
  const checkIds = CI_FULL_CHECK_OWNERS.map((owner) => owner.checkId);
  const producers = CI_FULL_CHECK_OWNERS.map((owner) => owner.producer);

  if (!hasUniqueValues(checkIds)) {
    findings.push(createOwnershipFinding("CI_FULL_CHECK_OWNERS must define a unique checkId for every check."));
  }

  if (!hasUniqueValues(producers)) {
    findings.push(createOwnershipFinding("CI_FULL_CHECK_OWNERS must define a unique producer for every check."));
  }

  for (const owner of CI_FULL_CHECK_OWNERS) {
    if (owner.exclusive !== true) {
      findings.push(createOwnershipFinding(`CI_FULL_CHECK_OWNERS entry ${owner.checkId} must be exclusive=true.`));
    }

    if (owner.allowedConsumers.length === 0) {
      findings.push(createOwnershipFinding(`CI_FULL_CHECK_OWNERS entry ${owner.checkId} must declare at least one allowed consumer.`));
    }

    if (!hasUniqueValues(owner.allowedConsumers)) {
      findings.push(createOwnershipFinding(`CI_FULL_CHECK_OWNERS entry ${owner.checkId} must not repeat allowed consumers.`));
    }

    if (!CI_FULL_LAYER_ORDER.includes(owner.layer)) {
      findings.push(createOwnershipFinding(`CI_FULL_CHECK_OWNERS entry ${owner.checkId} must use one of the three governed layers.`));
    }

    for (const consumer of owner.allowedConsumers) {
      if (!isSymbolicConsumerName(consumer)) {
        findings.push(createOwnershipFinding(`CI_FULL_CHECK_OWNERS entry ${owner.checkId} has an invalid consumer name ${consumer}.`));
      }

      if (!VALID_CONSUMERS.has(consumer)) {
        findings.push(createOwnershipFinding(`CI_FULL_CHECK_OWNERS entry ${owner.checkId} lists unknown consumer ${consumer}.`));
      }

      if (consumer === owner.producer) {
        findings.push(createOwnershipFinding(`CI_FULL_CHECK_OWNERS entry ${owner.checkId} cannot list its own producer as a consumer.`));
      }
    }
  }

  return findings;
};

const compareArrayValues = (left: unknown, right: readonly string[]): boolean =>
  Array.isArray(left)
  && left.every((value): value is string => typeof value === "string")
  && left.length === right.length
  && left.every((value, index) => value === right[index]);

const validateSummaryAgainstMatrix = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];
  let summary: Awaited<ReturnType<typeof readCiFullSummary>>;
  const expectedRunId = getExpectedRunId();

  if (process.env[CLOSURE_MODE_ENV] !== "1" || !expectedRunId) {
    return [createOwnershipFinding("ci-full summary closure validation must run with GRASSEYE_CI_FULL_CLOSURE=1 and GRASSEYE_CI_FULL_RUN_ID.")];
  }

  try {
    summary = await readCiFullSummary();
  } catch {
    return [createOwnershipFinding("ci-full summary is required to validate check ownership.")];
  }

  if (summary.runId !== expectedRunId) {
    findings.push(createOwnershipFinding("ci-full summary runId must match the current closure runId."));
  }

  if (summary.layers.length !== CI_FULL_LAYER_ORDER.length) {
    findings.push(createOwnershipFinding("ci-full summary must contain exactly the three governed layers."));
  }

  CI_FULL_LAYER_ORDER.forEach((layerLabel, layerIndex) => {
    const layer = summary.layers[layerIndex];
    if (!layer) {
      findings.push(createOwnershipFinding(`ci-full summary is missing the ${layerLabel} layer.`));
      return;
    }

    if (layer.label !== layerLabel) {
      findings.push(createOwnershipFinding("ci-full summary layer order must match the governed matrix order."));
    }

    if (layer.runId !== summary.runId) {
      findings.push(createOwnershipFinding(`ci-full summary layer ${layerLabel} must retain the summary runId.`));
    }

    const expectedOwners = CI_FULL_CHECK_OWNERS.filter((owner) => owner.layer === layerLabel);

    if (layer.steps.length !== expectedOwners.length) {
      findings.push(createOwnershipFinding(`ci-full summary layer ${layerLabel} must contain exactly the matrix-defined steps.`));
      return;
    }

    layer.steps.forEach((step, index) => {
      const ownership = expectedOwners[index];
      if (!ownership) {
        findings.push(createOwnershipFinding(`ci-full summary layer ${layerLabel} contains an unexpected step at position ${index + 1}.`));
        return;
      }

      if (step.checkId !== ownership.checkId) {
        findings.push(createOwnershipFinding(`ci-full summary step order for ${layerLabel} must match CI_FULL_CHECK_OWNERS.`));
      }

      if (step.layer !== ownership.layer) {
        findings.push(createOwnershipFinding(`ci-full summary step ${step.checkId} must retain its matrix layer.`));
      }

      if (step.runId !== summary.runId) {
        findings.push(createOwnershipFinding(`ci-full summary step ${step.checkId} must retain the summary runId.`));
      }

      if (step.command !== buildCiFullCommand(ownership.args)) {
        findings.push(createOwnershipFinding(`ci-full summary step ${step.checkId} must record the matrix command.`));
      }

      if (step.producer !== ownership.producer) {
        findings.push(createOwnershipFinding(`ci-full summary step ${step.checkId} must record the matrix producer.`));
      }

      if (!compareArrayValues(step.allowedConsumers, ownership.allowedConsumers)) {
        findings.push(createOwnershipFinding(`ci-full summary step ${step.checkId} must record the matrix allowed consumers.`));
      }

      if (step.exclusive !== ownership.exclusive) {
        findings.push(createOwnershipFinding(`ci-full summary step ${step.checkId} must retain exclusive=true.`));
      }

      if (!compareArrayValues(step.artifactPaths, ownership.artifactPaths)) {
        findings.push(createOwnershipFinding(`ci-full summary step ${step.checkId} must record the matrix artifact paths.`));
      }
    });
  });

  return findings;
};

const createCheckOwnershipPhase = (findings: Finding[]): InspectorPhase =>
  createPhase(
    "ci-full-check-ownership",
    findings.length === 0 ? "PASS" : "OWNERSHIP GAP",
    findings.length === 0,
    findings.length === 0
      ? "CI_FULL_CHECK_OWNERS is unique, exclusive, and matches the structured ci-full summary evidence."
      : "CI_FULL_CHECK_OWNERS or the ci-full summary drifted from the governed ownership matrix.",
  );

export const validateCheckOwnership = async (
  _context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const findings = [
    ...validateMatrixShape(),
    ...await validateSummaryAgainstMatrix(),
  ];

  return {
    findings,
    phases: [createCheckOwnershipPhase(findings)],
  };
};