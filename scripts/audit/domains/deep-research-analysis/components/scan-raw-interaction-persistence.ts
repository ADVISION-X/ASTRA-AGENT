import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const markInspected = (inspectedFiles: Set<string>, sourceFiles: readonly (SourceFile | undefined)[]): void => {
  sourceFiles.forEach((sourceFile) => {
    if (sourceFile) {
      inspectedFiles.add(getRepoSourcePath(sourceFile));
    }
  });
};

export const inspectRawInteractionPersistence = (input: {
  promptExchangeStageSupportFile: SourceFile | undefined;
  recordContractsFile: SourceFile | undefined;
  recordInteractionOpsFile: SourceFile | undefined;
  acceptanceFile: SourceFile | undefined;
  ciFullFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  markInspected(input.inspectedFiles, [
    input.promptExchangeStageSupportFile,
    input.recordContractsFile,
    input.recordInteractionOpsFile,
    input.acceptanceFile,
    input.ciFullFile,
  ]);

  const createFailedInteractionRecord = input.promptExchangeStageSupportFile?.getVariableDeclaration("createFailedInteractionRecord");
  const failedInteractionCall = createFailedInteractionRecord
    ?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => call.getExpression().getText().endsWith("store.createInteraction"));
  const failedInteractionPayload = failedInteractionCall?.getArguments()[0];
  if (!Node.isObjectLiteralExpression(failedInteractionPayload)) {
    input.findings.push(createFinding({
      checkId: "deep-research/raw-interaction-failed-persist",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompt-exchange-stage-support.ts",
      message: "Failed interaction persistence must use an object literal createInteraction payload.",
    }));
  } else {
    for (const propertyName of ["renderedPromptText", "rawResponseText", "rawResponseHash", "parseStatus"]) {
      if (failedInteractionPayload.getProperty(propertyName)) {
        continue;
      }
      input.findings.push(createFinding({
        checkId: "deep-research/raw-interaction-failed-property",
        lawId: input.lawId,
        filePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompt-exchange-stage-support.ts",
        message: `Failed interaction persistence must include ${propertyName}.`,
      }));
    }
  }

  const interactionSchema = input.recordContractsFile?.getVariableDeclaration("ResearchInteractionSchema");
  const schemaPayload = interactionSchema?.getInitializer()?.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)[0];
  if (!Node.isObjectLiteralExpression(schemaPayload)) {
    input.findings.push(createFinding({
      checkId: "deep-research/raw-interaction-schema",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.record-contracts.ts",
      message: "ResearchInteractionSchema must stay AST-visible for raw interaction sovereignty.",
    }));
  } else {
    for (const propertyName of ["renderedPromptText", "rawResponseText", "rawResponseHash", "parseStatus"]) {
      if (schemaPayload.getProperty(propertyName)) {
        continue;
      }
      input.findings.push(createFinding({
        checkId: "deep-research/raw-interaction-schema-property",
        lawId: input.lawId,
        filePath: "src/plugins/deep-research-analysis/deep-research-analysis.record-contracts.ts",
        message: `ResearchInteractionSchema must include ${propertyName}.`,
      }));
    }
  }

  const createInteractionText = input.recordInteractionOpsFile?.getVariableDeclaration("createInteraction")?.getText() ?? "";
  const renderedPromptTextColumn = input.recordInteractionOpsFile
    ?.getVariableDeclaration("renderedPromptTextColumn")
    ?.getInitializerIfKind(SyntaxKind.StringLiteral)
    ?.getLiteralValue();
  if (renderedPromptTextColumn !== "rendered_prompt_text") {
    input.findings.push(createFinding({
      checkId: "deep-research/raw-interaction-sql-marker",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.record-interaction-ops.ts",
      message: "Interaction persistence must bind rendered_prompt_text through the lawful owner column constant.",
    }));
  }
  for (const marker of ["raw_response_text", "raw_response_hash", "parse_status"]) {
    if (createInteractionText.includes(marker)) {
      continue;
    }
    input.findings.push(createFinding({
      checkId: "deep-research/raw-interaction-sql-marker",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.record-interaction-ops.ts",
      message: `Interaction persistence SQL must include ${marker}.`,
    }));
  }

  const acceptanceText = input.acceptanceFile?.getFullText() ?? "";
  if (!acceptanceText.includes("createFailedInteractionRecord") || !acceptanceText.includes("rawResponseText")) {
    input.findings.push(createFinding({
      checkId: "deep-research/raw-interaction-acceptance",
      lawId: input.lawId,
      filePath: "scripts/acceptance/deep-research-raw-response-sovereignty.acceptance.ts",
      message: "Raw response sovereignty acceptance must inspect AST-visible failed interaction persistence and raw fields.",
    }));
  }

  if (!(input.ciFullFile?.getFullText() ?? "").includes("acceptance:deep-research-raw-response-sovereignty")) {
    input.findings.push(createFinding({
      checkId: "deep-research/raw-interaction-ci",
      lawId: input.lawId,
      filePath: "scripts/audit/ci-full.ts",
      message: "ci:full must execute acceptance:deep-research-raw-response-sovereignty.",
    }));
  }
};