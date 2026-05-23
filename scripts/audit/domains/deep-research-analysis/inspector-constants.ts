export const requiredFiles = [
  "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-prompt.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.prompt-contracts.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-schema.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-parser.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.prompt-hash.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.prompt-quality.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.prompt-regression.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.export-markdown.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.flow.ts",
  "scripts/acceptance/deep-research-decomposition-prompt.acceptance.ts",
  "scripts/acceptance/deep-research-analysis-sub-question-fault-isolation.ts",
  "scripts/acceptance/deep-research-analysis-smoke.ts",
  "scripts/acceptance/deep-research-report-export.acceptance.ts",
] as const;

export const forbiddenRuntimeFields = [
  "nextAction",
  "actionPlan",
  "browserCommand",
  "selector",
  "coordinate",
  "workflow",
  "multiStepPlan",
  "runNext",
] as const;

export const promptTextAllowedFiles = new Set([
  "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-prompt.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.prompt-regression.ts",
]);

export const decompositionAuditFiles = new Set([
  "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-prompt.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-schema.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.decomposition-parser.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.prompt-contracts.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.prompt-quality.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.prompt-regression.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.prompt-hash.ts",
  "src/plugins/deep-research-analysis/deep-research-analysis.flow.ts",
]);