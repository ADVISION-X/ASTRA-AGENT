import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasPropertyNamed } from "../_shared/ast-literal-queries.js";
import { hasCallExpression } from "../_shared/ast-helpers.js";
import { getSource, ROOT } from "./ast-utils.js";

function collectExecutorFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const executorSource = getSource(project, `${ROOT}/runtime/post-action-verification-executor.ts`);
  for (const callee of ["validatePostActionOutputBoundary", "finalizeVerificationDecision", "buildPostActionRuntimeProof", "buildPostActionVerificationResult"]) {
    if (!hasCallExpression(executorSource, callee)) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-004-V1", file: `${ROOT}/runtime/post-action-verification-executor.ts`, line: 1, severity: "fatal", message: `Anti-escape chain requires ${callee} to be called and retained.` }));
    }
  }
  return findings;
}

function collectResultBuilderFindings(project: Project): Finding[] {
  const resultBuilderSource = getSource(project, `${ROOT}/runtime/verification-result-builder.ts`);
  const resultBuilderText = resultBuilderSource.getFullText();
  return !resultBuilderText.includes("const output = input.status === \"success\"") || !hasPropertyNamed(resultBuilderSource, "output")
    ? [createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V1", file: `${ROOT}/runtime/verification-result-builder.ts`, line: 1, severity: "fatal", message: "Result builder must enforce success-only output construction." })]
    : [];
}

function collectProofBuilderFindings(project: Project): Finding[] {
  const proofBuilderSource = getSource(project, `${ROOT}/runtime/verification-proof-builder.ts`);
  return !hasPropertyNamed(proofBuilderSource, "diagnosticPayloadRef") || !hasPropertyNamed(proofBuilderSource, "outputRef")
    ? [createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V1", file: `${ROOT}/runtime/verification-proof-builder.ts`, line: 1, severity: "fatal", message: "Proof builder must retain outputRef nulling and diagnostic payload binding." })]
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