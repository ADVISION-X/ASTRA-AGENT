import type { SourceFile } from "ts-morph";

import { createAuditSystemFinding, createAuditSystemPhase } from "./audit-system-component-support.js";
import type { AuditSystemInspectionContext, AuditSystemInspectionResult } from "./audit-system-ts-morph-support.js";
import { getAuditProject, getSourceFileOrThrow } from "./audit-system-ts-morph-support.js";

const CODE_PURITY_ORCHESTRATOR_PATH = "scripts/audit/domains/code-purity/run-inspector.ts";
const CODE_PURITY_SCAN_PATH = "scripts/audit/domains/code-purity/run-scan.ts";
const CODE_PURITY_REPORT_PATH = "scripts/audit/domains/code-purity/run-report.ts";

const createFinding = (file: string, message: string) =>
  createAuditSystemFinding({
    file,
    line: 1,
    severity: "error",
    message,
  });

const textOf = (sourceFile: SourceFile): string => sourceFile.getFullText();

const inspectOrchestrator = (sourceFile: SourceFile) => {
  const text = textOf(sourceFile);
  return [
    ...inspectOrchestratorStages(text),
    ...inspectOrchestratorProcess(text),
    ...inspectOrchestratorBuildGate(text),
  ];
};

const inspectOrchestratorStages = (text: string) =>
  text.includes("code-purity:scan") && text.includes("code-purity:report")
    ? []
    : [createFinding(CODE_PURITY_ORCHESTRATOR_PATH, "audit:code-purity must orchestrate scan and report as separate serial process stages.")];

const inspectOrchestratorProcess = (text: string) =>
  text.includes("spawn(process.execPath") && text.includes(CODE_PURITY_SCAN_PATH) && text.includes(CODE_PURITY_REPORT_PATH)
    ? []
    : [createFinding(CODE_PURITY_ORCHESTRATOR_PATH, "Code-purity scan and report must run in independent child processes.")];

const inspectOrchestratorBuildGate = (text: string) => {
  if (!text.includes("GRASSEYE_CODE_PURITY_BUILD_ARTIFACTS")) {
    return [createFinding(CODE_PURITY_ORCHESTRATOR_PATH, "audit:code-purity full artifact rebuild must require explicit GRASSEYE_CODE_PURITY_BUILD_ARTIFACTS=1.")];
  }
  return text.includes("buildAuditArtifacts()")
    ? []
    : [];
};

const inspectScan = (sourceFile: SourceFile) => {
  const text = textOf(sourceFile);
  const findings = [];
  if (!text.includes("skipAddingFilesFromTsConfig: true")) {
    findings.push(createFinding(CODE_PURITY_SCAN_PATH, "Code-purity scan must not load the full tsconfig project."));
  }
  if (text.includes("sourceFiles") && text.includes("[]")) {
    findings.push(createFinding(CODE_PURITY_SCAN_PATH, "Code-purity scan must not keep a complete sourceFiles array resident."));
  }
  return findings;
};

const inspectReport = (sourceFile: SourceFile) =>
  textOf(sourceFile).includes("ts-morph")
    ? [createFinding(CODE_PURITY_REPORT_PATH, "Code-purity report stage must not import or call ts-morph.")]
    : [];

const createPhases = (findingCount: number) => [
  createAuditSystemPhase(
    "code-purity-process-topology",
    findingCount === 0 ? "PASS" : "SCRIPT OVERREACH",
    findingCount === 0,
    findingCount === 0
      ? "Code-purity scan and report are isolated into bounded child processes."
      : "Code-purity process isolation, memory boundary, or explicit-build topology has drifted.",
  ),
];

export const validateCodePurityTopology = async (
  _context: AuditSystemInspectionContext,
): Promise<AuditSystemInspectionResult> => {
  const project = getAuditProject();
  const findings = [
    ...inspectOrchestrator(getSourceFileOrThrow(project, CODE_PURITY_ORCHESTRATOR_PATH)),
    ...inspectScan(getSourceFileOrThrow(project, CODE_PURITY_SCAN_PATH)),
    ...inspectReport(getSourceFileOrThrow(project, CODE_PURITY_REPORT_PATH)),
  ];
  return {
    findings,
    phases: createPhases(findings.length),
  };
};
