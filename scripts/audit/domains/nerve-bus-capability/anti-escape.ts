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

function findParsedProofObject(sourceTextOwner: ReturnType<typeof getSourceFile>) {
  if (!sourceTextOwner) {
    return null;
  }

  const parseCall = sourceTextOwner.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression) && expression.getText() === "NerveBusTransportProofSchema.parse";
  });
  const [argument] = parseCall?.getArguments() ?? [];
  return argument && Node.isObjectLiteralExpression(argument) ? argument : null;
}

function getParsedProofPropertyNames(sourceTextOwner: ReturnType<typeof getSourceFile>): Set<string> | null {
  const proofObject = findParsedProofObject(sourceTextOwner);
  if (!proofObject) {
    return null;
  }

  return new Set(
    proofObject.getProperties().flatMap((property) => {
      if (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)) {
        return [property.getName()];
      }
      return [];
    }),
  );
}

function parseObjectPreservesProofTelemetry(sourceTextOwner: ReturnType<typeof getSourceFile>): boolean {
  const propertyNames = getParsedProofPropertyNames(sourceTextOwner);
  return propertyNames !== null && ["handlerCallId", "sequenceDecision", "queueDecision"].every((propertyName) => propertyNames.has(propertyName));
}

function collectExecutorFindings(executorSource: ReturnType<typeof getSourceFile>): Finding[] {
  if (!executorSource) {
    return [createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "Nerve Bus executor is missing for anti-escape checks." })];
  }

  const findings: Finding[] = [];
  for (const variableName of ["inputGate", "policyGate", "integrityGate", "idempotencyGate", "timeoutGate", "sequenceGate", "lease", "proof"]) {
    if (!hasVariableDeclaration(executorSource, variableName)) {
      findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: `Nerve Bus executor must preserve ${variableName} as a governed checkpoint.` }));
    }
  }

  const hasGuardedFailurePath = executorSource.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => callExpression.getExpression().getText() === "finalizeFailure");
  return hasGuardedFailurePath
    ? findings
    : [...findings, createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "Nerve Bus executor must finalize failures through finalizeFailure." })];
}

function collectResultBuilderFindings(resultBuilderSource: ReturnType<typeof getSourceFile>): Finding[] {
  return !resultBuilderSource || !hasVariableDeclaration(resultBuilderSource, "common")
    ? [createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1", file: RESULT_BUILDER_PATH, line: 1, severity: "fatal", message: "Nerve Bus result builder must centralize governed failure envelope construction." })]
    : [];
}

function collectProofBuilderFindings(proofBuilderSource: ReturnType<typeof getSourceFile>): Finding[] {
  return !parseObjectPreservesProofTelemetry(proofBuilderSource)
    ? [createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1", file: PROOF_BUILDER_PATH, line: 1, severity: "fatal", message: "Nerve Bus proof builder must preserve queue, sequence, and handler telemetry." })]
    : [];
}

function collectRunnerFindings(runnerSource: ReturnType<typeof getSourceFile>): Finding[] {
  if (!runnerSource) {
    return [createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "Nerve Bus runner is missing for anti-escape checks." })];
  }

  const findings: Finding[] = [];
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
  return findings;
}

export function runAntiEscapeAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const project = makeProject();
  const findings = [
    ...collectExecutorFindings(getSourceFile(project, EXECUTOR_PATH)),
    ...collectResultBuilderFindings(getSourceFile(project, RESULT_BUILDER_PATH)),
    ...collectProofBuilderFindings(getSourceFile(project, PROOF_BUILDER_PATH)),
    ...collectRunnerFindings(getSourceFile(project, RUNNER_PATH)),
  ];

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