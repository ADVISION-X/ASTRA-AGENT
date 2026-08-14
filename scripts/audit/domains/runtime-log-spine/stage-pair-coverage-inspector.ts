import { existsSync } from "node:fs";
import { SyntaxKind, Node, type CallExpression, type Expression, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { resolveCallsInSourceFile } from "./ast/ast-call-resolver.js";
import { getPropertyInitializer, getStringLiteralProperty, hasProperty } from "./ast/ast-object-literal-reader.js";
import { RuntimeLogSpineLaw, RUNTIME_LOG_REQUIRED_FILES, type RuntimeLogSpineFinding } from "./constants.js";
import { isRuntimeLogLawSourcePath } from "./runtime-log-scope.js";
const requiredStageMethods = ["start", "complete", "fail", "skip", "reviewRequired"] as const;
const requiredTerminalTokens = ["durationMs", "status", "reason", "failureClass", "retryable", "terminal", "recoveryPolicy"] as const;

const appendMissingRequiredRuntimeFileFindings = (findings: RuntimeLogSpineFinding[]): void => {
  for (const filePath of RUNTIME_LOG_REQUIRED_FILES) {
    if (existsSync(resolveFromRepo(filePath))) continue;
    findings.push({
      checkId: "runtime-log-spine/required-runtime-file",
      lawId: RuntimeLogSpineLaw.STAGE_PAIR,
      file: filePath,
      line: 1,
      severity: "fatal",
      message: "mandatory stage logging pair infrastructure is missing",
      hint: "Implement trace-context, event-factory, stage-logger, failure classes, redaction, and debug bundle files under src/lib/runtime-logs.",
    });
  }
};

type ResolvedRuntimeCall = ReturnType<typeof resolveCallsInSourceFile>[number];

type ResolvedStageCall = {
  resolvedCall: ResolvedRuntimeCall;
  callNode: CallExpression;
};

const resolveStageHandleName = (callNode: CallExpression): string | null => {
  const expression = callNode.getExpression();
  if (!Node.isPropertyAccessExpression(expression) && !Node.isElementAccessExpression(expression)) {
    return null;
  }
  const receiver = expression.getExpression();
  return Node.isIdentifier(receiver) ? astIdentifierName(receiver) ?? null : null;
};

const resolveStageHandleBinding = (callNode: CallExpression): string | null => {
  const variableDeclaration = callNode.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  if (!variableDeclaration || variableDeclaration.getInitializer() !== callNode) {
    return null;
  }
  const nameNode = variableDeclaration.getNameNode();
  return Node.isIdentifier(nameNode) ? astIdentifierName(nameNode) ?? null : null;
};

const collectResolvedStageCalls = (sourceFile: SourceFile, repoPath: string): ResolvedStageCall[] => {
  const callQueue = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  return resolveCallsInSourceFile(sourceFile, repoPath)
    .filter((resolvedCall) => resolvedCall.kind === "stage-start" || resolvedCall.kind === "stage-terminal")
    .flatMap((resolvedCall) => {
      const callIndex = callQueue.findIndex((callNode) => callNode.getStart() === resolvedCall.callStart);
      if (callIndex < 0) {
        return [];
      }
      const [callNode] = callQueue.splice(callIndex, 1);
      return callNode ? [{ resolvedCall, callNode }] : [];
    });
};

const appendStartCallPairFindings = (input: {
  findings: RuntimeLogSpineFinding[];
  repoPath: string;
  startCalls: ResolvedStageCall[];
  terminalCalls: ResolvedStageCall[];
}): void => {
  const handleToStageNames = new Map<string, Set<string>>();
  const stagesWithTerminal = new Set<string>();

  for (const startCall of input.startCalls) {
    const startObject = startCall.resolvedCall.objectLiteralArg;
    const stageName = startObject ? getStringLiteralProperty(startObject, "stageName") : null;
    const handleName = resolveStageHandleBinding(startCall.callNode);
    if (stageName && handleName) {
      const knownStageNames = handleToStageNames.get(handleName) ?? new Set<string>();
      knownStageNames.add(stageName);
      handleToStageNames.set(handleName, knownStageNames);
    }
  }

  for (const terminalCall of input.terminalCalls) {
    const handleName = resolveStageHandleName(terminalCall.callNode);
    const stageNames = handleName ? handleToStageNames.get(handleName) : undefined;
    if (stageNames) {
      stageNames.forEach((stageName) => stagesWithTerminal.add(stageName));
    }
  }

  for (const startCall of input.startCalls) {
    const startObject = startCall.resolvedCall.objectLiteralArg;
    const stageName = startObject ? getStringLiteralProperty(startObject, "stageName") : null;
    if (!stageName || !stagesWithTerminal.has(stageName)) {
      input.findings.push({
        checkId: "runtime-log-spine/stage-start-terminal-pair",
        lawId: RuntimeLogSpineLaw.STAGE_PAIR,
        file: input.repoPath,
        line: startCall.resolvedCall.line,
        severity: "fatal",
        message: "stage has no proven started/terminal pair",
        hint: "Create a stage handle with stageLogger.start and close every success, failure, skip, review_required and early return path.",
      });
    }
  }
};

const appendTerminalContractFindings = (input: {
  findings: RuntimeLogSpineFinding[];
  repoPath: string;
  terminalCalls: ResolvedStageCall[];
}): void => {
  const isRuntimeFailureClassExpression = (expression: Expression | null | undefined): boolean => {
    if (!expression) return false;
    if (Node.isParenthesizedExpression(expression)) {
      return isRuntimeFailureClassExpression(expression.getExpression());
    }
    if (Node.isPropertyAccessExpression(expression)) {
      return Node.isIdentifier(expression.getExpression())
        && astIdentifierName(expression.getExpression()) === "RuntimeFailureClass";
    }
    return Node.isConditionalExpression(expression)
      && isRuntimeFailureClassExpression(expression.getWhenTrue())
      && isRuntimeFailureClassExpression(expression.getWhenFalse());
  };

  for (const terminalCall of input.terminalCalls) {
    const objectLiteral = terminalCall.resolvedCall.objectLiteralArg;
    if (!objectLiteral) continue;
    const missingTerminal = terminalCall.resolvedCall.symbolName === "complete"
      ? ["durationMs"].filter((field) => !hasProperty(objectLiteral, field))
      : ["reason", "failureClass"].filter((field) => !hasProperty(objectLiteral, field));
    const failureClass = getPropertyInitializer(objectLiteral, "failureClass");
    const failureClassOk = terminalCall.resolvedCall.symbolName === "complete" || isRuntimeFailureClassExpression(failureClass);
    if (missingTerminal.length === 0 && failureClassOk) continue;
    input.findings.push({
      checkId: "runtime-log-spine/stage-terminal-contract",
      lawId: RuntimeLogSpineLaw.STAGE_PAIR,
      file: input.repoPath,
      line: terminalCall.resolvedCall.line,
      severity: "fatal",
      message: "stage has no proven started/terminal pair",
      hint: "Terminal stage calls must include durationMs where applicable and failureClass/reason for fail/skip/reviewRequired.",
    });
  }
};

const appendSourceFileStagePairFindings = (input: {
  findings: RuntimeLogSpineFinding[];
  repoPath: string;
  sourceFile: SourceFile;
}): void => {
  const calls = collectResolvedStageCalls(input.sourceFile, input.repoPath);
  const startCalls = calls.filter((call) => call.resolvedCall.kind === "stage-start");
  const terminalCalls = calls.filter((call) => call.resolvedCall.kind === "stage-terminal");
  appendStartCallPairFindings({
    findings: input.findings,
    repoPath: input.repoPath,
    startCalls,
    terminalCalls,
  });
  appendTerminalContractFindings({ findings: input.findings, repoPath: input.repoPath, terminalCalls });
};

const appendStageLoggerContractFindings = (context: InspectorContext, findings: RuntimeLogSpineFinding[]): void => {
  const stageLoggerPath = "src/lib/runtime-logs/stage-logger.ts";
  const stageLogger = context.project.getSourceFile(resolveFromRepo(stageLoggerPath));
  if (!stageLogger) {
    return;
  }
  const stageHandleMethods = new Set(stageLogger.getTypeAlias("RuntimeStageHandle")
    ?.getTypeNode()?.getDescendantsOfKind(SyntaxKind.MethodSignature).map((method) => method.getName()) ?? []);
  const stageLoggerMethods = new Set(stageLogger.getTypeAlias("RuntimeStageLogger")
    ?.getTypeNode()?.getDescendantsOfKind(SyntaxKind.MethodSignature).map((method) => method.getName()) ?? []);
  for (const method of requiredStageMethods) {
    if ((method === "start" ? stageLoggerMethods : stageHandleMethods).has(method)) continue;
    findings.push({
      checkId: "runtime-log-spine/stage-logger-method",
      lawId: RuntimeLogSpineLaw.STAGE_PAIR,
      file: stageLoggerPath,
      line: 1,
      severity: "fatal",
      message: "mandatory stage logging pair is missing",
      hint: "Stage logger must support start plus complete/fail/skip/reviewRequired terminal methods.",
    });
  }
  const emitTerminal = stageLogger.getVariableDeclaration("emitTerminalStageEvent")?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const terminalFields = new Set(emitTerminal?.getParameters()[0]?.getTypeNode()
    ?.getDescendantsOfKind(SyntaxKind.PropertySignature).map((property) => property.getName()) ?? []);
  for (const token of requiredTerminalTokens) {
    if (terminalFields.has(token)) continue;
    findings.push({
      checkId: "runtime-log-spine/stage-terminal-contract",
      lawId: RuntimeLogSpineLaw.STAGE_PAIR,
      file: stageLoggerPath,
      line: emitTerminal?.getStartLineNumber() ?? 1,
      severity: "fatal",
      message: "mandatory stage logging pair is missing terminal metadata",
      hint: "Each terminal method must emit durationMs, status, reason where applicable, failureClass, retryable, terminal and recoveryPolicy.",
    });
  }
};

export const collectStagePairCoverageFindings = (context: InspectorContext): {
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
  stageCoveragePercent: number;
} => {
  const findings: RuntimeLogSpineFinding[] = [];
  const inspectedFiles: string[] = [...RUNTIME_LOG_REQUIRED_FILES];
  appendMissingRequiredRuntimeFileFindings(findings);

  for (const sourceFile of context.project.getSourceFiles()) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!isRuntimeLogLawSourcePath(repoPath)) continue;
    inspectedFiles.push(repoPath);
    appendSourceFileStagePairFindings({ findings, repoPath, sourceFile });
  }

  appendStageLoggerContractFindings(context, findings);

  const totalChecks = RUNTIME_LOG_REQUIRED_FILES.length + requiredStageMethods.length + requiredTerminalTokens.length + 1;
  const stageCoveragePercent = Math.max(0, Math.round(((totalChecks - findings.length) / totalChecks) * 100));
  return { findings, inspectedFiles: [...new Set(inspectedFiles)].sort(), stageCoveragePercent };
};
