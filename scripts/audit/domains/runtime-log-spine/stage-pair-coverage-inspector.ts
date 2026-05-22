import { existsSync } from "node:fs";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { RuntimeLogSpineLaw, RUNTIME_LOG_REQUIRED_FILES, type RuntimeLogSpineFinding } from "./constants.js";
import { findLine, readRepoFile } from "./source-read.js";

const requiredStageMethods = ["start(", "complete(", "fail(", "skip(", "reviewRequired("] as const;
const requiredTerminalTokens = ["durationMs", "status", "reason", "failureClass", "retryable", "terminal", "recoveryPolicy"] as const;

export const collectStagePairCoverageFindings = (_context: InspectorContext): {
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
  stageCoveragePercent: number;
} => {
  const findings: RuntimeLogSpineFinding[] = [];
  const inspectedFiles = [...RUNTIME_LOG_REQUIRED_FILES];
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

  const stageLogger = readRepoFile("src/lib/runtime-logs/stage-logger.ts");
  if (stageLogger) {
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
  }

  const totalChecks = RUNTIME_LOG_REQUIRED_FILES.length + requiredStageMethods.length + requiredTerminalTokens.length;
  const stageCoveragePercent = Math.max(0, Math.round(((totalChecks - findings.length) / totalChecks) * 100));
  return { findings, inspectedFiles, stageCoveragePercent };
};
