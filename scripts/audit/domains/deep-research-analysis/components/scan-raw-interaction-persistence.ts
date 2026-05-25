import { SyntaxKind, type SourceFile } from "ts-morph";
import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const hasIdentifier = (sourceFile: SourceFile | undefined, value: string): boolean =>
  Boolean(sourceFile?.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === value));

export const inspectRawInteractionPersistence = (input: {
  recordContractsFile: SourceFile | undefined;
  recordInteractionOpsFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const check of [
    { sourceFile: input.recordContractsFile, filePath: "src/plugins/deep-research-analysis/deep-research-analysis.record-contracts.ts", identifiers: ["renderedPromptText", "rawResponseText", "rawResponseHash", "parseStatus"] },
    { sourceFile: input.recordInteractionOpsFile, filePath: "src/plugins/deep-research-analysis/deep-research-analysis.record-interaction-ops.ts", identifiers: ["createInteraction", "rawResponseText", "rawResponseHash", "parseStatus"] },
  ]) {
    if (check.sourceFile) input.inspectedFiles.add(getRepoSourcePath(check.sourceFile));
    const missing = check.identifiers.filter((identifier) => !hasIdentifier(check.sourceFile, identifier));
    if (missing.length === 0) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/raw-interaction-persistence",
      lawId: input.lawId,
      filePath: check.filePath,
      message: `Deep Research raw interaction persistence is missing: ${missing.join(", ")}.`,
    }));
  }
};
