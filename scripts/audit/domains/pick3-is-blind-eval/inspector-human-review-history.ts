import { existsSync, readFileSync } from "node:fs";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const lawPath = ".github/instructions/agent-rules/modules/module-pick3-is-blind-eval.instructions.md";
const blueprintPath = "docs/法案辅助文件/GrassEye Pick3 IS Blind Eval 施工图.md";
const historyPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.history.ts";
const routesPath = "src/app/workbench-pick3-routes.ts";
const boundaryPath = "src/app/workbench-api-boundary.ts";
const supportPath = "src/lib/local-runtime/workbench-pick3-support.ts";
const historyClientPath = "src/app/workbench-home-pick3-history-client.ts";
const appShellLayoutPath = "src/app/app-shell/app-shell-layout.ts";
const acceptancePath = "scripts/acceptance/pick3-is-blind-eval-free-analysis.acceptance.ts";
const fullHistoryAcceptancePath = "scripts/acceptance/pick3-is-blind-eval-full-history.acceptance.ts";

const readRepoTextIfExists = (repoPath: string): string => {
  const fullPath = resolveFromRepo(repoPath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

const addFinding = (
  findings: InspectorFinding[],
  lawId: string,
  filePath: string,
  checkId: string,
  message: string,
): void => {
  findings.push(createFinding({ checkId, filePath, lawId, message }));
};

const requireTokens = (
  findings: InspectorFinding[],
  lawId: string,
  filePath: string,
  text: string,
  checkId: string,
  tokens: readonly string[],
): void => {
  for (const token of tokens) {
    if (!text.includes(token)) {
      addFinding(findings, lawId, filePath, checkId, `${filePath} must contain ${token}.`);
    }
  }
};

export const inspectPick3HumanReviewHistory = (input: {
  blueprintText: string;
  findings: InspectorFinding[];
  humanReviewHistoryLaw: string;
  lawText: string;
}): void => {
  const historyText = readRepoTextIfExists(historyPath);
  const routesText = readRepoTextIfExists(routesPath);
  const boundaryText = readRepoTextIfExists(boundaryPath);
  const clientText = readRepoTextIfExists(historyClientPath);
  const appShellText = readRepoTextIfExists(appShellLayoutPath);
  const supportText = readRepoTextIfExists(supportPath);
  const acceptanceText = readRepoTextIfExists(acceptancePath);
  const fullHistoryAcceptanceText = readRepoTextIfExists(fullHistoryAcceptancePath);
  requireTokens(input.findings, input.humanReviewHistoryLaw, lawPath, input.lawText, "pick3-is-blind-eval/human-review-history-law", ["Pick3 History surface", "newest official phase", "target phase", "raw_response_text", "must not compute or display a final selected label", "Observed distribution counts must be grouped by position"]);
  requireTokens(input.findings, input.humanReviewHistoryLaw, blueprintPath, input.blueprintText, "pick3-is-blind-eval/human-review-history-blueprint", ["## Next Prediction Stability Human Review History", "GET /api/pick3-is-blind-eval/history", "GET /api/pick3-is-blind-eval/task", "GET /api/pick3-is-blind-eval/interaction", "pick3_ai_interactions.raw_response_text", "No final selected label", "Counts for different positions must never be summed into one shared total"]);
  requireTokens(input.findings, input.humanReviewHistoryLaw, historyPath, historyText, "pick3-is-blind-eval/human-review-history-runtime", ["listPick3HumanReviewHistory", "getPick3HumanReviewTask", "getPick3HumanReviewInteraction", "rawResponseText", "evidenceCompleteness", "observedDistribution", "sameImageForPosition", "task.mode === \"next_prediction_stability\" || task.mode === \"full_pipeline\"", "phaseReports", "buildPhaseReports", "playbookLessons"]);
  requireTokens(input.findings, input.humanReviewHistoryLaw, routesPath, routesText, "pick3-is-blind-eval/human-review-history-routes", ["/api/pick3-is-blind-eval/history", "/api/pick3-is-blind-eval/task", "/api/pick3-is-blind-eval/interaction", "pick3_human_review_task_not_found"]);
  requireTokens(input.findings, input.humanReviewHistoryLaw, boundaryPath, boundaryText, "pick3-is-blind-eval/human-review-history-boundary", ["local_pick3_human_review_history", "local_pick3_human_review_task", "local_pick3_human_review_interaction", "externalApiAllowed: false"]);
  requireTokens(input.findings, input.humanReviewHistoryLaw, supportPath, supportText, "pick3-is-blind-eval/human-review-history-support", ["listPick3HumanReviewHistory(dataDir)", "getPick3HumanReviewTask(dataDir, taskId)", "getPick3HumanReviewInteraction(dataDir, input)"]);
  requireTokens(input.findings, input.humanReviewHistoryLaw, historyClientPath, clientText, "pick3-is-blind-eval/human-review-history-ui-client", ["data-pick3-history-list", "data-pick3-history-repeat-list", "openPick3AiAnswer", "rawResponseText", "observedDistribution", "renderPick3PhaseReports", "renderPick3PlaybookLessons"]);
  requireTokens(input.findings, input.humanReviewHistoryLaw, appShellLayoutPath, appShellText, "pick3-is-blind-eval/human-review-history-ui-shell", ["data-workspace-page=\"history\"", "data-pick3-history-phase", "data-pick3-history-distribution", "data-pick3-history-repeat-list", "data-pick3-history-phase-report-list", "data-pick3-history-lesson-list"]);
  requireTokens(input.findings, input.humanReviewHistoryLaw, acceptancePath, acceptanceText, "pick3-is-blind-eval/human-review-history-acceptance", ["listPick3HumanReviewHistory", "getPick3HumanReviewTask", "evidenceCompleteness.status", "sameImageForPosition", "rawResponseText", "finalRecommendation"]);
  requireTokens(input.findings, input.humanReviewHistoryLaw, fullHistoryAcceptancePath, fullHistoryAcceptanceText, "pick3-is-blind-eval/full-pipeline-history-acceptance", ["full-history-task", "taskMode", "phaseReports", "status, \"miss\"", "errorReason", "finalRecommendation"]);
};
