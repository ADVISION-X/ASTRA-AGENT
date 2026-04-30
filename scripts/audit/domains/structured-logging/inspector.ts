import { Node, SyntaxKind, type CallExpression, type SourceFile } from "ts-morph";

import { toRepoRelativePath } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getTypeAliasPropertyNames, getZodObjectPropertyNames } from "../_shared/ast-schema-queries.js";
import { hasConsoleLog } from "../_shared/ast-literal-queries.js";
import { createAuditProject, getSourceFileOrThrow, hasAnyKeyword } from "../_shared/ast-helpers.js";

const LAW_DISCIPLINE = "GRASSEYE-STRUCTURED-LOGGING-001-V1";
const LAW_TRACEABILITY = "GRASSEYE-STRUCTURED-LOGGING-002-V2";
const TYPES_PATH = "src/types/structured-log.ts";
const RUNTIME_PROOF_SUPPORT_PATH = "src/lib/local-runtime/runtime-proof-support.ts";
const RUNTIME_ACTION_SUPPORT_PATH = "src/lib/local-runtime/runtime-action-support.ts";
const FORENSICS_CONTRACT_PATH = "src/capabilities/forensics-persistence/contract.ts";
const FORENSICS_RUNTIME_PROOF_PATH = "src/capabilities/forensics-persistence/shared/runtime-proof.ts";
const FORENSICS_RESULT_PATH = "src/capabilities/forensics-persistence/shared/persistence-result.ts";
const STRUCTURED_RUNTIME_CHILD_PATH = "src/capabilities/forensics-persistence/children/write-structured-runtime-event/implementation.ts";
const STRUCTURED_ACTION_CHILD_PATH = "src/capabilities/forensics-persistence/children/write-structured-action-log/implementation.ts";
const RUNTIME_SNAPSHOT_CHILD_PATH = "src/capabilities/forensics-persistence/children/update-runtime-snapshot/implementation.ts";
const EXECUTOR_PATH = "src/capabilities/orchestration/bounded-local-runtime-execution/executor.ts";

const GOVERNED_SOURCE_PATHS = [
  TYPES_PATH,
  RUNTIME_PROOF_SUPPORT_PATH,
  RUNTIME_ACTION_SUPPORT_PATH,
  FORENSICS_RUNTIME_PROOF_PATH,
  FORENSICS_RESULT_PATH,
  STRUCTURED_RUNTIME_CHILD_PATH,
  STRUCTURED_ACTION_CHILD_PATH,
  RUNTIME_SNAPSHOT_CHILD_PATH,
  EXECUTOR_PATH,
] as const;

const COMMENT_DIRECTIVES = ["@ts-ignore", "@ts-expect-error", "eslint-disable"] as const;

function collectComments(sourceFile: SourceFile): string[] {
  const comments = new Set<string>();
  const nodes: Node[] = [sourceFile, ...sourceFile.getDescendants()];
  for (const node of nodes) {
    for (const range of node.getLeadingCommentRanges()) {
      comments.add(range.getText());
    }
    for (const range of node.getTrailingCommentRanges()) {
      comments.add(range.getText());
    }
  }
  return [...comments];
}

function hasCommentDirective(sourceFile: SourceFile): boolean {
  return collectComments(sourceFile).some((commentText) => COMMENT_DIRECTIVES.some((directive) => commentText.includes(directive)));
}

function hasImportOrRequireEscape(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    if (expression.getKind() === SyntaxKind.ImportKeyword) {
      return true;
    }

    return Node.isIdentifier(expression) && expression.getText() === "require";
  });
}

function hasStringLiteral(sourceFile: SourceFile, literalText: string): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).some((node) => node.getLiteralText() === literalText)
    || sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).some((node) => node.getLiteralText() === literalText);
}

function hasObjectPropertyValue(node: Node, propertyName: string, predicate: (initializer: Node) => boolean): boolean {
  return node.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).some((objectLiteral) => {
    const property = objectLiteral.getProperty(propertyName);
    if (!property || !Node.isPropertyAssignment(property)) {
      return false;
    }

    const initializer = property.getInitializer();
    return Boolean(initializer && predicate(initializer));
  });
}

function hasObjectPropertyStringLiteral(node: Node, propertyName: string, literalText: string): boolean {
  return hasObjectPropertyValue(node, propertyName, (initializer) => {
    return (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer))
      && initializer.getLiteralText() === literalText;
  });
}

