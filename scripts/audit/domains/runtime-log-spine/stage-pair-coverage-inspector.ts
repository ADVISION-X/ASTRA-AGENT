import { existsSync } from "node:fs";
import { SyntaxKind, Node, type SourceFile } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { resolveCallsInSourceFile } from "./ast/ast-call-resolver.js";
import { getPropertyInitializer, getStringLiteralProperty, hasProperty } from "./ast/ast-object-literal-reader.js";
import { RuntimeLogSpineLaw, RUNTIME_LOG_REQUIRED_FILES, type RuntimeLogSpineFinding } from "./constants.js";
import { isRuntimeLogLawSourcePath } from "./runtime-log-scope.js";
import { findLine, readRepoFile } from "./source-read.js";

const requiredStageMethods = ["start(", "complete(", "fail(", "skip(", "reviewRequired("] as const;
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

const hasTerminalCallInStartBlock = (input: {
  sourceFile: SourceFile;
  startCall: ReturnType<typeof resolveCallsInSourceFile>[number];
  terminalCalls: ReturnType<typeof resolveCallsInSourceFile>;
}): boolean => {
  const parentBlock = input.sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => call.getStartLineNumber() === input.startCall.line && call.getExpression().getText() === input.startCall.calleeText)
    ?.getFirstAncestorByKind(SyntaxKind.Block);
  return input.terminalCalls.some((terminalCall) => {
    if (parentBlock === undefined) return false;
    const callNode = input.sourceFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((candidate) => candidate.getStartLineNumber() === terminalCall.line && candidate.getExpression().getText() === terminalCall.calleeText);
    return callNode ? callNode.getStart() >= parentBlock.getStart() && callNode.getEnd() <= parentBlock.getEnd() : false;
  });
};

const appendStartCallPairFindings = (input: {
  findings: RuntimeLogSpineFinding[];
  repoPath: string;
  sourceFile: SourceFile;
  startCalls: ReturnType<typeof resolveCallsInSourceFile>;
  terminalCalls: ReturnType<typeof resolveCallsInSourceFile>;
}): void => {
  for (const startCall of input.startCalls) {
    const startObject = startCall.objectLiteralArg;
    const stageName = startObject ? getStringLiteralProperty(startObject, "stageName") : null;
    const hasTerminalInBlock = hasTerminalCallInStartBlock({ sourceFile: input.sourceFile, startCall, terminalCalls: input.terminalCalls });
    if (!stageName || !hasTerminalInBlock) {
      input.findings.push({
        checkId: "runtime-log-spine/stage-start-terminal-pair",
        lawId: RuntimeLogSpineLaw.STAGE_PAIR,
        file: input.repoPath,
        line: startCall.line,
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
  terminalCalls: ReturnType<typeof resolveCallsInSourceFile>;
}): void => {
  for (const terminalCall of input.terminalCalls) {
    const objectLiteral = terminalCall.objectLiteralArg;
    if (!objectLiteral) continue;
    const missingTerminal = terminalCall.symbolName === "complete"
      ? ["durationMs"].filter((field) => !hasProperty(objectLiteral, field))
      : ["reason", "failureClass"].filter((field) => !hasProperty(objectLiteral, field));
    const failureClass = getPropertyInitializer(objectLiteral, "failureClass");
    const failureClassOk = terminalCall.symbolName === "complete" || (failureClass && Node.isPropertyAccessExpression(failureClass) && failureClass.getExpression().getText() === "RuntimeFailureClass");
    if (missingTerminal.length === 0 && failureClassOk) continue;
    input.findings.push({
      checkId: "runtime-log-spine/stage-terminal-contract",
      lawId: RuntimeLogSpineLaw.STAGE_PAIR,
      file: input.repoPath,
      line: terminalCall.line,
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
  const calls = resolveCallsInSourceFile(input.sourceFile, input.repoPath);
  const startCalls = calls.filter((call) => call.kind === "stage-start");
  const terminalCalls = calls.filter((call) => call.kind === "stage-terminal");
  appendStartCallPairFindings({
    findings: input.findings,
    repoPath: input.repoPath,
    sourceFile: input.sourceFile,
    startCalls,
    terminalCalls,
  });
  appendTerminalContractFindings({ findings: input.findings, repoPath: input.repoPath, terminalCalls });
};

const appendStageLoggerContractFindings = (findings: RuntimeLogSpineFinding[]): void => {
  const stageLogger = readRepoFile("src/lib/runtime-logs/stage-logger.ts");
  if (!stageLogger) {
    return;
  }
  const text = stageLogger.text;
  for (const method of requiredStageMethods) {
    if (text.includes(method)) continue;
    findings.push({
      checkId: "runtime-log-spine/stage-logger-method",
      lawId: RuntimeLogSpineLaw.STAGE_PAIR,
      file: stageLogger.path,
      line: 1,
      severity: "fatal",
      message: "mandatory stage logging pair is missing",
      hint: "Stage logger must support start plus complete/fail/skip/reviewRequired terminal methods.",
    });
  }
  for (const token of requiredTerminalTokens) {
    if (text.includes(token)) continue;
    findings.push({
      checkId: "runtime-log-spine/stage-terminal-contract",
      lawId: RuntimeLogSpineLaw.STAGE_PAIR,
      file: stageLogger.path,
      line: findLine(text, "emitTerminalStageEvent"),
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

  appendStageLoggerContractFindings(findings);

  const totalChecks = RUNTIME_LOG_REQUIRED_FILES.length + requiredStageMethods.length + requiredTerminalTokens.length + 1;
  const stageCoveragePercent = Math.max(0, Math.round(((totalChecks - findings.length) / totalChecks) * 100));
  return { findings, inspectedFiles: [...new Set(inspectedFiles)].sort(), stageCoveragePercent };
};
