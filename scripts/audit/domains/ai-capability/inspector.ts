import { listPromptContractCatalogEntries } from "../../../../src/capabilities/ai/index.js";
import { fileExists, listFilesRecursive, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

import { AI_CAPABILITY_AUDIT_CONFIG } from "./config.js";

const findLineNumber = (source: string, fragment: string) => {
  const index = source.indexOf(fragment);
  return index < 0 ? 1 : source.slice(0, index).split("\n").length;
};

const createCodeFinding = (input: {
  lawId: string;
  file: string;
  source?: string;
  fragment?: string;
  message: string;
  hint: string;
}): Finding => createFinding({
  lawId: input.lawId,
  file: input.file,
  line: input.source && input.fragment ? findLineNumber(input.source, input.fragment) : 1,
  severity: "error",
  message: input.message,
  hint: input.hint,
});

const createAuditPhase = (name: string, findings: Finding[], passSummary: string, failSummary: string): InspectorPhase => {
  const passed = findings.length === 0;
  return createPhase(name, passed ? "PASS" : "CODE VIOLATION", passed, passed ? passSummary : failSummary);
};

const readSourceFile = async (relativePath: string) => ({
  absolutePath: pathFromRepoRoot(relativePath),
  relativePath,
  source: await readTextFile(pathFromRepoRoot(relativePath)),
});

const runAiCapabilityChecks = async () => {
  const findings: Finding[] = [];
  const phases: InspectorPhase[] = [];
  const aiRoot = pathFromRepoRoot("src/capabilities/ai");
  const aiFiles = await listFilesRecursive(aiRoot, { extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", ".jsonc"] });
  const aiRelativeFiles = aiFiles.map((filePath) => toRepoRelativePath(filePath));

  const fileCountFindings = aiFiles.length <= 15
    ? []
    : [createCodeFinding({
      lawId: "GRASSEYE-AI-CAPABILITY-006-V2",
      file: "src/capabilities/ai",
      message: `AI root contains ${aiFiles.length} files, which exceeds the <= 15 limit.`,
      hint: "Delete remaining non-essential files until the thin owner surface is restored.",
    })];
  findings.push(...fileCountFindings);
  phases.push(createAuditPhase(
    "ai-file-count",
    fileCountFindings,
    "AI root stays within the thin owner file-count budget.",
    "AI root is still larger than the thin owner budget.",
  ));

  const childFiles = aiRelativeFiles.filter((relativePath) => relativePath.startsWith("src/capabilities/ai/children/"));
  const childFindings = childFiles.length === 1 && childFiles[0] === "src/capabilities/ai/children/visual-mission-judge-once.ts"
    ? []
    : [createCodeFinding({
      lawId: "GRASSEYE-AI-CAPABILITY-001-V2",
      file: childFiles[0] ?? "src/capabilities/ai/children",
      message: "AI child surface must contain only visual-mission-judge-once.",
      hint: "Delete every extra AI child and keep only src/capabilities/ai/children/visual-mission-judge-once.ts.",
    })];
  findings.push(...childFindings);
  phases.push(createAuditPhase(
    "ai-child-surface",
    childFindings,
    "AI child surface is reduced to visual-mission-judge-once.",
    "AI child surface still exposes more than the single allowed reasoning child.",
  ));

  const forbiddenDirectoryFindings: Finding[] = [];
  for (const relativePath of AI_CAPABILITY_AUDIT_CONFIG.forbiddenDirectories) {
    if (await fileExists(pathFromRepoRoot(relativePath))) {
      forbiddenDirectoryFindings.push(createCodeFinding({
        lawId: "GRASSEYE-AI-CAPABILITY-001-V2",
        file: relativePath,
        message: `Forbidden AI system directory remains active: ${relativePath}.`,
        hint: "Delete provider/runtime/shared/public-contracts style directories from src/capabilities/ai.",
      }));
    }
  }
  findings.push(...forbiddenDirectoryFindings);
  phases.push(createAuditPhase(
    "ai-topology-boundary",
    forbiddenDirectoryFindings,
    "AI topology no longer contains provider-style system directories.",
    "AI topology still contains retired provider-style system directories.",
  ));

  const promptContracts = listPromptContractCatalogEntries();
  const promptCatalogFindings = promptContracts.length === 1 && promptContracts[0]?.promptContractId === "visual-mission-judge-v1"
    ? []
    : [createCodeFinding({
      lawId: "GRASSEYE-AI-CAPABILITY-003-V2",
      file: "src/capabilities/ai/registry.ts",
      message: "AI prompt contract facade must expose exactly one active prompt contract: visual-mission-judge-v1.",
      hint: "Collapse the AI prompt facade to the single governed prompt contract.",
    })];
  findings.push(...promptCatalogFindings);

  const promptSource = await readSourceFile("src/capabilities/ai/prompt/visual-mission-judge-prompt.ts");
  const promptContentFindings = [
    ...AI_CAPABILITY_AUDIT_CONFIG.promptRequiredFragments
      .filter((fragment) => !promptSource.source.includes(fragment))
      .map((fragment) => createCodeFinding({
        lawId: "GRASSEYE-AI-CAPABILITY-003-V2",
        file: promptSource.relativePath,
        message: `Prompt is missing required section: ${fragment}`,
        hint: "Prompt must read only user requirement, evidence, platform profile, capability manual, and output schema.",
      })),
    ...AI_CAPABILITY_AUDIT_CONFIG.promptForbiddenFragments
      .filter((fragment) => promptSource.source.toLowerCase().includes(fragment))
      .map((fragment) => createCodeFinding({
        lawId: "GRASSEYE-AI-CAPABILITY-003-V2",
        file: promptSource.relativePath,
        source: promptSource.source,
        fragment,
        message: `Prompt contains forbidden retired guidance: ${fragment}`,
        hint: "Remove provider/fallback/workflow/package guidance from the active prompt.",
      })),
  ];
  findings.push(...promptContentFindings);
  phases.push(createAuditPhase(
    "ai-prompt-boundary",
    [...promptCatalogFindings, ...promptContentFindings],
    "AI prompt facade stays single-source and task-bound.",
    "AI prompt facade still carries retired registry or prompt content drift.",
  ));

  const outputSchemaSource = await readSourceFile("src/visual-mission/action-plan/ai-output.schema.ts");
  const outputBoundaryFindings = AI_CAPABILITY_AUDIT_CONFIG.forbiddenOutputFragments
    .filter((fragment) => outputSchemaSource.source.includes(fragment))
    .map((fragment) => createCodeFinding({
      lawId: "GRASSEYE-AI-CAPABILITY-004-V2",
      file: outputSchemaSource.relativePath,
      source: outputSchemaSource.source,
      fragment,
      message: `AI output schema still exposes forbidden executable field: ${fragment}`,
      hint: "Keep AI output non-executable and free of raw coordinate or browser authority fields.",
    }));
  findings.push(...outputBoundaryFindings);
  phases.push(createAuditPhase(
    "ai-output-boundary",
    outputBoundaryFindings,
    "AI output schema stays non-executable.",
    "AI output schema still exposes executable authority fields.",
  ));

  const importBoundaryFindings: Finding[] = [];
  const actionBoundaryFindings: Finding[] = [];
  for (const relativePath of aiRelativeFiles.filter((file) => /\.(ts|tsx|js|jsx|mjs)$/.test(file))) {
    const source = await readTextFile(pathFromRepoRoot(relativePath));
    for (const fragment of AI_CAPABILITY_AUDIT_CONFIG.forbiddenImportFragments) {
      if (source.includes(fragment)) {
        importBoundaryFindings.push(createCodeFinding({
          lawId: "GRASSEYE-AI-CAPABILITY-005-V2",
          file: relativePath,
          source,
          fragment,
          message: `AI source imports forbidden executor boundary: ${fragment}`,
          hint: "AI must not import browser, action, Nerve Bus, or Forensics executors.",
        }));
      }
    }
    for (const fragment of AI_CAPABILITY_AUDIT_CONFIG.forbiddenCallFragments) {
      if (source.includes(fragment)) {
        actionBoundaryFindings.push(createCodeFinding({
          lawId: "GRASSEYE-AI-CAPABILITY-005-V2",
          file: relativePath,
          source,
          fragment,
          message: `AI source still performs forbidden execution or persistence call: ${fragment}`,
          hint: "AI must return judgment only; execution, transport, and persistence belong to other owners.",
        }));
      }
    }
  }
  findings.push(...importBoundaryFindings, ...actionBoundaryFindings);
  phases.push(createAuditPhase(
    "ai-owner-boundary",
    [...importBoundaryFindings, ...actionBoundaryFindings],
    "AI source does not import or call execution, transport, or persistence owners.",
    "AI source still crosses into execution, transport, or persistence owners.",
  ));

  return { findings, phases };
};

export const aiCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye AI Capability Owner Inspector",
  inspectorId: AI_CAPABILITY_AUDIT_CONFIG.inspectorId,
  capabilityDomain: AI_CAPABILITY_AUDIT_CONFIG.capabilityDomain,
  inspectorEntry: AI_CAPABILITY_AUDIT_CONFIG.inspectorEntry,
  ownedPaths: AI_CAPABILITY_AUDIT_CONFIG.ownedPaths,
  pendingSummary: "ai-capability must stay implemented as one thin reasoning owner.",
  implementedSummary: "ai-capability is implemented as one thin reasoning owner with one child, one prompt contract, and one local model path.",
  extraChecks: runAiCapabilityChecks,
});
