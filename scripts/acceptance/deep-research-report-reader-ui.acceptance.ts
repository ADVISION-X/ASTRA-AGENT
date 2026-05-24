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

const assertNoTextInAnyFile = (filePaths: readonly string[], marker: string): void => {
  assert(filePaths.every((filePath) => !read(filePath).includes(marker)), `${filePaths.join(", ")} must not contain ${marker}.`);
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
  }, "workbench inline client script must parse.");
};

assertImport(
  "src/app/workbench-deep-research-panel.ts",
  "renderDeepResearchHistoryView",
  "./workbench-deep-research-history-view.js",
);
assertImport(
  "src/app/workbench-deep-research-panel.ts",
  "renderDeepResearchReportView",
  "./workbench-deep-research-report-view.js",
);
assertCall("src/app/workbench-deep-research-panel.ts", "renderDeepResearchHistoryView");
assertCall("src/app/workbench-deep-research-panel.ts", "renderDeepResearchReportView");
assertText("src/app/workbench-deep-research-panel.ts", "data-deep-research-new-toggle");
assertText("src/app/workbench-deep-research-panel.ts", "data-deep-research-form-shell");
assertText("src/app/workbench-deep-research-panel.ts", "data-deep-research-layout-contract=\"history-table-reader\"");
assertText("src/app/workbench-deep-research-panel.ts", "data-deep-research-scroll-boundary");
assertText("src/app/workbench-deep-research-history-view.ts", "data-deep-research-history-shell");
assertText("src/app/workbench-deep-research-history-view.ts", "data-deep-research-history");
assertText("src/app/workbench-deep-research-history-view.ts", "data-deep-research-history-search");
assertText("src/app/workbench-deep-research-report-view.ts", "data-deep-research-reader-shell");
assertText("src/app/workbench-deep-research-report-view.ts", "research-reading-rhythm");
assertText("src/app/workbench-deep-research-report-view.ts", "data-deep-research-final-card");
assertText("src/app/workbench-deep-research-report-view.ts", "data-deep-research-stage-overview");
assertText("src/app/workbench-deep-research-report-view.ts", "data-deep-research-decomposition");
assertText("src/app/workbench-deep-research-report-view.ts", "data-deep-research-subquestions");
assertText("src/app/workbench-deep-research-report-view.ts", "data-deep-research-final-adjudication");
assertText("src/app/workbench-deep-research-report-view.ts", "data-deep-research-evidence");
assertText("src/app/workbench-deep-research-report-view.ts", "data-deep-research-nav");
assertText("src/app/workbench-deep-research-report-view.ts", "data-deep-research-meta");
assertText("src/app/workbench-deep-research-report-view.ts", "data-deep-research-reader-primary");
assertText("src/app/workbench-deep-research-report-view.ts", "data-deep-research-side-compact");
assertText("src/app/workbench-deep-research-styles.ts", "max-height: min(320px, 34vh)");
assertText("src/app/workbench-deep-research-styles.ts", "grid-template-columns: minmax(0, 1fr)");
assertText("src/app/workbench-deep-research-styles.ts", "grid-template-columns: minmax(0, 1fr);");
assertText("src/app/workbench-deep-research-styles.ts", "research-delivery-strip");
assertText("src/app/workbench-deep-research-styles.ts", "line-height: 1.65");
assertText("src/app/workbench-deep-research-styles.ts", "repeat(auto-fit, minmax(320px, 1fr))");
assertText("src/app/workbench-deep-research-styles.ts", "box-shadow: inset 5px 0 0 var(--accent)");
assertText("src/app/workbench-deep-research-styles.ts", "research-debug-root");
assertNoTextInAnyFile(["src/app/workbench-deep-research-styles.ts"], "grid-template-columns: minmax(0, 1fr) 240px");
assertTextInAnyFile(clientRuntimePaths, "refreshHistory");
assertTextInAnyFile(clientRuntimePaths, "loadSelectedReport");
assertTextInAnyFile(clientRuntimePaths, "renderSelectedReport");
assertTextInAnyFile(clientRuntimePaths, "Independent Analysis");
assertTextInAnyFile(clientRuntimePaths, "Final Adjudication");
assertTextInAnyFile(clientRuntimePaths, "Evidence / Debug");
assertTextInAnyFile(clientRuntimePaths, "Show Full Prompt");
assertTextInAnyFile(clientRuntimePaths, "Show Full AI Response");
assertTextInAnyFile(clientRuntimePaths, "Show Parsed Result");
assertTextInAnyFile(clientRuntimePaths, "Interaction Evidence");
assertNoTextInAnyFile(clientRuntimePaths, "Raw result record");
assertNoTextInAnyFile(clientRuntimePaths, "View raw final report JSON");
assertText("src/app/workbench-deep-research-routes.ts", "/api/deep-research-analysis/history");
assertText("src/app/workbench-deep-research-routes.ts", "/api/deep-research-analysis/report");
assertText("src/lib/local-runtime/workbench-handle.ts", "listDeepResearchAnalysisJobs");
assertText("src/lib/local-runtime/workbench-handle.ts", "getDeepResearchAnalysisReport");
assertText("src/plugins/deep-research-analysis/deep-research-analysis.public-queries.ts", "listDeepResearchAnalysisHistory");
assertText("src/plugins/deep-research-analysis/deep-research-analysis.public-queries.ts", "getDeepResearchAnalysisReport");
assertWorkbenchInlineScriptCompiles();

process.stdout.write("[ACCEPTANCE][deep-research-report-reader-ui] PASS\n");
