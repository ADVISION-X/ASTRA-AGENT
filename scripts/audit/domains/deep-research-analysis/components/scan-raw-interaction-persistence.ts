import { SyntaxKind, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../../shared/ast-node-identity.js";
import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const hasIdentifier = (sourceFile: SourceFile | undefined, name: string): boolean =>
  !!sourceFile?.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => astIdentifierName(identifier) === name);

export const inspectRawInteractionPersistence = (input: {
  fullCaseFileSchemaFile: SourceFile | undefined;
  fullCaseFileFile: SourceFile | undefined;
  fullCaseFileRenderFile: SourceFile | undefined;
  recordContractsFile: SourceFile | undefined;
  recordInteractionOpsFile: SourceFile | undefined;
  promptExchangeStageSupportFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const sourceFile of [
    input.fullCaseFileSchemaFile,
    input.fullCaseFileFile,
    input.fullCaseFileRenderFile,
    input.recordContractsFile,
    input.recordInteractionOpsFile,
    input.promptExchangeStageSupportFile,
  ]) {
    if (sourceFile) input.inspectedFiles.add(getRepoSourcePath(sourceFile));
  }

  for (const check of [
    {
      sourceFile: input.fullCaseFileSchemaFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file.ts",
      required: ["renderedPromptText", "rawResponseText", "rawResponseHash"],
      message: "Full case file schema must require renderedPromptText, rawResponseText, and rawResponseHash.",
    },
    {
      sourceFile: input.fullCaseFileFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file.ts",
      required: ["renderedPromptText", "rawResponseText", "rawResponseHash"],
      message: "Full case file builder must carry renderedPromptText, rawResponseText, and rawResponseHash.",
    },
    {
      sourceFile: input.fullCaseFileRenderFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file.ts",
      required: ["renderedPromptText", "rawResponseText", "rawResponseHash"],
      message: "Full case file renderer must expose renderedPromptText, rawResponseText, and rawResponseHash.",
    },
    {
      sourceFile: input.recordContractsFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.records.ts",
      required: ["renderedPromptText", "rawResponseText", "rawResponseHash"],
      message: "Record contracts must persist renderedPromptText, rawResponseText, and rawResponseHash.",
    },
    {
      sourceFile: input.recordInteractionOpsFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.record-interaction-ops.ts",
      required: ["renderedPromptText", "rawResponseText", "rawResponseHash"],
      message: "Interaction persistence must write renderedPromptText, rawResponseText, and rawResponseHash.",
    },
    {
      sourceFile: input.promptExchangeStageSupportFile,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompt-exchange-capture-stage.ts",
      required: ["createInteraction", "renderedPromptText", "rawResponseText", "rawResponseHash"],
      message: "Prompt exchange persistence must create interaction records with renderedPromptText, rawResponseText, and rawResponseHash.",
    },
  ] as const) {
    const ok = check.required.every((name) => hasIdentifier(check.sourceFile, name));
    if (ok) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/raw-interaction-persistence",
      lawId: input.lawId,
      filePath: check.filePath,
      message: check.message,
    }));
  }
};
