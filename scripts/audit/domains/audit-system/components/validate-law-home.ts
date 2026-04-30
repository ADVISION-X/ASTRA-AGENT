import { createFinding, createPhase } from "../../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";

const collectSingleLawMetadataFindings = (
  law: InspectorContext["lawRegistry"]["laws"][number],
  seenLawIds: Set<string>,
): Finding[] => {
  const findings: Finding[] = [];

  if (seenLawIds.has(law.lawId)) {
    findings.push(
      createFinding({
        lawId: law.lawId,
        file: law.relativeFilePath,
        line: law.line,
        severity: "fatal",
        message: "Duplicate active lawId found in generated law registry.",
      }),
    );
  }

  seenLawIds.add(law.lawId);

  if (!law.lawId.startsWith("GRASSEYE-")) {
    findings.push(
      createFinding({
        lawId: law.lawId,
        file: law.relativeFilePath,
        line: law.line,
        severity: "error",
        message: "lawId must start with GRASSEYE-.",
      }),
    );
  }

  if (!law.capabilityDomain || !law.tier || !law.enforcementMode || !law.evidenceMode || !law.summary) {
    findings.push(
      createFinding({
        lawId: law.lawId,
        file: law.relativeFilePath,
        line: law.line,
        severity: "error",
        message: "Active law metadata is incomplete in generated registry.",
      }),
    );
  }

  return findings;
};

const collectLawMetadataFindings = (
  context: InspectorContext,
  seenLawIds: Set<string>,
): Finding[] => {
  const findings: Finding[] = [];

  for (const law of context.lawRegistry.laws) {
    findings.push(...collectSingleLawMetadataFindings(law, seenLawIds));
  }

  return findings;
};

const createLawHomePhase = (findings: Finding[]): InspectorPhase =>
  createPhase(
    "law-home",
    findings.length === 0 ? "PASS" : "LAW GAP",
    findings.length === 0,
    findings.length === 0
      ? "Active law home is parseable and metadata-complete."
      : "Active law home has parse or metadata defects.",
  );

export const validateLawHome = async (
  context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const seenLawIds = new Set<string>();
  const findings = collectLawMetadataFindings(context, seenLawIds);
  return { findings, phases: [createLawHomePhase(findings)] };
};