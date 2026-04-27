import { readTextFile } from "../../core/filesystem.js";
import { createFinding } from "../../core/result.js";
import { toRepoRelativePath } from "../../core/paths.js";
import type { Finding, FindingSeverity } from "../../core/schema.js";

interface PatternRule {
  lawId: string;
  severity: FindingSeverity;
  pattern: RegExp;
  message: string;
  detail?: string;
}

export const scanFilesForPatterns = async (
  filePaths: string[],
  rules: PatternRule[],
): Promise<Finding[]> => {
  const findings: Finding[] = [];

  for (const filePath of filePaths) {
    const content = await readTextFile(filePath);
    for (const rule of rules) {
      const match = rule.pattern.exec(content);
      if (!match || typeof match.index !== "number") {
        continue;
      }

      const line = content.slice(0, match.index).split("\n").length;
      const detail = rule.detail;
      findings.push(
        createFinding({
          lawId: rule.lawId,
          file: toRepoRelativePath(filePath),
          line,
          severity: rule.severity,
          message: rule.message,
          ...(detail ? { detail } : {}),
        }),
      );
    }
  }

  return findings;
};