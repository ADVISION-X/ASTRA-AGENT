import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Project, SyntaxKind } from "ts-morph";

const project = new Project({ tsConfigFilePath: "tsconfig.json" });
const read = (filePath: string): string => readFileSync(filePath, "utf8");
const source = (filePath: string) => {
  const file = project.getSourceFile(filePath);
  assert(file, `${filePath} must be visible to ts-morph.`);
  return file;
};

const assertText = (filePath: string, marker: string): void => {
  assert(read(filePath).includes(marker), `${filePath} must contain ${marker}.`);
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
assertText("src/app/workbench-deep-research-panel.ts", "data-deep-research-final-report");
assertText("src/app/workbench-deep-research-panel.ts", "data-deep-research-evidence");
assertImport(
  "src/app/create-workbench-server.ts",
  "handleDeepResearchRequest",
  "./workbench-deep-research-routes.js",
);
assertCall("src/app/create-workbench-server.ts", "handleDeepResearchRequest");
assertText("src/app/workbench-deep-research-routes.ts", "/api/deep-research-analysis/start");
assertText("src/app/workbench-deep-research-routes.ts", "/api/deep-research-analysis/timeline");
assertText("src/lib/local-runtime/workbench-handle.ts", "startDeepResearchAnalysis");
assertText("src/lib/local-runtime/workbench-handle.ts", "getDeepResearchAnalysisTimeline");
assertText("src/lib/local-runtime/workbench.ts", "deepResearchAnalysisPublicFacade");
assertText("src/app/workbench-deep-research-client.ts", "Full prompt");
assertText("src/app/workbench-deep-research-client.ts", "AI response");
assertText("src/app/workbench-deep-research-client.ts", "Parsed JSON");
assertText("src/app/workbench-deep-research-client.ts", "<details>");

process.stdout.write("[ACCEPTANCE][deep-research-app-ui] PASS\n");
