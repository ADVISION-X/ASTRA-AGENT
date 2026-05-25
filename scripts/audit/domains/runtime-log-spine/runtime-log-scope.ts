const runtimeLogLawPrefixes = [
  "src/lib/runtime-logs/",
  "src/plugins/",
  "src/capabilities/",
  "src/lib/local-runtime/",
] as const;

const runtimeLoggingFilePattern = /^src\/.+\/logging\.ts$/u;
const runtimeSourceFilePattern = /\.(?:ts|tsx)$/u;
const runtimeLogSignalPattern = /\bRuntimeLogEventType\b|\blogger\.emit\s*\(|\bcreateRuntimeEvent\s*\(|\bcreateStageLogger\s*\(/u;
const authorizedHelperPaths = new Set([
  "src/lib/runtime-logs/stage-logger.ts",
  "src/plugins/amazon-invoice-upload/amazon-dom-step-trace.ts",
  "src/plugins/amazon-product-mining/amazon-product-mining.logging.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.logging.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.logging.ts",
]);

export const isRuntimeLogLawSourcePath = (repoPath: string): boolean =>
  runtimeSourceFilePattern.test(repoPath)
  && (runtimeLogLawPrefixes.some((prefix) => repoPath.startsWith(prefix)) || runtimeLoggingFilePattern.test(repoPath));

export const hasRuntimeLogSignal = (text: string): boolean => runtimeLogSignalPattern.test(text);

export const isAuthorizedRuntimeLogHelperPath = (repoPath: string): boolean => authorizedHelperPaths.has(repoPath);
