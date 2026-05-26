import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { requireAstMarker, requireIdentifier, requireNamedImport } from "./deep-research-ui-ast.js";

export const inspectDeepResearchPromptBundleUi = (input: {
  context: InspectorContext;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  const contractsFile = input.context.project.getSourceFile("src/app/workbench-deep-research-client-contracts.ts");
  const sharedFile = input.context.project.getSourceFile("src/app/workbench-deep-research-client-shared.ts");
  const caseReaderFile = input.context.project.getSourceFile("src/app/workbench-deep-research-client-case-reader.ts");

  requireIdentifier({
    findings: input.findings,
    inspectedFiles: input.inspectedFiles,
    sourceFile: contractsFile,
    lawId: input.lawId,
    checkId: "local-app-shell/deep-research-promptbundle-contract",
    identifierName: "promptBundle",
  });

  requireNamedImport({
    findings: input.findings,
    inspectedFiles: input.inspectedFiles,
    sourceFile: sharedFile,
    lawId: input.lawId,
    checkId: "local-app-shell/deep-research-promptbundle-shared",
    symbolName: "deepResearchClientCaseReaderRuntime",
    moduleSuffix: "./workbench-deep-research-client-case-reader.js",
  });

  for (const marker of [
    "renderPromptBundleDetails",
    "Final Adjudication PromptBundle",
    "HTML Report PromptBundle",
  ]) {
    requireAstMarker({
      findings: input.findings,
      inspectedFiles: input.inspectedFiles,
      sourceFile: caseReaderFile,
      lawId: input.lawId,
      checkId: "local-app-shell/deep-research-promptbundle-renderer",
      marker,
    });
  }
};