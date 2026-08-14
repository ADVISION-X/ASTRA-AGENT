import { SyntaxKind, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { hasTypeScriptExtension } from "../../shared/no-regex.js";
import { resolveCallsInSourceFile } from "./ast/ast-call-resolver.js";

const runtimeLogLawPrefixes = [
  "src/lib/runtime-logs/",
  "src/plugins/",
  "src/capabilities/",
  "src/lib/local-runtime/",
] as const;

const authorizedHelperPaths = new Set([
  "src/lib/runtime-logs/stage-logger.ts",
  "src/plugins/amazon-invoice-upload/amazon-dom-step-trace.ts",
  "src/lib/browser/current-chrome-browser-action-logging.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.logging.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.logging.ts",
]);

const isRuntimeLoggingFile = (repoPath: string): boolean =>
  repoPath.startsWith("src/") && repoPath.endsWith("/logging.ts");

export const isRuntimeLogLawSourcePath = (repoPath: string): boolean =>
  hasTypeScriptExtension(repoPath)
  && (runtimeLogLawPrefixes.some((prefix) => repoPath.startsWith(prefix)) || isRuntimeLoggingFile(repoPath));

export const hasRuntimeLogSignal = (sourceFile: SourceFile, repoPath: string): boolean =>
  resolveCallsInSourceFile(sourceFile, repoPath).some((call) =>
    call.kind === "runtime-log-emit" || call.kind === "event-factory" || call.kind === "stage-start")
  || sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) =>
    ["RuntimeLogEventType", "createRuntimeEvent", "createStageLogger"]
      .includes(astIdentifierName(identifier) ?? ""));

export const isAuthorizedRuntimeLogHelperPath = (repoPath: string): boolean => authorizedHelperPaths.has(repoPath);
