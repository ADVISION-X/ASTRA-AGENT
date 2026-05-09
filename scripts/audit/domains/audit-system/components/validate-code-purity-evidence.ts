import { createFinding, createPhase } from "../../../core/result.js";
import { fileExists, readJsonFile } from "../../../core/filesystem.js";
import { pathFromRepoRoot } from "../../../core/paths.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";

const LAW_ID = "GRASSEYE-AUDIT-SYSTEM-001-V1";
const CODE_PURITY_REPORT_PATH = "scripts/audit/generated/code-purity-report.generated.json";

type CodePurityReport = {
  generatedAt?: string;
};

const createEvidenceFinding = (message: string): Finding =>
  createFinding({
    lawId: LAW_ID,
    file: CODE_PURITY_REPORT_PATH,
    line: 1,
    severity: "fatal",
    message,
  });

const validateReportShape = (report: CodePurityReport): Finding[] => typeof report.generatedAt === "string" && report.generatedAt.trim().length > 0
  ? []
  : [createEvidenceFinding("Code-purity report evidence must include a generatedAt timestamp.")];

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
    findings.length === 0 ? "PASS" : "ENFORCEMENT GAP",
    findings.length === 0,
    findings.length === 0
      ? "Audit-system consumes the generated code-purity report instead of re-running code-purity."
      : "Audit-system could not find the generated code-purity report evidence.",
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
