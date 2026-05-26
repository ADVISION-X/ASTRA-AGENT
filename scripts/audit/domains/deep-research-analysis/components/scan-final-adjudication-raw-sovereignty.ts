import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const hasIdentifier = (sourceFile: SourceFile | undefined, name: string): boolean =>
  !!sourceFile?.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === name);

const oldFinalSchemaName = "DeepResearch" + "FinalReportSchema";

export const inspectFinalAdjudicationRawSovereignty = (input: {
  resultFile: SourceFile | undefined;
  parserFile: SourceFile | undefined;
  finalizationFile: SourceFile | undefined;
  recordContractsFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const sourceFile of [input.resultFile, input.parserFile, input.finalizationFile, input.recordContractsFile]) {
    if (sourceFile) input.inspectedFiles.add(getRepoSourcePath(sourceFile));
  }

  if (!hasIdentifier(input.resultFile, "DeepResearchFinalAdjudicationRecordSchema")) {
    input.findings.push(createFinding({
      checkId: "deep-research/final-raw/record-schema",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.parser.ts",
      message: "DeepResearchFinalAdjudicationRecordSchema must be the final adjudication record contract.",
    }));
  }
  for (const sourceFile of [input.resultFile, input.parserFile, input.finalizationFile, input.recordContractsFile]) {
    if (!sourceFile) continue;
    if (hasIdentifier(sourceFile, oldFinalSchemaName)) {
      input.findings.push(createFinding({
        checkId: "deep-research/final-raw/old-final-report-schema",
        lawId: input.lawId,
        filePath: getRepoSourcePath(sourceFile),
        message: "The old final report schema must not remain as final adjudication primary schema.",
      }));
    }
  }
  for (const sourceFile of [input.resultFile, input.parserFile]) {
    if (!sourceFile) continue;
    if (hasIdentifier(sourceFile, "rawFinalAnswerText")) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/final-raw/missing-raw-final-answer",
      lawId: input.lawId,
      filePath: getRepoSourcePath(sourceFile),
      message: "Final adjudication path must persist rawFinalAnswerText.",
    }));
  }
};
