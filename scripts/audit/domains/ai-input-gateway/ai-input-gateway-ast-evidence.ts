import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { Node, type ImportDeclaration, type SourceFile } from "ts-morph";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import {
  getAuditProject,
  getSourceFileOrThrow,
} from "../../core/ts-morph.js";

const RUNTIME_ROOT = "src/capabilities/ai-input-gateway";
const PLUGIN_ROOT = "src/plugins";
const LAW_BOUNDARY = "GRASSEYE-AI-FEED-002-V1";
const LAW_ADAPTER = "GRASSEYE-AI-FEED-003-V1";
const LAW_WEB_SECURITY = "GRASSEYE-AI-FEED-004-V1";
const LAW_INPUT = "GRASSEYE-AI-FEED-006-V1";
const LAW_PROOF = "GRASSEYE-AI-FEED-007-V1";
const LAW_PLUGIN_ESCAPE = "GRASSEYE-AI-FEED-010-V1";

const CODE_FILE_PATTERN = /\.(ts|tsx|js|jsx|mjs)$/u;

const walkCodeFiles = (relativeRoot: string, acc: string[] = []): string[] => {
  const absoluteRoot = pathFromRepoRoot(relativeRoot);
  if (!existsSync(absoluteRoot)) return acc;
  for (const entry of readdirSync(absoluteRoot)) {
    const absolutePath = join(absoluteRoot, entry);
    const relativePath = `${relativeRoot}/${entry}`;
    if (statSync(absolutePath).isDirectory()) {
      walkCodeFiles(relativePath, acc);
      continue;
    }
    if (CODE_FILE_PATTERN.test(entry)) acc.push(relativePath);
  }
  return acc;
};

const finding = (
  lawId: string,
  file: string,
  line: number,
  message: string,
  hint: string,
  symbolName?: string,
): Finding => createFinding({
    lawId,
    file,
    line,
    severity: "fatal",
    message,
    hint,
    ...(symbolName ? { symbolName } : {}),
  });

const hasExportedSymbol = (sourceFile: SourceFile, symbolName: string): boolean =>
  sourceFile.getExportedDeclarations().has(symbolName);

const collectExportSymbolFindings = (): Finding[] => {
  const project = getAuditProject();
  const requiredExports = [
    ["src/capabilities/ai-input-gateway/schema.ts", "AiFeedInputSchema", LAW_INPUT],
    ["src/capabilities/ai-input-gateway/schema.ts", "AiFeedResultSchema", LAW_PROOF],
    ["src/capabilities/ai-input-gateway/ability-group.ts", "createAiInputGatewayAbilityGroup", LAW_BOUNDARY],
    ["src/capabilities/ai-input-gateway/manifest.ts", "AI_INPUT_GATEWAY_CATALOG_ENTRIES", LAW_BOUNDARY],
    ["src/capabilities/ai-input-gateway/providers/gemini-api.adapter.ts", "geminiApiAdapter", LAW_ADAPTER],
    ["src/capabilities/ai-input-gateway/providers/gemini-web-chat.adapter.ts", "geminiWebChatAdapter", LAW_ADAPTER],
    ["src/capabilities/ai-input-gateway/providers/gpt-web-chat.adapter.ts", "gptWebChatAdapter", LAW_ADAPTER],
  ] as const;
  return requiredExports.flatMap(([file, symbolName, lawId]) => {
    const sourceFile = getSourceFileOrThrow(project, file);
    return hasExportedSymbol(sourceFile, symbolName)
      ? []
      : [finding(lawId, file, 1, `required exported symbol is missing: ${symbolName}`, "Export the required AI Input Gateway public symbol.", symbolName)];
  });
};

const importText = (importDeclaration: ImportDeclaration): string =>
  importDeclaration.getModuleSpecifierValue();

const lineOfImport = (importDeclaration: ImportDeclaration): number =>
  importDeclaration.getModuleSpecifier().getStartLineNumber();

const isProviderAdapterImport = (moduleSpecifier: string): boolean =>
  /ai-input-gateway\/providers|providers\/.*\.adapter/u.test(moduleSpecifier);

const collectAdapterIsolationFindings = (): Finding[] => {
  const project = getAuditProject();
  return walkCodeFiles(`${RUNTIME_ROOT}/providers`).flatMap((file) => {
    const sourceFile = getSourceFileOrThrow(project, file);
    return sourceFile.getImportDeclarations()
      .filter((declaration) => isProviderAdapterImport(importText(declaration)))
      .map((declaration) => finding(
        LAW_ADAPTER,
        file,
        lineOfImport(declaration),
        "provider adapter imports another provider adapter path",
        "Keep provider adapters isolated behind the gateway adapter contract.",
      ));
  });
};

const collectPluginProviderEscapeFindings = (): Finding[] => {
  const project = getAuditProject();
  return walkCodeFiles(PLUGIN_ROOT).flatMap((file) => {
    const sourceFile = getSourceFileOrThrow(project, file);
    return sourceFile.getImportDeclarations()
      .filter((declaration) => {
        const specifier = importText(declaration);
        return specifier.includes("lib/online-ai")
          || specifier.includes("online-ai/index")
          || isProviderAdapterImport(specifier);
      })
      .map((declaration) => finding(
        LAW_PLUGIN_ESCAPE,
        file,
        lineOfImport(declaration),
        "business plugin imports an AI provider or provider adapter directly",
        "Route plugin AI work through an AI task capability and AI Input Gateway public contract.",
      ));
  });
};

const collectForbiddenWebChatStorageFindings = (): Finding[] => {
  const project = getAuditProject();
  const webChatFiles = [
    "src/capabilities/ai-input-gateway/providers/gemini-web-chat.adapter.ts",
    "src/capabilities/ai-input-gateway/providers/gpt-web-chat.adapter.ts",
    "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts",
  ];
  return webChatFiles.flatMap((file) => {
    const sourceFile = getSourceFileOrThrow(project, file);
    return sourceFile.getDescendants()
      .filter((node) => Node.isPropertyAccessExpression(node) || Node.isIdentifier(node))
      .filter((node) => {
        const text = node.getText();
        return text === "cookie"
          || text === "localStorage"
          || text === "sessionStorage";
      })
      .map((node) => finding(
        LAW_WEB_SECURITY,
        file,
        node.getStartLineNumber(),
        `web chat adapter references forbidden browser secret surface: ${node.getText()}`,
        "Remove cookie/localStorage/sessionStorage access from web chat adapters.",
      ));
  });
};

const collectGatewayBusinessImportFindings = (): Finding[] => {
  const project = getAuditProject();
  return walkCodeFiles(RUNTIME_ROOT).flatMap((file) => {
    const sourceFile = getSourceFileOrThrow(project, file);
    return sourceFile.getImportDeclarations()
      .filter((declaration) => importText(declaration).includes("product-video-dom-runtime"))
      .map((declaration) => finding(
        LAW_BOUNDARY,
        file,
        lineOfImport(declaration),
        "AI Input Gateway imports product-video business runtime",
        "Keep business judgment outside AI Input Gateway.",
      ));
  });
};

export const collectAiInputGatewayAstEvidenceFindings = (): Finding[] => [
  ...collectExportSymbolFindings(),
  ...collectAdapterIsolationFindings(),
  ...collectPluginProviderEscapeFindings(),
  ...collectForbiddenWebChatStorageFindings(),
  ...collectGatewayBusinessImportFindings(),
];
