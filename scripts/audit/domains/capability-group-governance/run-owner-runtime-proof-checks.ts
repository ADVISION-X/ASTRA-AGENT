import { SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getAuditProject, getNodeLine, toRelativeSourcePath } from "../../core/ts-morph.js";
import { getZodObjectPropertyNames } from "../_shared/ast-schema-queries.js";

import { capabilityGroupGovernanceConstants } from "./inspection-constants.js";
import { capabilityGroupGovernanceUtils } from "./inspection-utils.js";

const { FORBIDDEN_OWNER_LITERALS, LAW_ID_004, LAW_ID_006, OWNER_LITERAL_PROPERTIES, REQUIRED_RUNTIME_PROOF_FIELDS, RUNTIME_PROOF_TARGETS } = capabilityGroupGovernanceConstants;
const { getStringLiteralValue, isGovernedSurface } = capabilityGroupGovernanceUtils;

const collectForbiddenOwnerLiteralFindingsForSource = (relativePath: string, sourceFile: ReturnType<ReturnType<typeof getAuditProject>["getSourceFiles"]>[number]): Finding[] => {
  const findings: Finding[] = [];
  for (const propertyAssignment of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
    const propertyName = propertyAssignment.getName();
    const literalValue = getStringLiteralValue(propertyAssignment.getInitializer());
    if (!OWNER_LITERAL_PROPERTIES.has(propertyName) || !literalValue || !FORBIDDEN_OWNER_LITERALS.has(literalValue)) {
      continue;
    }
    findings.push(createFinding({ lawId: LAW_ID_006, file: relativePath, line: getNodeLine(propertyAssignment), severity: "fatal", message: "Governed source still emits a retired or forbidden owner literal.", detail: `${propertyName}=${literalValue}` }));
  }
  return findings;
};

const inspectForbiddenOwnerLiterals = (project: ReturnType<typeof getAuditProject>): { findings: Finding[]; phases: InspectorPhase[] } => {
  const findings: Finding[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const relativePath = toRelativeSourcePath(sourceFile);
    if (!isGovernedSurface(relativePath)) {
      continue;
    }
    findings.push(...collectForbiddenOwnerLiteralFindingsForSource(relativePath, sourceFile));
  }

  return {
    findings,
    phases: [
      createPhase(
        "forbidden-owner-literals",
        findings.length === 0 ? "PASS" : "CODE VIOLATION",
        findings.length === 0,
        findings.length === 0
          ? "Governed source no longer emits retired owner literals."
          : "Governed source still emits retired owner literals.",
      ),
    ],
  };
};

const inspectRuntimeProofMinimums = (project: ReturnType<typeof getAuditProject>): { findings: Finding[]; phases: InspectorPhase[] } => {
  const findings: Finding[] = [];

  for (const target of RUNTIME_PROOF_TARGETS) {
    const sourceFile = project.getSourceFile(pathFromRepoRoot(target.file));
    if (!sourceFile) {
      findings.push(createFinding({ lawId: LAW_ID_004, file: target.file, line: 1, severity: "error", message: "Runtime proof target file is missing from source truth." }));
      continue;
    }

    const properties = getZodObjectPropertyNames(sourceFile, target.schemaName);
    const missingProperties = REQUIRED_RUNTIME_PROOF_FIELDS.filter((propertyName) => !properties.has(propertyName));
    if (missingProperties.length === 0) {
      continue;
    }
    findings.push(createFinding({ lawId: LAW_ID_004, file: target.file, line: 1, severity: "error", message: "Runtime proof type is missing one or more constitutional minimum fields.", detail: `${target.schemaName}: ${missingProperties.join(", ")}` }));
  }

  return {
    findings,
    phases: [
      createPhase(
        "runtime-proof-minimums",
        findings.length === 0 ? "PASS" : "CODE VIOLATION",
        findings.length === 0,
        findings.length === 0
          ? "Runtime proof types carry the shared minimum constitutional fields."
          : "Runtime proof types are missing shared constitutional fields.",
      ),
    ],
  };
};

export function runOwnerRuntimeProofChecks(project: ReturnType<typeof getAuditProject>): { findings: Finding[]; phases: InspectorPhase[] } {
  const forbiddenOwners = inspectForbiddenOwnerLiterals(project);
  const runtimeProofs = inspectRuntimeProofMinimums(project);
  return {
    findings: [...forbiddenOwners.findings, ...runtimeProofs.findings],
    phases: [...forbiddenOwners.phases, ...runtimeProofs.phases],
  };
}