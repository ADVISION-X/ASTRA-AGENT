import { createFinding } from "../../core/result.js";
import { toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";
import type { PatternRule } from "./pattern-scan-rule.js";

const getMatchedLine = (content: string, matchIndex: number): number =>
  content.slice(0, matchIndex).split("\n").length;

export const createPatternFinding = (
  filePath: string,
  content: string,
  rule: PatternRule,
): Finding | null => {
  const match = rule.pattern.exec(content);
  if (!match || typeof match.index !== "number") {
    return null;
  }

  return createFinding({
    lawId: rule.lawId,
    file: toRepoRelativePath(filePath),
    line: getMatchedLine(content, match.index),
    severity: rule.severity,
    message: rule.message,
    ...(rule.detail ? { detail: rule.detail } : {}),
  });
};