function hasObjectPropertyNull(node: Node, propertyName: string): boolean {
  return hasObjectPropertyValue(node, propertyName, (initializer) => initializer.getKind() === SyntaxKind.NullKeyword);
}

function hasObjectProperty(node: Node, propertyName: string): boolean {
  return node.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).some((objectLiteral) => Boolean(objectLiteral.getProperty(propertyName)));
}

function isForensicsAbilityMethodCall(callExpression: CallExpression, methodName: string): boolean {
  const expression = callExpression.getExpression();
  if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== methodName) {
    return false;
  }

  const symbol = expression.getNameNode().getSymbol() ?? expression.getSymbol();
  const declarationPaths = (symbol?.getAliasedSymbol() ?? symbol)?.getDeclarations().map((declaration) => toRepoRelativePath(declaration.getSourceFile().getFilePath())) ?? [];
  if (declarationPaths.includes(FORENSICS_CONTRACT_PATH)) {
    return true;
  }

  const receiverText = expression.getExpression().getText();
  if (receiverText.endsWith("forensicsPersistenceAbilityGroup")) {
    return true;
  }

  return expression.getExpression().getType().getText(expression).includes("ForensicsPersistenceAbilityGroup");
}

function getForensicsAbilityCalls(sourceFile: SourceFile, methodName: string): CallExpression[] {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => isForensicsAbilityMethodCall(callExpression, methodName));
}

function allCallsCarryOrchestrationOwnership(callExpressions: CallExpression[]): boolean {
  return callExpressions.length > 0 && callExpressions.every((callExpression) => {
    return hasObjectPropertyStringLiteral(callExpression, "requestedBy", "orchestration")
      && hasObjectPropertyStringLiteral(callExpression, "sourceAbilityGroupId", "orchestration");
  });
}

function allStructuredRuntimePayloadsCarryOwnerShape(sourceFile: SourceFile): boolean {
  const parseCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && expression.getName() === "parse"
      && expression.getExpression().getText() === "StructuredRuntimeEventSchema";
  });

  return parseCalls.length > 0 && parseCalls.every((callExpression) => {
    return hasObjectPropertyStringLiteral(callExpression, "abilityGroupId", "orchestration")
      && hasObjectPropertyNull(callExpression, "childCapabilityId");
  });
}

function allStructuredActionPayloadsCarryOwnerShape(sourceFile: SourceFile): boolean {
  const parseCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && expression.getName() === "parse"
      && expression.getExpression().getText() === "StructuredActionLogSchema";
  });

  return parseCalls.length > 0 && parseCalls.every((callExpression) => {
    return hasObjectPropertyStringLiteral(callExpression, "abilityGroupId", "orchestration")
      && hasObjectPropertyNull(callExpression, "childCapabilityId");
  });
}

function childImplementationClosesTraceability(sourceFile: SourceFile): boolean {
  const successCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "buildForensicsSuccessResult";
  });
  const failureCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "buildForensicsFailureResult";
  });

  const successPassed = successCalls.length > 0 && successCalls.every((callExpression) => {
    return hasObjectProperty(callExpression, "sourceRecordRefs")
      && hasObjectProperty(callExpression, "artifactRefs")
      && hasObjectProperty(callExpression, "debugLogRef");
  });
  const failurePassed = failureCalls.length > 0 && failureCalls.every((callExpression) => {
    return hasObjectProperty(callExpression, "sourceRecordRefs")
      && hasObjectProperty(callExpression, "artifactRefs")
      && hasObjectProperty(callExpression, "debugLogRef");
  });

  return successPassed && failurePassed;
}

