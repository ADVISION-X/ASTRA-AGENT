import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasPropertyNamed } from "../_shared/ast-literal-queries.js";
import { hasCallExpression } from "../_shared/ast-helpers.js";
import { getSource, ROOT } from "./ast-utils.js";

export async function runAntiEscape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  const executorSource = getSource(project, `${ROOT}/runtime/post-action-verification-executor.ts`);
  const resultBuilderSource = getSource(project, `${ROOT}/runtime/verification-result-builder.ts`);
  const proofBuilderSource = getSource(project, `${ROOT}/runtime/verification-proof-builder.ts`);

  for (const callee of ["validatePostActionOutputBoundary", "finalizeVerificationDecision", "buildPostActionRuntimeProof", "buildPostActionVerificationResult"]) {
    if (!hasCallExpression(executorSource, callee)) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-004-V1", file: `${ROOT}/runtime/post-action-verification-executor.ts`, line: 1, severity: "fatal", message: `Anti-escape chain requires ${callee} to be called and retained.` }));
    }
  }

  const resultBuilderText = resultBuilderSource.getFullText();
  if (!resultBuilderText.includes("const output = input.status === \"success\"") || !hasPropertyNamed(resultBuilderSource, "output")) {
    findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V1", file: `${ROOT}/runtime/verification-result-builder.ts`, line: 1, severity: "fatal", message: "Result builder must enforce success-only output construction." }));
  }

  if (!hasPropertyNamed(proofBuilderSource, "diagnosticPayloadRef") || !hasPropertyNamed(proofBuilderSource, "outputRef")) {
    findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V1", file: `${ROOT}/runtime/verification-proof-builder.ts`, line: 1, severity: "fatal", message: "Proof builder must retain outputRef nulling and diagnostic payload binding." }));
  }

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase("anti-escape", phasePassed ? "PASS" : "CODE VIOLATION", phasePassed, phasePassed ? "Post Action Verification anti-escape checks are closed." : "Post Action Verification still exposes anti-escape gaps in the governed chain."),
  };
}