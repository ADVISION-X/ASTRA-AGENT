import { Node, SyntaxKind, type BinaryExpression, type CallExpression, type IfStatement, type MethodDeclaration } from "ts-morph";

import { createFinding, createPhase } from "../../../core/result.js";
import type { Finding, InspectorPhase } from "../../../core/schema.js";
import {
  getAuditProject,
  getExpressionPath,
  getNodeLine,
  getObjectLiteralString,
  getReferencePaths,
  getSourceFileOrThrow,
  isCallPath,
  isInsideNamedMethod,
  toRelativeSourcePath,
} from "../../../core/ts-morph.js";

const LAW_ID = "GRASSEYE-AGENT-RUNTIME-001-V1";
const AGENT_RUNTIME_FILE = "src/features/agent/agent-service.ts";
const WORKBENCH_FILE = "src/lib/local-runtime/workbench.ts";

const ACTION_CALL_PATHS = [
  ["this", "adapter", "clickNotInterested"],
  ["this", "adapter", "likeOrSaveCandidate"],
  ["this", "adapter", "openComments"],
  ["this", "adapter", "continueNext"],
];

const getTaskTypeFromExecuteCall = (callExpression: CallExpression): string | undefined => {
  const firstArgument = callExpression.getArguments()[0];
  if (!firstArgument || !Node.isObjectLiteralExpression(firstArgument)) {
    return undefined;
  }

  return getObjectLiteralString(firstArgument, "taskType");
};

const isRoundStatusAssignment = (expression: BinaryExpression, status: string): boolean => {
  if (expression.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
    return false;
  }

  const leftPath = getExpressionPath(expression.getLeft());
  const right = expression.getRight();
  return (
    leftPath.length === 2 &&
    leftPath[0] === "round" &&
    leftPath[1] === "status" &&
    Node.isStringLiteral(right) &&
    right.getLiteralText() === status
  );
};

const getPropertyIfStatement = (ifStatements: IfStatement[], expectedPath: string[]): IfStatement | undefined =>
  ifStatements.find((ifStatement) => {
    const expressionPath = getExpressionPath(ifStatement.getExpression());
    return expressionPath.length === expectedPath.length && expressionPath.every((segment, index) => segment === expectedPath[index]);
  });

const blockContainsCall = (node: Node, expectedPath: string[]): boolean =>
  node.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => isCallPath(callExpression, expectedPath));

const blockContainsReturn = (node: Node): boolean => node.getDescendantsOfKind(SyntaxKind.ReturnStatement).length > 0;

const getStatusAssignments = (method: MethodDeclaration, status: string): BinaryExpression[] =>
  method
    .getDescendantsOfKind(SyntaxKind.BinaryExpression)
    .filter((expression) => isRoundStatusAssignment(expression, status));

const hasRoundLimitCondition = (expression: Node | undefined): boolean => {
  if (!expression) {
    return false;
  }

  return expression.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((binaryExpression) => {
    if (binaryExpression.getOperatorToken().getKind() !== SyntaxKind.LessThanToken) {
      return false;
    }

    const leftPath = getExpressionPath(binaryExpression.getLeft());
    const rightPath = getExpressionPath(binaryExpression.getRight());
    return (
      leftPath.length === 1 &&
      leftPath[0] === "roundIndex" &&
      rightPath.length === 2 &&
      rightPath[0] === "task" &&
      rightPath[1] === "maxRounds"
    );
  });
};

