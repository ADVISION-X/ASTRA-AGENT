import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Project, SyntaxKind } from "ts-morph";
import { renderWorkbenchHomePage } from "../../src/app/workbench-home-page.js";

const project = new Project({ tsConfigFilePath: "tsconfig.json" });
const clientRuntimePaths = [
  "src/app/workbench-deep-research-client.ts",
  "src/app/workbench-deep-research-client-report-sections.ts",
  "src/app/workbench-deep-research-client-shared.ts",
  "src/app/workbench-deep-research-client-boot.ts",
] as const;

const read = (filePath: string): string => readFileSync(filePath, "utf8");
const source = (filePath: string) => {
  const file = project.getSourceFile(filePath);
  assert(file, `${filePath} must be visible to ts-morph.`);
  return file;
};

const assertText = (filePath: string, marker: string): void => {
  assert(read(filePath).includes(marker), `${filePath} must contain ${marker}.`);
};

const assertTextInAnyFile = (filePaths: readonly string[], marker: string): void => {
  assert(filePaths.some((filePath) => read(filePath).includes(marker)), `${filePaths.join(", ")} must contain ${marker}.`);
};

const assertImport = (filePath: string, symbolName: string, moduleSuffix: string): void => {
  const found = source(filePath).getImportDeclarations().some((declaration) =>
    declaration.getModuleSpecifierValue().endsWith(moduleSuffix)
    && declaration.getNamedImports().some((namedImport) => namedImport.getName() === symbolName),
  );
  assert(found, `${filePath} must import ${symbolName} from ${moduleSuffix}.`);
};

const assertCall = (filePath: string, symbolName: string): void => {
  const found = source(filePath).getDescendantsOfKind(SyntaxKind.CallExpression).some((call) =>
    call.getExpression().getText() === symbolName,
  );
  assert(found, `${filePath} must call ${symbolName}.`);
};

const assertWorkbenchInlineScriptCompiles = (): void => {
  const pageHtml = renderWorkbenchHomePage();
  const match = pageHtml.match(/<script>([\s\S]*)<\/script>/u);
  const scriptText = match?.[1];
  assert(scriptText, "workbench home page must render one inline client script.");
  assert.doesNotThrow(() => {
    new Function(scriptText);
  }, "workbench inline client script must parse so shell click handlers can bind.");
};

assertImport(
  "src/app/workbench-home-page.ts",
  "renderDeepResearchPanel",
  "./workbench-deep-research-panel.js",
);
assertImport(
  "src/app/workbench-home-page.ts",
  "renderWorkbenchDeepResearchClient",
  "./workbench-deep-research-client.js",
);
assertCall("src/app/workbench-home-page.ts", "renderDeepResearchPanel");
assertText("src/app/workbench-home-page.ts", "data-job-card=\"deep-research\"");
assertText("src/app/workbench-deep-research-panel.ts", "data-job-panel=\"deep-research\"");
assertText("src/app/workbench-deep-research-panel.ts", "name=\"userQuestion\"");
assertText("src/app/workbench-deep-research-panel.ts", "name=\"language\"");
assertText("src/app/workbench-deep-research-panel.ts", "name=\"providerKind\"");
assertText("src/app/workbench-deep-research-panel.ts", "name=\"maxSubQuestions\"");
assertText("src/app/workbench-deep-research-panel.ts", "data-deep-research-new-toggle");
assertText("src/app/workbench-deep-research-panel.ts", "data-deep-research-form-shell");
assertText("src/app/workbench-deep-research-panel.ts", "data-deep-research-layout-contract=\"history-table-reader\"");
assertText("src/app/workbench-deep-research-panel.ts", "data-deep-research-scroll-boundary");
assertText("src/app/workbench-deep-research-history-view.ts", "data-deep-research-history");
assertText("src/app/workbench-deep-research-report-view.ts", "data-deep-research-final-card");
assertText("src/app/workbench-deep-research-report-view.ts", "data-deep-research-final-adjudication");
assertText("src/app/workbench-deep-research-report-view.ts", "data-deep-research-evidence");
assertText("src/app/workbench-deep-research-report-view.ts", "data-deep-research-reader-primary");
assertText("src/app/workbench-deep-research-report-view.ts", "data-deep-research-side-compact");
assertText("src/app/workbench-deep-research-styles.ts", "max-height: min(320px, 34vh)");
assertText("src/app/workbench-deep-research-styles.ts", "grid-template-columns: minmax(0, 1fr)");
assertText("src/app/workbench-deep-research-styles.ts", "research-delivery-strip");
assertImport(
  "src/app/create-workbench-server.ts",
  "handleDeepResearchRequest",
  "./workbench-deep-research-routes.js",
);
assertCall("src/app/create-workbench-server.ts", "handleDeepResearchRequest");
assertText("src/app/workbench-deep-research-routes.ts", "/api/deep-research-analysis/start");
assertText("src/app/workbench-deep-research-routes.ts", "/api/deep-research-analysis/history");
assertText("src/app/workbench-deep-research-routes.ts", "/api/deep-research-analysis/report");
assertText("src/app/workbench-deep-research-routes.ts", "/api/deep-research-analysis/timeline");
assertText("src/lib/local-runtime/workbench-handle.ts", "startDeepResearchAnalysis");
assertText("src/lib/local-runtime/workbench-handle.ts", "listDeepResearchAnalysisJobs");
assertText("src/lib/local-runtime/workbench-handle.ts", "getDeepResearchAnalysisReport");
assertText("src/lib/local-runtime/workbench-handle.ts", "getDeepResearchAnalysisTimeline");
assertText("src/lib/local-runtime/workbench.ts", "deepResearchAnalysisPublicFacade");
assertTextInAnyFile(clientRuntimePaths, "Default 1+N+1");
assertTextInAnyFile(clientRuntimePaths, "Final Adjudication");
assertTextInAnyFile(clientRuntimePaths, "Show Full Prompt");
assertTextInAnyFile(clientRuntimePaths, "Show Full AI Response");
assertTextInAnyFile(clientRuntimePaths, "Show Parsed Result");
assertTextInAnyFile(clientRuntimePaths, "refreshHistory");
assertTextInAnyFile(clientRuntimePaths, "loadSelectedReport");
assertText("src/plugins/deep-research-analysis/deep-research-analysis.public-queries.ts", "buildTimelineSnapshot");
assertWorkbenchInlineScriptCompiles();

process.stdout.write("[ACCEPTANCE][deep-research-app-ui] PASS\n");