export async function inspectStructuredLoggingBoundary(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const project = createAuditProject();
  const typesFile = getSourceFileOrThrow(project, TYPES_PATH);
  const runtimeProofSupport = getSourceFileOrThrow(project, RUNTIME_PROOF_SUPPORT_PATH);
  const runtimeActionSupport = getSourceFileOrThrow(project, RUNTIME_ACTION_SUPPORT_PATH);
  const runtimeProofType = getSourceFileOrThrow(project, FORENSICS_RUNTIME_PROOF_PATH);
  const persistenceResult = getSourceFileOrThrow(project, FORENSICS_RESULT_PATH);
  const structuredRuntimeChild = getSourceFileOrThrow(project, STRUCTURED_RUNTIME_CHILD_PATH);
  const structuredActionChild = getSourceFileOrThrow(project, STRUCTURED_ACTION_CHILD_PATH);
  const runtimeSnapshotChild = getSourceFileOrThrow(project, RUNTIME_SNAPSHOT_CHILD_PATH);
  const executorSource = getSourceFileOrThrow(project, EXECUTOR_PATH);
  const governedSourceFiles = GOVERNED_SOURCE_PATHS.map((path) => getSourceFileOrThrow(project, path));

  const findings: Finding[] = [];

  const runtimeEventFields = getZodObjectPropertyNames(typesFile, "StructuredRuntimeEventSchema");
  const actionLogFields = getZodObjectPropertyNames(typesFile, "StructuredActionLogSchema");
  const runtimeProofFields = getTypeAliasPropertyNames(runtimeProofType, "ForensicsRuntimeProof");

  const typesPassed = [
    runtimeEventFields.has("abilityGroupId"),
    runtimeEventFields.has("childCapabilityId"),
    runtimeEventFields.has("sessionId"),
    runtimeEventFields.has("roundId"),
    runtimeEventFields.has("videoVisitId"),
    runtimeEventFields.has("status"),
    runtimeEventFields.has("reason"),
    runtimeEventFields.has("inputRefs"),
    runtimeEventFields.has("outputRefs"),
    runtimeEventFields.has("evidenceRefs"),
    runtimeEventFields.has("actionLogRefs"),
    runtimeEventFields.has("createdAt"),
    actionLogFields.has("abilityGroupId"),
    actionLogFields.has("childCapabilityId"),
    actionLogFields.has("sessionId"),
    actionLogFields.has("roundId"),
    actionLogFields.has("videoVisitId"),
    actionLogFields.has("actionPurpose"),
    actionLogFields.has("triggerSource"),
    actionLogFields.has("failureReason"),
    actionLogFields.has("reviewRequiredReason"),
    actionLogFields.has("inputRefs"),
    actionLogFields.has("outputRefs"),
    actionLogFields.has("evidenceRefs"),
    actionLogFields.has("createdAt"),
  ].every(Boolean);
  const runtimePayloadShapePassed = allStructuredRuntimePayloadsCarryOwnerShape(runtimeProofSupport);
  const actionPayloadShapePassed = allStructuredActionPayloadsCarryOwnerShape(runtimeProofSupport)
    && allStructuredActionPayloadsCarryOwnerShape(runtimeActionSupport);

  if (!typesPassed || !runtimePayloadShapePassed || !actionPayloadShapePassed || hasAnyKeyword(typesFile)) {
    findings.push(createFinding({
      lawId: LAW_DISCIPLINE,
      file: TYPES_PATH,
      line: 1,
      severity: "error",
      message: "Structured logging schema or payload builders are missing governed owner identity, required fields, or type-safe payload construction.",
    }));
  }

  const runtimeEventCalls = [
    ...getForensicsAbilityCalls(runtimeProofSupport, "writeStructuredRuntimeEvent"),
    ...getForensicsAbilityCalls(runtimeProofSupport, "updateRuntimeSnapshot"),
  ];
  const actionLogCalls = [
    ...getForensicsAbilityCalls(runtimeProofSupport, "writeStructuredActionLog"),
    ...getForensicsAbilityCalls(executorSource, "writeStructuredActionLog"),
  ];
  const persistenceBoundaryPassed = allCallsCarryOrchestrationOwnership(runtimeEventCalls)
    && allCallsCarryOrchestrationOwnership(actionLogCalls)
    && !hasStringLiteral(runtimeProofSupport, "agent-runtime");

  if (!persistenceBoundaryPassed) {
    findings.push(createFinding({
      lawId: LAW_DISCIPLINE,
      file: RUNTIME_PROOF_SUPPORT_PATH,
      line: 1,
      severity: "fatal",
      message: "Structured logging writes must route through Forensics Persistence from active ability-group ownership, not the retired agent-runtime owner.",
    }));
  }

  const traceabilityTypePassed = [
    runtimeProofFields.has("proofId"),
    runtimeProofFields.has("outputRecordRefs"),
    runtimeProofFields.has("artifactRefs"),
    runtimeProofFields.has("debugLogRef"),
  ].every(Boolean);
  const buildRuntimeProofFunction = persistenceResult.getFunction("buildForensicsRuntimeProof") ?? null;
  const buildSuccessResultFunction = persistenceResult.getFunction("buildForensicsSuccessResult") ?? null;
  const buildFailureResultFunction = persistenceResult.getFunction("buildForensicsFailureResult") ?? null;
  const runtimeProofReferences = buildRuntimeProofFunction?.getNameNode()?.findReferencesAsNodes().filter((node) => node !== buildRuntimeProofFunction.getNameNode()) ?? [];
  const traceabilityBuildersPassed = Boolean(
    buildRuntimeProofFunction
    && buildSuccessResultFunction
    && buildFailureResultFunction
    && hasObjectProperty(buildSuccessResultFunction, "outputRecordRefs")
    && hasObjectProperty(buildSuccessResultFunction, "artifactRefs")
    && hasObjectProperty(buildSuccessResultFunction, "debugLogRef")
    && hasObjectProperty(buildFailureResultFunction, "outputRecordRefs")
    && hasObjectProperty(buildFailureResultFunction, "artifactRefs")
    && hasObjectProperty(buildFailureResultFunction, "debugLogRef")
    && runtimeProofReferences.length >= 2,
  );
  const childTraceabilityPassed = [structuredRuntimeChild, structuredActionChild, runtimeSnapshotChild].every(childImplementationClosesTraceability);

  if (!traceabilityTypePassed || !traceabilityBuildersPassed || !childTraceabilityPassed) {
    findings.push(createFinding({
      lawId: LAW_TRACEABILITY,
      file: FORENSICS_RESULT_PATH,
      line: 1,
      severity: "fatal",
      message: "Structured logging runtime proof must close through proof ids, record refs, artifact refs, debug log refs, and Forensics child result builders.",
    }));
  }

  const antiEscapeViolations = governedSourceFiles.filter((sourceFile) => {
    return hasAnyKeyword(sourceFile)
      || hasCommentDirective(sourceFile)
      || hasImportOrRequireEscape(sourceFile)
      || hasConsoleLog(sourceFile);
  }).map((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()));

  if (antiEscapeViolations.length > 0) {
    findings.push(createFinding({
      lawId: LAW_DISCIPLINE,
      file: antiEscapeViolations[0] ?? TYPES_PATH,
      line: 1,
      severity: "fatal",
      message: "Structured logging governance files contain console-truth, require/import escapes, comment directives, or any-based loopholes.",
    }));
  }

  return {
    findings,
    phases: [
      createPhase(
        "structured-logging-required-shape",
        typesPassed && runtimePayloadShapePassed && actionPayloadShapePassed ? "PASS" : "CODE VIOLATION",
        typesPassed && runtimePayloadShapePassed && actionPayloadShapePassed,
        typesPassed && runtimePayloadShapePassed && actionPayloadShapePassed
          ? "Structured logging schemas and payload builders carry governed owner ids, refs, reasons, and timestamps."
          : "Structured logging schemas or payload builders are missing governed owner ids or required record fields.",
      ),
      createPhase(
        "structured-logging-boundary-attack",
        persistenceBoundaryPassed ? "PASS" : "CODE VIOLATION",
        persistenceBoundaryPassed,
        persistenceBoundaryPassed
          ? "Structured runtime and action log writes flow through Forensics Persistence from active ability-group ownership."
          : "Structured runtime or action log writes still rely on a retired owner or bypass the governed Forensics ability boundary.",
      ),
      createPhase(
        "structured-logging-runtime-proof-traceability",
        traceabilityTypePassed && traceabilityBuildersPassed && childTraceabilityPassed ? "PASS" : "CODE VIOLATION",
        traceabilityTypePassed && traceabilityBuildersPassed && childTraceabilityPassed,
        traceabilityTypePassed && traceabilityBuildersPassed && childTraceabilityPassed
          ? "Runtime proof stays traceable through proof ids, record refs, artifact refs, debug log refs, and child write results."
          : "Runtime proof traceability is incomplete across the Forensics proof type, result builders, or structured logging child implementations.",
      ),
      createPhase(
        "structured-logging-anti-escape",
        antiEscapeViolations.length === 0 ? "PASS" : "CODE VIOLATION",
        antiEscapeViolations.length === 0,
        antiEscapeViolations.length === 0
          ? "Structured logging enforcement files are free of console truth, require/import escape hatches, comment directives, and any-based loopholes."
          : "Structured logging enforcement files still contain console truth, require/import escape hatches, comment directives, or any-based loopholes.",
      ),
    ],
  };
}