import assert from "node:assert/strict";

import { Node, Project, SyntaxKind, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

import {
  DEEP_RESEARCH_BUSINESS_PPT_ARTIFACT_CONTRACT_ID,
  businessPptArtifactSecretaryPrompt,
} from "../../src/plugins/deep-research-analysis/deep-research-analysis.ppt-artifact-prompt.js";
import {
  parseDeepResearchBusinessDeckOutlineResponseForFinalReport,
} from "../../src/plugins/deep-research-analysis/deep-research-analysis.deck-parser.js";
import {
  DeepResearchBusinessDeckOutlineSchema,
} from "../../src/plugins/deep-research-analysis/deep-research-analysis.deck-schema.js";

const project = new Project({ tsConfigFilePath: "tsconfig.json" });

const source = (filePath: string): SourceFile => {
  const file = project.getSourceFile(filePath);
  assert(file, `${filePath} must be available to ts-morph.`);
  return file;
};

const getArrowInitializer = (sourceFile: SourceFile, variableName: string) => {
  const declaration = sourceFile.getVariableDeclaration(variableName);
  const initializer = declaration?.getInitializer();
  return initializer && Node.isArrowFunction(initializer) ? initializer : null;
};

const getObjectLiteralArgument = (sourceFile: SourceFile, callName: string): ObjectLiteralExpression => {
  const callExpression = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => call.getExpression().getText() === callName);
  assert(callExpression, `${callName} must be called in ${sourceFile.getBaseName()}.`);
  const firstArgument = callExpression.getArguments()[0];
  assert(firstArgument && Node.isObjectLiteralExpression(firstArgument), `${callName} must receive an object literal.`);
  return firstArgument;
};

const readPropertyNames = (objectLiteral: ObjectLiteralExpression): string[] =>
  objectLiteral.getProperties().flatMap((property) =>
    Node.isPropertyAssignment(property)
      || Node.isShorthandPropertyAssignment(property)
      ? [property.getName()]
      : []);

const analysisRunnerFile = source("src/plugins/deep-research-analysis/deep-research-analysis.analysis-runner.ts");
const deckStageFile = source("src/plugins/deep-research-analysis/deep-research-analysis.deck-stage.ts");
const recordContractsFile = source("src/plugins/deep-research-analysis/deep-research-analysis.record-contracts.ts");
const recordsFile = source("src/plugins/deep-research-analysis/deep-research-analysis.records.ts");
const schemaFile = source("src/plugins/deep-research-analysis/deep-research-analysis.schema.ts");
const finalPackageFile = source("src/plugins/deep-research-analysis/deep-research-analysis.final-package.ts");

assert(
  businessPptArtifactSecretaryPrompt.promptId === "deep-research.business-ppt-artifact-secretary",
  "Business PPT prompt must expose the artifact secretary promptId.",
);
assert(
  businessPptArtifactSecretaryPrompt.promptVersion === "v1.0.0",
  "Business PPT prompt must stay on v1.0.0.",
);
assert(
  businessPptArtifactSecretaryPrompt.expectedOutputContract.contractId === DEEP_RESEARCH_BUSINESS_PPT_ARTIFACT_CONTRACT_ID,
  "Business PPT prompt must expose the required output contract id.",
);
assert(
  businessPptArtifactSecretaryPrompt.expectedOutputContract.format === "pptx_artifact",
  "Business PPT prompt must require a pptx artifact output.",
);
assert(
  typeof parseDeepResearchBusinessDeckOutlineResponseForFinalReport === "function",
  "Old deck outline parser must remain reachable only for local fallback support.",
);
assert(
  typeof DeepResearchBusinessDeckOutlineSchema.safeParse === "function",
  "Old deck outline schema must remain reachable only for local fallback support.",
);

assert(
  recordContractsFile.getFullText().includes("default_1_n_1_1"),
  "Record contracts must expose default_1_n_1_1 as the default commercial flow mode.",
);
assert(
  recordsFile.getFullText().includes('"default_1_n_1_1"'),
  "Record store must create new jobs on default_1_n_1_1.",
);
assert(
  finalPackageFile.getFullText().includes('z.literal("default_1_n_1_1")'),
  "Final package surface must preserve default_1_n_1_1.",
);

const schemaText = schemaFile.getFullText();
for (const stage of ["DECK_PPT_SEND", "DECK_PPT_CAPTURE", "DECK_PPT_ARTIFACT_DETECT", "DECK_PPT_DOWNLOAD", "DECK_PPT_PERSIST"] as const) {
  assert(schemaText.includes(stage), `Deep Research phase schema must include ${stage}.`);
}
assert(schemaText.includes('"deck"'), "Deep Research interaction phases must include deck.");

const runAnalysisPhases = getArrowInitializer(analysisRunnerFile, "runAnalysisPhases");
assert(runAnalysisPhases, "runAnalysisPhases must exist.");
const runnerText = runAnalysisPhases.getText();
const finalReportIndex = runnerText.indexOf("runFinalReportPhase");
const businessDeckIndex = runnerText.indexOf("runBusinessDeckPhase");
const completeIndex = runnerText.indexOf("completeSuccessfulRun");
assert(finalReportIndex >= 0, "runAnalysisPhases must call runFinalReportPhase.");
assert(businessDeckIndex > finalReportIndex, "Business deck stage must run after final adjudication.");
assert(completeIndex > businessDeckIndex, "Export completion must run after the business deck stage.");

const renderPromptArgument = getObjectLiteralArgument(deckStageFile, "renderDeepResearchBusinessPptArtifactPrompt");
const renderPromptFields = readPropertyNames(renderPromptArgument).sort();
assert.deepEqual(
  renderPromptFields,
  ["evidenceReferences", "finalPackage", "finalReport", "language"],
  "PPT artifact prompt render input must be limited to decision package, final adjudication, evidence refs, and language.",
);

const runPromptExchangeArgument = getObjectLiteralArgument(deckStageFile, "runPromptExchange");
const inputRefsProperty = runPromptExchangeArgument.getProperty("inputRefs");
assert(inputRefsProperty, "Deck stage must declare inputRefs.");
const inputRefsText = inputRefsProperty.getText();
assert(inputRefsText.includes("final-package"), "Deck stage must cite final-package as an input ref.");
assert(inputRefsText.includes("final-report"), "Deck stage must cite final-report as an input ref.");
assert(!inputRefsText.includes("timeline"), "Deck stage must not depend on timeline input refs.");
assert(!inputRefsText.includes("interaction"), "Deck stage must not depend on unrelated raw interaction refs.");
const maxInputCharsProperty = runPromptExchangeArgument.getProperty("maxInputChars");
assert(maxInputCharsProperty, "Deck stage must declare a maxInputChars policy.");
const maxInputCharsText = maxInputCharsProperty.getText();
assert(
  maxInputCharsText.includes("Number.MAX_SAFE_INTEGER"),
  "Deck stage must use the no-GrassEye-text-ceiling sentinel.",
);
assert(
  !maxInputCharsText.includes("45_000"),
  "Deck stage must not restore the old 45k text ceiling.",
);

assert(
  deckStageFile.getFullText().includes("parseAndDownloadBusinessPptArtifact"),
  "Deck stage must detect and download the AI-generated PPTX artifact.",
);
assert(
  !deckStageFile.getFullText().includes("parseDeepResearchBusinessDeckOutlineResponseForFinalReport"),
  "Primary deck stage must not require the old deck outline parser.",
);

process.stdout.write("[ACCEPTANCE][deep-research-business-deck] PASS\n");
