import { readFileSync } from "node:fs";

import { SyntaxKind, type SourceFile } from "ts-morph";
import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../../shared/paths.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const forbiddenAdjudicationTerms = [
  "decideImportance",
  "filterImportant",
  "compactForJudgment",
  "summarizeOnly",
  "dropUnparsed",
] as const;

const hasText = (repoPath: string, value: string): boolean =>
  readFileSync(resolveFromRepo(repoPath), "utf8").includes(value);

export const inspectNoDeadCodeAdjudication = (input: {
  sourceFiles: readonly SourceFile[];
  fullCaseFileFile: SourceFile | undefined;
  finalizationFile: SourceFile | undefined;
  parserSupportFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const sourceFile of input.sourceFiles) {
    const repoPath = getRepoSourcePath(sourceFile);
    input.inspectedFiles.add(repoPath);
    const strings = sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralValue());
    const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => identifier.getText());
    const found = forbiddenAdjudicationTerms.filter((term) =>
      strings.some((value) => value.includes(term))
      || identifiers.some((value) => value.includes(term)),
    );
    if (found.length === 0) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/no-dead-code-adjudication",
      lawId: input.lawId,
      filePath: repoPath,
      message: `Runtime content adjudication term remains: ${found.join(", ")}.`,
    }));
  }

  const requiredMarkers = [
    {
      file: "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file.ts",
      marker: "parse_failed_raw_available",
      message: "Full case file must preserve parse-failed raw responses.",
    },
    {
      file: "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file.ts",
      marker: "rawResponseText",
      message: "Full case file must include raw response text.",
    },
    {
      file: "src/plugins/deep-research-analysis/deep-research-analysis.parser-support.ts",
      marker: "raw_text_preserved",
      message: "Parser support must keep raw text when structured parsing fails.",
    },
  ] as const;
  for (const check of requiredMarkers) {
    input.inspectedFiles.add(check.file);
    if (hasText(check.file, check.marker)) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/no-dead-code-adjudication-marker",
      lawId: input.lawId,
      filePath: check.file,
      message: check.message,
    }));
  }
};
