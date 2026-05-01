import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasPropertyNamed } from "../_shared/ast-literal-queries.js";
import { hasCallExpression } from "../_shared/ast-helpers.js";
import { LAW_IDS, PATHS } from "./config.js";
import { getSource } from "./project-access.js";

function collectExecutorFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const successResultSource = getSource(project, PATHS.SUCCESS_RESULT);
  for (const callee of ["validatePostActionOutputBoundary", "finalizeVerificationDecision", "buildPostActionRuntimeProof", "buildPostActionVerificationResult"]) {
    if (!hasCallExpression(successResultSource, callee)) {
      findings.push(createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.SUCCESS_RESULT, line: 1, severity: "fatal", message: `Anti-escape chain requires ${callee} to be called and retained.` }));
    }
  }
  return findings;
}

function collectResultBuilderFindings(project: Project): Finding[] {
  const resultBuilderSource = getSource(project, PATHS.RESULT_BUILDER);
  const resultBuilderText = resultBuilderSource.getFullText();
  return !resultBuilderText.includes("const output = input.status === \"success\"") || !hasPropertyNamed(resultBuilderSource, "output")
    ? [createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Result builder must enforce success-only output construction." })]
    : [];
}

function collectProofBuilderFindings(project: Project): Finding[] {
  const proofBuilderSource = getSource(project, PATHS.PROOF_BUILDER);
  return !hasPropertyNamed(proofBuilderSource, "diagnosticPayloadRef") || !hasPropertyNamed(proofBuilderSource, "outputRef")
    ? [createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.PROOF_BUILDER, line: 1, severity: "fatal", message: "Proof builder must retain outputRef nulling and diagnostic payload binding." })]
    : [];
}

export async function runAntiEscape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings = [
    ...collectExecutorFindings(project),
    ...collectResultBuilderFindings(project),
    ...collectProofBuilderFindings(project),
  ];

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase("anti-escape", phasePassed ? "PASS" : "CODE VIOLATION", phasePassed, phasePassed ? "Post Action Verification anti-escape checks are closed." : "Post Action Verification still exposes anti-escape gaps in the governed chain."),
  };
}