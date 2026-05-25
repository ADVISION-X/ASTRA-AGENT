import assert from "node:assert/strict";
import { Project, SyntaxKind, Node } from "ts-morph";

import {
  createDeepResearchFullCaseFixture,
  disposeDeepResearchFullCaseFixture,
} from "./deep-research-full-case-file-support.js";

const project = new Project({ tsConfigFilePath: "tsconfig.json" });

const requireSourceFile = (filePath: string) => {
  const sourceFile = project.getSourceFile(filePath);
  assert(sourceFile, `${filePath} must be visible to ts-morph.`);
  return sourceFile;
};

const promptExchangeSupportFile = requireSourceFile(
  "src/plugins/deep-research-analysis/deep-research-analysis.prompt-exchange-stage-support.ts",
);
const recordContractsFile = requireSourceFile(
  "src/plugins/deep-research-analysis/deep-research-analysis.record-contracts.ts",
);
const recordInteractionOpsFile = requireSourceFile(
  "src/plugins/deep-research-analysis/deep-research-analysis.record-interaction-ops.ts",
);

const createFailedInteractionRecord = promptExchangeSupportFile.getVariableDeclaration("createFailedInteractionRecord");
assert(createFailedInteractionRecord, "createFailedInteractionRecord must remain an AST-visible owner declaration.");
const failedInteractionCall = createFailedInteractionRecord
  ?.getDescendantsOfKind(SyntaxKind.CallExpression)
  .find((call) => call.getExpression().getText().endsWith("store.createInteraction"));
assert(failedInteractionCall, "createFailedInteractionRecord must persist a failed interaction record.");
const failedInteractionPayload = failedInteractionCall?.getArguments()[0];
assert(Node.isObjectLiteralExpression(failedInteractionPayload), "Failed interaction persistence must use an object literal payload.");
for (const propertyName of ["renderedPromptText", "rawResponseText", "rawResponseHash", "parseStatus"]) {
  assert(failedInteractionPayload.getProperty(propertyName), `Failed interaction persistence must include ${propertyName}.`);
}

const interactionSchema = recordContractsFile.getVariableDeclaration("ResearchInteractionSchema");
const schemaInitializer = interactionSchema?.getInitializer();
const schemaPayload = schemaInitializer?.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)[0];
assert(Node.isObjectLiteralExpression(schemaPayload), "ResearchInteractionSchema must remain an AST-visible object schema.");
for (const propertyName of ["renderedPromptText", "rawResponseText", "rawResponseHash", "parseStatus"]) {
  assert(schemaPayload.getProperty(propertyName), `ResearchInteractionSchema must include ${propertyName}.`);
}

const createInteractionFunction = recordInteractionOpsFile.getVariableDeclaration("createInteraction");
assert(createInteractionFunction, "record interaction ops must expose createInteraction.");
const createInteractionText = createInteractionFunction?.getText() ?? "";
assert.equal(
  recordInteractionOpsFile.getVariableDeclaration("renderedPromptTextColumn")?.getInitializerIfKind(SyntaxKind.StringLiteral)?.getLiteralValue(),
  "rendered_prompt_text",
);
for (const sqlMarker of ["raw_response_text", "raw_response_hash", "parse_status"]) {
  assert.match(createInteractionText, new RegExp(sqlMarker.replace(/_/gu, "_"), "u"));
}

const fixture = createDeepResearchFullCaseFixture();

try {
  assert.equal(fixture.fullCaseFile.failedButRawAvailableInteractions.length, 1);
  const failedInteraction = fixture.fullCaseFile.failedButRawAvailableInteractions[0];
  assert.equal(failedInteraction?.parseStatus, "parse_failed_raw_available");
  assert.match(failedInteraction?.renderedPromptText ?? "", /Independent analysis prompt for Q2/u);
  assert.match(failedInteraction?.rawResponseText ?? "", /schema parsing failed/u);
  assert.match(failedInteraction?.rawResponseHash ?? "", /^sha256:/u);
} finally {
  disposeDeepResearchFullCaseFixture(fixture);
}

process.stdout.write("[ACCEPTANCE][deep-research-raw-response-sovereignty] PASS\n");