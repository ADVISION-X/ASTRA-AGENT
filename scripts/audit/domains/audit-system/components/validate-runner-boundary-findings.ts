import { createAuditSystemFinding } from "./audit-system-component-support.js";
import { getSourceFileOrThrow } from "./audit-system-ts-morph-support.js";
import {
  getBuildBeforeLoadViolationLine,
  getManualOwnerListViolationLine,
  getPlanDrivenInspectorViolationLine,
  hasBuildAuditImport,
  hasDefaultNegativeProofPolicyGate,
  hasFailureExitAssignment,
} from "./validate-runner-boundary-checks.js";

type AuditSourceFile = ReturnType<typeof getSourceFileOrThrow>;

type RunnerBoundaryCheck = {
  line: (sourceFile: AuditSourceFile) => number | undefined;
  message: string;
};

const RUNNER_BOUNDARY_CHECKS: readonly RunnerBoundaryCheck[] = [
  {
    line: getBuildBeforeLoadViolationLine,
    message: "Runner must call buildAuditArtifacts before loading generated artifacts.",
  },
  {
    line: getPlanDrivenInspectorViolationLine,
    message: "Runner must execute inspectors from artifacts.auditPlan.owners rather than a manual list.",
  },
  {
    line: getManualOwnerListViolationLine,
    message: "Runner must not keep a manual owner or law list.",
  },
];

export const collectRunnerBoundaryFindings = (sourceFile: AuditSourceFile, relativePath: string) => {
  const findings = [] as ReturnType<typeof createAuditSystemFinding>[];

  if (!hasBuildAuditImport(sourceFile)) {
    findings.push(
      createAuditSystemFinding({
        file: relativePath,
        line: 1,
        severity: "error",
        message: "Runner must import buildAuditArtifacts from the generator entrypoint.",
      }),
    );
  }

  for (const check of RUNNER_BOUNDARY_CHECKS) {
    const line = check.line(sourceFile);
    if (line !== undefined) {
      findings.push(createAuditSystemFinding({ file: relativePath, line, severity: "error", message: check.message }));
    }
  }

  if (!hasFailureExitAssignment(sourceFile)) {
    findings.push(
      createAuditSystemFinding({
        file: relativePath,
        line: 1,
        severity: "error",
        message: "Runner must set a failing process exit code when blocking findings are present.",
      }),
    );
  }
  if (!hasDefaultNegativeProofPolicyGate(sourceFile)) {
    findings.push(
      createAuditSystemFinding({
        file: relativePath,
        line: 1,
        severity: "error",
        message: "Runner must default-skip production mutation negative proof unless GRASSEYE_AUDIT_RUN_NEGATIVE_PROOF=1 explicitly enables it.",
      }),
    );
  }

  return findings;
};
