import { readTextFile } from "../../core/filesystem.js";
import type { Finding } from "../../core/schema.js";
import { createPatternFinding } from "./pattern-scan-finding.js";
import type { PatternRule } from "./pattern-scan-rule.js";

const scanSingleFileForPatterns = (filePath: string, content: string, rules: PatternRule[]): Finding[] =>
  rules
    .map((rule) => createPatternFinding(filePath, content, rule))
    .filter((finding): finding is Finding => Boolean(finding));

export const scanFilesForPatterns = async (
  filePaths: string[],
  rules: PatternRule[],
): Promise<Finding[]> => {
  const findings: Finding[] = [];

  for (const filePath of filePaths) {
    const content = await readTextFile(filePath);
    findings.push(...scanSingleFileForPatterns(filePath, content, rules));
  }

  return findings;
};