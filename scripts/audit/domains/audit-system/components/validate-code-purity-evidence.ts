import { createFinding, createPhase } from "../../../core/result.js";
import { fileExists, readJsonFile } from "../../../core/filesystem.js";
import { pathFromRepoRoot } from "../../../core/paths.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";

const LAW_ID = "GRASSEYE-AUDIT-SYSTEM-001-V1";
const CODE_PURITY_REPORT_PATH = "scripts/audit/generated/code-purity-report.generated.json";

type CodePurityReport = {
  generatedAt?: string;
  touchedBaselineSource?: string;
  scanScope?: string[];
  touchedFiles?: string[];
  remediationQueue?: unknown[];
  firstPhysicalSplitPlan?: unknown[];
};

const createEvidenceFinding = (message: string): Finding =>
  createFinding({
    lawId: LAW_ID,
    file: CODE_PURITY_REPORT_PATH,
    line: 1,
    severity: "fatal",
    message,
  });

const validateReportShape = (report: CodePurityReport): Finding[] => {
  const findings: Finding[] = [];

  if (typeof report.generatedAt !== "string" || report.generatedAt.trim().length === 0) {
    findings.push(createEvidenceFinding("Code-purity report evidence must include a generatedAt timestamp."));
  }

  if (!Array.isArray(report.scanScope) || report.scanScope.length === 0) {
    findings.push(createEvidenceFinding("Code-purity report evidence must include a non-empty scanScope."));
  }

  if (typeof report.touchedBaselineSource !== "string" || report.touchedBaselineSource.trim().length === 0 || report.touchedBaselineSource === "none") {
    findings.push(createEvidenceFinding("Code-purity report evidence must include a real touchedBaselineSource."));
  }

  if (!Array.isArray(report.touchedFiles)) {
    findings.push(createEvidenceFinding("Code-purity report evidence must include touchedFiles as an array."));
  }

  if (!Array.isArray(report.remediationQueue)) {
    findings.push(createEvidenceFinding("Code-purity report evidence must include remediationQueue as an array."));
  }

  if (!Array.isArray(report.firstPhysicalSplitPlan)) {
    findings.push(createEvidenceFinding("Code-purity report evidence must include firstPhysicalSplitPlan as an array."));
  }

  return findings;
};

const collectCodePurityEvidenceFindings = async (): Promise<Finding[]> => {
  const absolutePath = pathFromRepoRoot(CODE_PURITY_REPORT_PATH);
  if (!(await fileExists(absolutePath))) {
    return [createEvidenceFinding("Code-purity report evidence is missing; run the foundation-layer code-purity step first.")];
  }

  let report: CodePurityReport;
  try {
    report = await readJsonFile<CodePurityReport>(absolutePath);
  } catch {
    return [createEvidenceFinding("Code-purity report evidence is unreadable or malformed JSON.")];
  }

  return validateReportShape(report);
};

const createCodePurityEvidencePhase = (findings: Finding[]): InspectorPhase =>
  createPhase(
    "code-purity-evidence",
    findings.length === 0 ? "PASS" : "EVIDENCE GAP",
    findings.length === 0,
    findings.length === 0
      ? "Audit-system consumes the generated code-purity report instead of re-running code-purity."
      : "Audit-system could not verify the generated code-purity report evidence.",
  );

export const validateCodePurityEvidence = async (
  _context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const findings = await collectCodePurityEvidenceFindings();
  return {
    findings,
    phases: [createCodePurityEvidencePhase(findings)],
  };
};