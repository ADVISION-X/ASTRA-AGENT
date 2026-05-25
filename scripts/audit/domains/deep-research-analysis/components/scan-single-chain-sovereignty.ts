import { existsSync } from "node:fs";

import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../../shared/paths.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const decode = (value: string): string => Buffer.from(value, "base64").toString("utf8");

const forbiddenIdentifiers = new Set([
  decode("cnVuQnVzaW5lc3NEZWNrUGhhc2U="),
  decode("cnVuUHB0QXJ0aWZhY3RQaGFzZQ=="),
  decode("cnVuUG9zaXRpdmVQaGFzZQ=="),
  decode("cnVuRmFsc2lmaWNhdGlvblBoYXNl"),
  decode("YnVpbGRGaW5hbFBhY2thZ2VTdGFnZQ=="),
]);

const retiredTerms = [
  decode("bGVnYWN5XzFfbl9uXzE="),
  decode("cG9zaXRpdmVBbnN3ZXJSZWNvcmRz"),
  decode("ZmFsc2lmaWNhdGlvbkFuc3dlclJlY29yZHM="),
  decode("Y29uZmxpY3RNYXRyaXg="),
  decode("YnVzaW5lc3MtZGVjay1vdXRsaW5l"),
  decode("YnVzaW5lc3MtZGVjay5wcHR4"),
  decode("YnVzaW5lc3MtZGVjay5haS1wcHR4"),
  decode("YnVzaW5lc3MtZGVjay5sb2NhbC1wcHR4"),
] as const;

const requiredRunnerIdentifiers = [
  "runDecompositionPhase",
  "runSubQuestionPhases",
  "buildFullCaseFileStage",
  "runFinalReportPhase",
  "runBusinessHtmlReportPhase",
  "completeSuccessfulRun",
] as const;

type SingleChainSovereigntyInput = {
  analysisRunnerFile: SourceFile | undefined;
  sourceFiles: readonly SourceFile[];
  routesFile: SourceFile | undefined;
  workbenchHandleFile: SourceFile | undefined;
  publicFacadeFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
};

const getRunnerRepoPath = (input: SingleChainSovereigntyInput): string =>
  input.analysisRunnerFile
    ? getRepoSourcePath(input.analysisRunnerFile)
    : "src/plugins/deep-research-analysis/deep-research-analysis.analysis-runner.ts";

const recordSingleChainInspectedFiles = (input: SingleChainSovereigntyInput): void => {
  for (const sourceFile of [
    input.analysisRunnerFile,
    input.routesFile,
    input.workbenchHandleFile,
    input.publicFacadeFile,
    ...input.sourceFiles,
  ]) {
    if (sourceFile) input.inspectedFiles.add(getRepoSourcePath(sourceFile));
  }
};

const inspectRequiredSingleChainIdentifiers = (input: SingleChainSovereigntyInput): void => {
  const runnerRepoPath = getRunnerRepoPath(input);
  for (const identifier of requiredRunnerIdentifiers) {
    const hasIdentifier = Boolean(input.analysisRunnerFile?.getDescendantsOfKind(SyntaxKind.Identifier).some((node) => node.getText() === identifier));
    if (hasIdentifier) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/single-chain-sovereignty-required-identifier",
      lawId: input.lawId,
      filePath: runnerRepoPath,
      message: `Deep Research runner is missing required single-chain identifier: ${identifier}.`,
    }));
  }
};

const inspectForbiddenSingleChainSourceTerms = (input: SingleChainSovereigntyInput): void => {
  for (const sourceFile of input.sourceFiles) {
    const repoPath = getRepoSourcePath(sourceFile);
    sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).forEach((identifier) => {
      if (!forbiddenIdentifiers.has(identifier.getText())) return;
      input.findings.push(createFinding({
        checkId: "deep-research/single-chain-sovereignty-forbidden-identifier",
        lawId: input.lawId,
        filePath: repoPath,
        message: `Forbidden Deep Research phase identifier remains: ${identifier.getText()}.`,
      }));
    });

    const stringValues = sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralValue().toLowerCase());
    const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => identifier.getText());
    const foundRetiredTerms = retiredTerms.filter((term) =>
      stringValues.some((value) => value.includes(term.toLowerCase()))
      || identifiers.some((value) => value === term),
    );
    if (foundRetiredTerms.length === 0) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/single-chain-sovereignty-retired-term",
      lawId: input.lawId,
      filePath: repoPath,
      message: "Forbidden Deep Research historical path markers remain in active runtime source.",
    }));
  }
};

const inspectHtmlReentrySurfaces = (input: SingleChainSovereigntyInput): void => {
  if (existsSync(resolveFromRepo("src/plugins/deep-research-analysis/deep-research-analysis.html-report-reentry.ts"))) {
    input.findings.push(createFinding({
      checkId: "deep-research/single-chain-sovereignty-html-reentry",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-reentry.ts",
      message: "HTML report reentry owner must be physically deleted so only the unique main chain remains.",
    }));
  }

  const routesText = input.routesFile?.getFullText() ?? "";
  if (routesText.includes("/api/deep-research-analysis/regenerate-html-report")) {
    input.findings.push(createFinding({
      checkId: "deep-research/single-chain-sovereignty-regenerate-route",
      lawId: input.lawId,
      filePath: "src/app/workbench-deep-research-routes.ts",
      message: "Workbench routes must not expose a Deep Research HTML regenerate endpoint.",
    }));
  }

  for (const check of [
    {
      text: input.workbenchHandleFile?.getFullText() ?? "",
      filePath: "src/lib/local-runtime/workbench-handle.ts",
      message: "Workbench handle must not expose HTML reentry.",
    },
    {
      text: input.publicFacadeFile?.getFullText() ?? "",
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.public.ts",
      message: "Public facade must not expose HTML reentry.",
    },
  ] as const) {
    if (!check.text.includes("rerunDeepResearchBusinessHtmlReport")) continue;
    input.findings.push(createFinding({
      checkId: "deep-research/single-chain-sovereignty-reentry-symbol",
      lawId: input.lawId,
      filePath: check.filePath,
      message: check.message,
    }));
  }
};

export const inspectSingleChainSovereignty = (input: SingleChainSovereigntyInput): void => {
  recordSingleChainInspectedFiles(input);
  inspectRequiredSingleChainIdentifiers(input);
  inspectForbiddenSingleChainSourceTerms(input);
  inspectHtmlReentrySurfaces(input);
};