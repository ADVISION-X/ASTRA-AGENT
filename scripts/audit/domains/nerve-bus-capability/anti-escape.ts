import { Node, SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { LAW_IDS, PATHS } from "./config.js";
import { getSourceFile, makeProject } from "./project-access.js";
import { sourceUsesComputedHandlerAccess } from "./source-rules.js";

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
    return [createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: "Nerve Bus executor is missing for anti-escape checks." })];
  }

  const findings: Finding[] = [];
  for (const variableName of ["inputGate", "policyGate", "integrityGate", "idempotencyGate", "timeoutGate", "sequenceGate", "lease", "proof"]) {
    if (!hasVariableDeclaration(executorSource, variableName)) {
      findings.push(createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: `Nerve Bus executor must preserve ${variableName} as a governed checkpoint.` }));
    }
  }

  const hasGuardedFailurePath = executorSource.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => callExpression.getExpression().getText() === "finalizeFailure");
  return hasGuardedFailurePath
    ? findings
    : [...findings, createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: "Nerve Bus executor must finalize failures through finalizeFailure." })];
}

function collectResultBuilderFindings(resultBuilderSource: ReturnType<typeof getSourceFile>): Finding[] {
  return !resultBuilderSource || !hasVariableDeclaration(resultBuilderSource, "common")
    ? [createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Nerve Bus result builder must centralize governed failure envelope construction." })]
    : [];
}

function collectProofBuilderFindings(proofBuilderSource: ReturnType<typeof getSourceFile>): Finding[] {
  return !parseObjectPreservesProofTelemetry(proofBuilderSource)
    ? [createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.PROOF_BUILDER, line: 1, severity: "fatal", message: "Nerve Bus proof builder must preserve queue, sequence, and handler telemetry." })]
    : [];
}

function collectRunnerFindings(runnerSource: ReturnType<typeof getSourceFile>): Finding[] {
  if (!runnerSource) {
    return [createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Nerve Bus runner is missing for anti-escape checks." })];
  }

  const findings: Finding[] = [];
  const fullText = runnerSource.getFullText();
  if (!fullText.includes("AbortController")) {
    findings.push(createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Nerve Bus runner must allocate AbortController." }));
  }
  if (!fullText.includes('handlerDecision: "timed_out"')) {
    findings.push(createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Nerve Bus runner must preserve an explicit timed_out handler decision." }));
  }
  if (fullText.includes("null as never")) {
    findings.push(createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Nerve Bus runner must not rely on null as never result envelopes." }));
  }
  if (sourceUsesComputedHandlerAccess(runnerSource)) {
    findings.push(createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Nerve Bus runner must not hide handler dispatch behind computed property access." }));
  }
  return findings;
}

export function runAntiEscapeAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const project = makeProject();
  const findings = [
    ...collectExecutorFindings(getSourceFile(project, PATHS.EXECUTOR)),
    ...collectResultBuilderFindings(getSourceFile(project, PATHS.RESULT_BUILDER)),
    ...collectProofBuilderFindings(getSourceFile(project, PATHS.PROOF_BUILDER)),
    ...collectRunnerFindings(getSourceFile(project, PATHS.RUNNER)),
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