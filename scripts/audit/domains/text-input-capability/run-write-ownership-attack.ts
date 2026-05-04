import { toRepoRelativePath } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { getExternalImportsWithPrefix, getSourceFile, makeProject } from "./project-access.js";
import { LAW_IDS, PATHS } from "./config.js";

const SELECTOR_TOKENS = ["targetSelector", "cssSelector", "domSelector", "querySelector", "locator"] as const;
const EXTERNAL_DIRECT_WRITE_ROOTS = ["src/lib/local-runtime/", "src/lib/browser/", "src/features/platform-action/"] as const;
const ALLOWED_EXTERNAL_IMPORTERS = ["src/lib/browser/text-input-runtime-ports.ts"] as const;

function collectPublicContractFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const contractText = getSourceFile(project, PATHS.CONTRACT)?.getFullText() ?? "";
  const schemaText = getSourceFile(project, PATHS.SCHEMA)?.getFullText() ?? "";

  if (contractText.includes("BrowserController") || contractText.includes("BrowserTextInputAction") || contractText.includes("BrowserTextInputKey")) {
    findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.CONTRACT, line: 1, severity: "fatal", message: "Text Input public contract must not expose BrowserController or browser text-input primitive types." }));
  }
  if (SELECTOR_TOKENS.some((token) => contractText.includes(token) || schemaText.includes(token))) {
    findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Text Input public contract must not accept DOM selector, CSS selector, or locator fields." }));
  }

  return findings;
}

function collectExternalWriteOwnerFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  for (const targetPrefix of [PATHS.EXECUTION_PORT, PATHS.CLIPBOARD_PORT, PATHS.PRIMITIVE_ADAPTER]) {
    for (const importerPath of getExternalImportsWithPrefix(project, targetPrefix)) {
      if (ALLOWED_EXTERNAL_IMPORTERS.includes(importerPath as (typeof ALLOWED_EXTERNAL_IMPORTERS)[number])) {
        continue;
      }
      findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: importerPath, line: 1, severity: "fatal", message: "External owners must not import Text Input execution or clipboard adapters directly." }));
    }
  }

  for (const sourceFile of project.getSourceFiles()) {
    const repoPath = toRepoRelativePath(sourceFile.getFilePath());
    if (!EXTERNAL_DIRECT_WRITE_ROOTS.some((root) => repoPath.startsWith(root))) {
      continue;
    }
    const sourceText = sourceFile.getFullText();
    if (repoPath !== PATHS.PRIMITIVE_ADAPTER && sourceText.includes("browserController.textInput(")) {
      findings.push(createFinding({ lawId: LAW_IDS.PUBLIC, file: repoPath, line: 1, severity: "fatal", message: "Platform adapters and runtime helpers must not call browserController.textInput outside the Text Input primitive adapter." }));
    }
  }

  return findings;
}

export function runWriteOwnershipAttack(project: ReturnType<typeof makeProject> = makeProject()): { findings: Finding[]; phase: InspectorPhase } {
  const findings = [
    ...collectPublicContractFindings(project),
    ...collectExternalWriteOwnerFindings(project),
  ];

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "write-ownership-attack",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Text Input ownership stays isolated to governed write execution behind TextInputExecutionPort and ClipboardPort adapters."
        : "Text Input ownership drifted into public contract leaks or external write-owner bypass paths.",
    ),
  };
}