export const inspectAgentRuntimeAst = async (): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const findings: Finding[] = [];
  const phases: InspectorPhase[] = [];
  const project = getAuditProject();
  const sourceFile = getSourceFileOrThrow(project, AGENT_RUNTIME_FILE);
  const relativeFilePath = toRelativeSourcePath(sourceFile);

  const agentClass = sourceFile.getClass("AgentService");
  if (!agentClass) {
    findings.push(
      createFinding({
        lawId: LAW_ID,
        file: relativeFilePath,
        line: 1,
        severity: "fatal",
        message: "AgentService class is missing from the agent-runtime owner file.",
      }),
    );

    phases.push(createPhase("required-shape", "LAW GAP", false, "AgentService class is missing."));
    return { findings, phases };
  }

  const requiredPhaseStart = findings.length;
  const startMethod = agentClass.getMethod("startOrResumeTask");
  const pauseMethod = agentClass.getMethod("pauseTask");
  const stopMethod = agentClass.getMethod("stopTask");
  const executeMethod = agentClass.getMethod("executeCurrentTask");
  const appendActionLogMethod = agentClass.getMethod("appendActionLog");

  if (!startMethod || !pauseMethod || !stopMethod || !executeMethod || !appendActionLogMethod) {
    findings.push(
      createFinding({
        lawId: LAW_ID,
        file: relativeFilePath,
        line: getNodeLine(agentClass),
        severity: "fatal",
        message: "Agent runtime is missing one of the required bounded-loop methods.",
      }),
    );
  }

  const controlStateType = sourceFile.getTypeAlias("AgentControlState");
  const runningTaskProperty = controlStateType?.getTypeNode()?.getDescendantsOfKind(SyntaxKind.PropertySignature)
    .find((propertySignature) => propertySignature.getName() === "runningTaskId");
  if (!runningTaskProperty) {
    findings.push(
      createFinding({
        lawId: LAW_ID,
        file: relativeFilePath,
        line: getNodeLine(controlStateType ?? agentClass),
        severity: "error",
        message: "AgentControlState must expose a singular runningTaskId authority slot.",
      }),
    );
  }

  if (!executeMethod || !appendActionLogMethod) {
    phases.push(
      createPhase(
        "required-shape",
        findings.length === requiredPhaseStart ? "PASS" : "LAW GAP",
        findings.length === requiredPhaseStart,
        findings.length === requiredPhaseStart
          ? "Agent runtime exposes the required bounded-loop surface."
          : "Agent runtime is missing required bounded-loop surface.",
      ),
    );

    return { findings, phases };
  }

  const whileLoop = executeMethod.getFirstDescendantByKind(SyntaxKind.WhileStatement);
  const whileExpression = whileLoop?.getExpression();
  const whileConditionCalls = whileExpression?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [];
  const hasBoundedLoop = whileConditionCalls.some((callExpression) => isCallPath(callExpression, ["this", "adapter", "hasCurrentVideo"]));
  const hasLoopRoundLimit = hasRoundLimitCondition(whileExpression);
  if (!whileLoop || !hasBoundedLoop || !hasLoopRoundLimit) {
    findings.push(
      createFinding({
        lawId: LAW_ID,
        file: relativeFilePath,
        line: getNodeLine(executeMethod),
        severity: "fatal",
        message: "executeCurrentTask must keep one bounded loop over the current video feed and max rounds.",
      }),
    );
  }

  const stopAndPauseIfs = executeMethod.getDescendantsOfKind(SyntaxKind.IfStatement);
  const stopIf = getPropertyIfStatement(stopAndPauseIfs, ["this", "controlState", "stopRequested"]);
  const pauseIf = getPropertyIfStatement(stopAndPauseIfs, ["this", "controlState", "pauseRequested"]);
  if (!stopIf || !blockContainsCall(stopIf, ["this", "evidenceStore", "updateTaskRunStatus"]) || !blockContainsReturn(stopIf)) {
    findings.push(
      createFinding({
        lawId: LAW_ID,
        file: relativeFilePath,
        line: getNodeLine(executeMethod),
        severity: "error",
        message: "Stop condition must update task status and terminate the bounded loop.",
      }),
    );
  }

  if (!pauseIf || !blockContainsCall(pauseIf, ["this", "evidenceStore", "updateTaskRunStatus"]) || !blockContainsReturn(pauseIf)) {
    findings.push(
      createFinding({
        lawId: LAW_ID,
        file: relativeFilePath,
        line: getNodeLine(executeMethod),
        severity: "error",
        message: "Pause condition must update task status and terminate the bounded loop.",
      }),
    );
  }

  const callExpressions = executeMethod.getDescendantsOfKind(SyntaxKind.CallExpression);
  const roundCallExpressions = whileLoop?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [];
  const observeCall = roundCallExpressions.find((callExpression) => isCallPath(callExpression, ["this", "adapter", "observeCurrentVideo"]));
  const visionExecuteCall = roundCallExpressions.find(
    (callExpression) =>
      isCallPath(callExpression, ["this", "localAiGateway", "execute"]) &&
      getTaskTypeFromExecuteCall(callExpression) === "vision.productPresence",
  );
  const actionCalls = roundCallExpressions.filter((callExpression) => ACTION_CALL_PATHS.some((path) => isCallPath(callExpression, path)));
  const firstActionCall = actionCalls[0];
  if (!observeCall || !visionExecuteCall || !firstActionCall) {
    findings.push(
      createFinding({
        lawId: LAW_ID,
        file: relativeFilePath,
        line: getNodeLine(executeMethod),
        severity: "fatal",
        message: "Agent runtime must observe, classify, and then execute a governed platform action.",
      }),
    );
  } else if (!(observeCall.getStart() < visionExecuteCall.getStart() && visionExecuteCall.getStart() < firstActionCall.getStart())) {
    findings.push(
      createFinding({
        lawId: LAW_ID,
        file: relativeFilePath,
        line: getNodeLine(firstActionCall),
        severity: "error",
        message: "Platform actions must occur only after observe and classification complete.",
      }),
    );
  }

  const appendActionLogCall = callExpressions.find((callExpression) => isCallPath(callExpression, ["this", "appendActionLog"]));
  const saveImageEvidenceCall = callExpressions.find((callExpression) => isCallPath(callExpression, ["this", "evidenceStore", "saveImageEvidence"]));
  const completedAssignments = getStatusAssignments(executeMethod, "completed");
  if (!appendActionLogCall || !saveImageEvidenceCall || completedAssignments.length === 0) {
    findings.push(
      createFinding({
        lawId: LAW_ID,
        file: relativeFilePath,
        line: getNodeLine(executeMethod),
        severity: "fatal",
        message: "Agent runtime must record evidence and action logs before marking a round complete.",
      }),
    );
  } else if (
    completedAssignments.some(
      (assignment) => assignment.getStart() < appendActionLogCall.getStart() || assignment.getStart() < saveImageEvidenceCall.getStart(),
    )
  ) {
    const firstInvalidCompletedAssignment = completedAssignments.find(
      (assignment) => assignment.getStart() < appendActionLogCall.getStart() || assignment.getStart() < saveImageEvidenceCall.getStart(),
    );
    findings.push(
      createFinding({
        lawId: LAW_ID,
        file: relativeFilePath,
        line: getNodeLine(firstInvalidCompletedAssignment ?? completedAssignments[0] ?? executeMethod),
        severity: "error",
        message: "Round completion must happen only after evidence and action records are created.",
      }),
    );
  }

  const reviewAssignments = getStatusAssignments(executeMethod, "review_required");
  if (reviewAssignments.length === 0) {
    findings.push(
      createFinding({
        lawId: LAW_ID,
        file: relativeFilePath,
        line: getNodeLine(executeMethod),
        severity: "error",
        message: "Agent runtime must expose a review gate or operator handoff path.",
      }),
    );
  }

  const runningTaskAssignments = sourceFile
    .getDescendantsOfKind(SyntaxKind.BinaryExpression)
    .filter((expression) => {
      if (expression.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
        return false;
      }

      const leftPath = getExpressionPath(expression.getLeft());
      return leftPath.length === 3 && leftPath[0] === "this" && leftPath[1] === "controlState" && leftPath[2] === "runningTaskId";
    });
  if (runningTaskAssignments.length === 0) {
    findings.push(
      createFinding({
        lawId: LAW_ID,
        file: relativeFilePath,
        line: getNodeLine(agentClass),
        severity: "error",
        message: "One task window must have one active runtime authority slot.",
      }),
    );
  }

  phases.push(
    createPhase(
      "required-shape",
      findings.length === requiredPhaseStart ? "PASS" : "CODE VIOLATION",
      findings.length === requiredPhaseStart,
      findings.length === requiredPhaseStart
        ? "Agent runtime exposes bounded loop, ordered classification, record-before-complete, and review/stop surfaces."
        : "Agent runtime is missing required bounded-loop surfaces.",
    ),
  );

  const forbiddenPhaseStart = findings.length;
  const appendActionCalls = appendActionLogMethod.getDescendantsOfKind(SyntaxKind.CallExpression);
  const savesActionLog = appendActionCalls.some((callExpression) => isCallPath(callExpression, ["this", "evidenceStore", "saveActionLog"]));
  if (!savesActionLog) {
    findings.push(
      createFinding({
        lawId: LAW_ID,
        file: relativeFilePath,
        line: getNodeLine(appendActionLogMethod),
        severity: "error",
        message: "Action log helper must persist action records through the evidence store.",
      }),
    );
  }

  const forbiddenNewAgent = sourceFile
    .getDescendantsOfKind(SyntaxKind.NewExpression)
    .some((expression) => expression.getExpression().getText() === "AgentService");
  if (forbiddenNewAgent) {
    findings.push(
      createFinding({
        lawId: LAW_ID,
        file: relativeFilePath,
        line: 1,
        severity: "error",
        message: "Agent runtime owner must not create nested AgentService instances.",
      }),
    );
  }

  phases.push(
    createPhase(
      "forbidden-shape",
      findings.length === forbiddenPhaseStart ? "PASS" : "CODE VIOLATION",
      findings.length === forbiddenPhaseStart,
      findings.length === forbiddenPhaseStart
        ? "Agent runtime avoids forbidden nested service fan-out and preserves record helpers."
        : "Agent runtime contains forbidden nested owner or missing action-record persistence.",
    ),
  );

  const boundaryPhaseStart = findings.length;
  const agentClassName = agentClass.getNameNode();
  const agentReferencePaths = agentClassName ? getReferencePaths(agentClassName) : [];
  const disallowedAgentReferences = agentReferencePaths.filter(
    (referencePath) => referencePath !== AGENT_RUNTIME_FILE && referencePath !== WORKBENCH_FILE,
  );
  if (disallowedAgentReferences.length > 0) {
    findings.push(
      createFinding({
        lawId: LAW_ID,
        file: disallowedAgentReferences[0] ?? relativeFilePath,
        line: 1,
        severity: "error",
        message: "AgentService is referenced outside its allowed runtime boundary.",
        detail: disallowedAgentReferences.join(", "),
      }),
    );
  }

  const executeMethodName = executeMethod.getNameNode();
  if (!Node.isIdentifier(executeMethodName)) {
    findings.push(
      createFinding({
        lawId: LAW_ID,
        file: relativeFilePath,
        line: getNodeLine(executeMethod),
        severity: "error",
        message: "executeCurrentTask must remain an identifier-backed private method for reference-bound enforcement.",
      }),
    );
  } else {
    const executeMethodRefs = executeMethodName.findReferencesAsNodes();
    const invalidExecuteRefs = executeMethodRefs.filter(
      (referenceNode) => referenceNode !== executeMethodName && !isInsideNamedMethod(referenceNode, "startOrResumeTask"),
    );
    if (invalidExecuteRefs.length > 0) {
      findings.push(
        createFinding({
          lawId: LAW_ID,
          file: toRelativeSourcePath(invalidExecuteRefs[0]?.getSourceFile() ?? sourceFile),
          line: getNodeLine(invalidExecuteRefs[0] ?? executeMethod),
          severity: "error",
          message: "executeCurrentTask must not be invoked outside the startOrResumeTask runtime owner path.",
        }),
      );
    }
  }

  phases.push(
    createPhase(
      "boundary-attack",
      findings.length === boundaryPhaseStart ? "PASS" : "CODE VIOLATION",
      findings.length === boundaryPhaseStart,
      findings.length === boundaryPhaseStart
        ? "Agent runtime authority stays inside AgentService and the local workbench entrypoint."
        : "Agent runtime authority is referenced outside the allowed owner boundary.",
    ),
  );

  const antiEscapePhaseStart = findings.length;
  const agentSourceFiles = project.getSourceFiles().filter((candidateSourceFile) => {
    const candidateRelativePath = toRelativeSourcePath(candidateSourceFile);
    return candidateRelativePath.startsWith("src/features/agent/");
  });

  for (const agentSourceFile of agentSourceFiles) {
    const anyKeyword = agentSourceFile.getFirstDescendantByKind(SyntaxKind.AnyKeyword);
    if (anyKeyword) {
      findings.push(
        createFinding({
          lawId: LAW_ID,
          file: toRelativeSourcePath(agentSourceFile),
          line: getNodeLine(anyKeyword),
          severity: "error",
          message: "Agent runtime must not use any escapes.",
        }),
      );
    }

    const invalidAsExpression = agentSourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).find((asExpression) => {
      const targetTypeNode = asExpression.getTypeNode();
      const targetTypeText = targetTypeNode?.getText();
      if (targetTypeText === "any") {
        return true;
      }

      const innerExpression = asExpression.getExpression();
      if (Node.isAsExpression(innerExpression)) {
        return innerExpression.getTypeNode()?.getText() === "unknown";
      }

      return false;
    });
    if (invalidAsExpression) {
      findings.push(
        createFinding({
          lawId: LAW_ID,
          file: toRelativeSourcePath(agentSourceFile),
          line: getNodeLine(invalidAsExpression),
          severity: "error",
          message: "Agent runtime must not hide boundary violations with any or unknown casts.",
        }),
      );
    }

    const dynamicImportCall = agentSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find(
      (callExpression) => callExpression.getExpression().getKind() === SyntaxKind.ImportKeyword,
    );
    if (dynamicImportCall) {
      findings.push(
        createFinding({
          lawId: LAW_ID,
          file: toRelativeSourcePath(agentSourceFile),
          line: getNodeLine(dynamicImportCall),
          severity: "error",
          message: "Agent runtime must not hide owner behavior behind dynamic import.",
        }),
      );
    }

    const requireCall = agentSourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
      const expression = callExpression.getExpression();
      return Node.isIdentifier(expression) && expression.getText() === "require";
    });
    if (requireCall) {
      findings.push(
        createFinding({
          lawId: LAW_ID,
          file: toRelativeSourcePath(agentSourceFile),
          line: getNodeLine(requireCall),
          severity: "error",
          message: "Agent runtime must not hide owner behavior behind require().",
        }),
      );
    }
  }

  phases.push(
    createPhase(
      "anti-escape",
      findings.length === antiEscapePhaseStart ? "PASS" : "CODE VIOLATION",
      findings.length === antiEscapePhaseStart,
      findings.length === antiEscapePhaseStart
        ? "Agent runtime code avoids any-casts, dynamic imports, and require-based escape hatches."
        : "Agent runtime code contains anti-escape violations.",
    ),
  );

  return {
    findings,
    phases,
  };
};