import { Node, type Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { LAW_IDS } from "./config.js";
import { getRepoPath, getScreenshotSources } from "./project-access.js";

const PREPARE_AI_INPUT_PATH = "/children/prepare-ai-input/implementation.ts";

const getChildImplementationSources = (project: Project) => {
  return getScreenshotSources(project).filter((sourceFile) => {
    const repoPath = getRepoPath(sourceFile);
    return repoPath.includes("/children/") && repoPath.endsWith("/implementation.ts");
  });
};

function collectSiblingImportFindings(project: Project): Finding[] {
  const childSource = getChildImplementationSources(project).find((sourceFile) => {
    return sourceFile.getImportDeclarations().some((declaration) => {
      const specifier = declaration.getModuleSpecifierValue() ?? "";
      return specifier.startsWith("../") && specifier.endsWith("/implementation.js");
    });
  });
  return childSource
    ? [createFinding({ lawId: LAW_IDS.ENTRY, file: getRepoPath(childSource), line: 1, severity: "fatal", message: "Screenshot child implementations must not import sibling child implementations." })]
    : [];
}

function collectBrowserImportFindings(project: Project): Finding[] {
  const childSource = getChildImplementationSources(project).find((sourceFile) => {
    return sourceFile.getImportDeclarations().some((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes("browser-controller"));
  });
  return childSource
    ? [createFinding({ lawId: LAW_IDS.ENTRY, file: getRepoPath(childSource), line: 1, severity: "fatal", message: "Screenshot child implementations must not import BrowserController directly." })]
    : [];
}

function collectBooleanReturnFindings(project: Project): Finding[] {
  const childWithBooleanReturn = getChildImplementationSources(project).find((sourceFile) => {
    return sourceFile.getDescendants().some((node) => Node.isReturnStatement(node) && (() => {
      const expression = node.getExpression();
      return expression !== undefined && (Node.isTrueLiteral(expression) || Node.isFalseLiteral(expression));
    })());
  });
  return childWithBooleanReturn
    ? [createFinding({ lawId: LAW_IDS.ENTRY, file: getRepoPath(childWithBooleanReturn), line: 1, severity: "fatal", message: "Screenshot child implementations must not return boolean shortcuts." })]
    : [];
}

function collectPrepareAiInputFindings(project: Project): Finding[] {
  const sourceFile = getChildImplementationSources(project).find((candidate) => getRepoPath(candidate).endsWith(PREPARE_AI_INPUT_PATH));
  if (!sourceFile) {
    return [createFinding({ lawId: LAW_IDS.ENTRY, file: `src/capabilities/screenshot${PREPARE_AI_INPUT_PATH}`, line: 1, severity: "fatal", message: "Screenshot prepare-ai-input child must keep governed scale-mapping input wiring." })];
  }

  const sourceText = sourceFile.getFullText();
  return sourceText.includes("maxAiWidth: request.maxAiWidth ?? context.defaultAiMaxWidth")
    ? []
    : [createFinding({ lawId: LAW_IDS.ENTRY, file: getRepoPath(sourceFile), line: 1, severity: "fatal", message: "Screenshot prepare-ai-input child must not hardcode resize outside governed scale-mapping flow." })];
}

export function runChildRuntimeCheck(project: Project): { findings: Finding[]; phase: InspectorPhase } {
  const findings = [
    ...collectSiblingImportFindings(project),
    ...collectBrowserImportFindings(project),
    ...collectBooleanReturnFindings(project),
    ...collectPrepareAiInputFindings(project),
  ];
  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "child-runtime-check",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Screenshot child capabilities stay narrow, BrowserController-free, sibling-isolated, and governed by the unified runtime plan flow."
        : "Screenshot child capabilities drifted away from the governed narrow-runtime contract.",
    ),
  };
}