import { containsAny, hasTypeScriptExtension } from "../../shared/no-regex.js";

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
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.logging.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.logging.ts",
]);

const isRuntimeLoggingFile = (repoPath: string): boolean =>
  repoPath.startsWith("src/") && repoPath.endsWith("/logging.ts");

export const isRuntimeLogLawSourcePath = (repoPath: string): boolean =>
  hasTypeScriptExtension(repoPath)
  && (runtimeLogLawPrefixes.some((prefix) => repoPath.startsWith(prefix)) || isRuntimeLoggingFile(repoPath));

export const hasRuntimeLogSignal = (text: string): boolean =>
  containsAny(text, ["RuntimeLogEventType", "logger.emit(", "createRuntimeEvent(", "createStageLogger("]);

export const isAuthorizedRuntimeLogHelperPath = (repoPath: string): boolean => authorizedHelperPaths.has(repoPath);
