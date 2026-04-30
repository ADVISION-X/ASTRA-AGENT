import { Node, SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import {
  EXECUTOR_PATH,
  PROOF_BUILDER_PATH,
  RESULT_BUILDER_PATH,
  RUNNER_PATH,
  getSourceFile,
  makeProject,
  sourceUsesComputedHandlerAccess,
} from "./ast-utils.js";

function hasVariableDeclaration(sourceTextOwner: ReturnType<typeof getSourceFile>, variableName: string): boolean {
  return sourceTextOwner?.getDescendantsOfKind(SyntaxKind.VariableDeclaration).some((declaration) => declaration.getName() === variableName) ?? false;
}

function parseObjectPreservesProofTelemetry(sourceTextOwner: ReturnType<typeof getSourceFile>): boolean {
  if (!sourceTextOwner) {
    return false;
  }

  return sourceTextOwner.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isPropertyAccessExpression(expression) || expression.getText() !== "NerveBusTransportProofSchema.parse") {
      return false;
    }

    const [argument] = callExpression.getArguments();
    if (!argument || !Node.isObjectLiteralExpression(argument)) {
      return false;
    }

    const propertyNames = new Set(
      argument.getProperties().flatMap((property) => {
        if (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)) {
          return [property.getName()];
        }
        return [];
      }),
    );

    return ["handlerCallId", "sequenceDecision", "queueDecision"].every((propertyName) => propertyNames.has(propertyName));
  });
}

export function runAntiEscapeAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const findings: Finding[] = [];
  const project = makeProject();
  const executorSource = getSourceFile(project, EXECUTOR_PATH);
  const resultBuilderSource = getSourceFile(project, RESULT_BUILDER_PATH);
  const proofBuilderSource = getSourceFile(project, PROOF_BUILDER_PATH);
  const runnerSource = getSourceFile(project, RUNNER_PATH);

  if (!executorSource) {
    findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "Nerve Bus executor is missing for anti-escape checks." }));
  } else {
    for (const variableName of ["inputGate", "policyGate", "integrityGate", "idempotencyGate", "timeoutGate", "sequenceGate", "lease", "proof"]) {
      if (!hasVariableDeclaration(executorSource, variableName)) {
        findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: `Nerve Bus executor must preserve ${variableName} as a governed checkpoint.` }));
      }
    }

    const hasGuardedFailurePath = executorSource.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => callExpression.getExpression().getText() === "finalizeFailure");
    if (!hasGuardedFailurePath) {
      findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "Nerve Bus executor must finalize failures through finalizeFailure." }));
    }
  }

  if (!resultBuilderSource || !hasVariableDeclaration(resultBuilderSource, "common")) {
    findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1", file: RESULT_BUILDER_PATH, line: 1, severity: "fatal", message: "Nerve Bus result builder must centralize governed failure envelope construction." }));
  }

  if (!parseObjectPreservesProofTelemetry(proofBuilderSource)) {
    findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1", file: PROOF_BUILDER_PATH, line: 1, severity: "fatal", message: "Nerve Bus proof builder must preserve queue, sequence, and handler telemetry." }));
  }

  if (!runnerSource) {
    findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "Nerve Bus runner is missing for anti-escape checks." }));
  } else {
    const fullText = runnerSource.getFullText();
    if (!fullText.includes("AbortController")) {
      findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "Nerve Bus runner must allocate AbortController." }));
    }
    if (!fullText.includes('handlerDecision: "timed_out"')) {
      findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "Nerve Bus runner must preserve an explicit timed_out handler decision." }));
    }
    if (fullText.includes("null as never")) {
      findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "Nerve Bus runner must not rely on null as never result envelopes." }));
    }
    if (sourceUsesComputedHandlerAccess(runnerSource)) {
      findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "Nerve Bus runner must not hide handler dispatch behind computed property access." }));
    }
  }

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "anti-escape",
      phasePassed ? "PASS" : "CODE VIOLATION",
      phasePassed,
      phasePassed
        ? "Nerve Bus resists gate bypass, proof dropping, timeout relabeling, and handler-access laundering."
        : "Nerve Bus still exposes anti-escape gaps in the governed transport chain.",
    ),
  };
}