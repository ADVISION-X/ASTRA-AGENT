import type {
  Finding,
  InspectionClassification,
  InspectorPhase,
  InspectorResult,
} from "./schema.js";

export const createFinding = (finding: Finding): Finding => finding;

export const createPhase = (
  name: string,
  classification: InspectionClassification,
  passed: boolean,
  summary: string,
): InspectorPhase => ({
  name,
  classification,
  passed,
  summary,
});

export const resolveClassification = (
  findings: Finding[],
  phases: InspectorPhase[],
): InspectionClassification => {
  const firstNonPass = phases.find((phase) => phase.classification !== "PASS")?.classification;
  const classificationPriority: Record<InspectionClassification, number> = {
    PASS: 0,
    "ENFORCEMENT GAP": 1,
    "ENFORCEMENT MISS": 2,
    "LAW-SCRIPT DRIFT": 3,
    "LAW GAP": 4,
    "CODE VIOLATION": 5,
    "SCRIPT OVERREACH": 6,
    "INVALID ENFORCEMENT": 7,
    "FAKE ENFORCEMENT": 8,
  };

  if (findings.length > 0) {
    const ranked = phases
      .map((phase) => phase.classification)
      .filter((classification) => classification !== "PASS")
      .sort((left, right) => classificationPriority[right] - classificationPriority[left]);
    return ranked[0] ?? firstNonPass ?? "LAW-SCRIPT DRIFT";
  }

  return firstNonPass ?? "PASS";
};

export const finalizeInspectorResult = (input: Omit<InspectorResult, "violationCount" | "passed" | "classification"> & {
  classification?: InspectionClassification;
  passed?: boolean;
}): InspectorResult => {
  const classification = input.classification ?? resolveClassification(input.findings, input.phases);
  const passed = input.passed ?? (classification === "PASS" && input.findings.length === 0);

  return {
    ...input,
    passed,
    classification,
    violationCount: input.findings.length,
  };
};

export const hasBlockingFindings = (findings: Finding[]): boolean =>
  findings.some((finding) => finding.severity === "error" || finding.severity === "fatal");