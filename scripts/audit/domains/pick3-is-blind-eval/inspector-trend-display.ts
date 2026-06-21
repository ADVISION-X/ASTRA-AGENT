import { readFileSync } from "node:fs";

import type { InspectorFinding } from "../../shared/inspector-contracts.js";
import { createFinding } from "../../shared/finding-utils.js";
import { resolveFromRepo } from "../../shared/paths.js";

const lawPath = ".github/instructions/agent-rules/modules/module-pick3-is-blind-eval.instructions.md";
const blueprintPath = "docs/法案辅助文件/GrassEye Pick3 IS Blind Eval 施工图.md";
const trendPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.trend.ts";
const flowPath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.flow.ts";
const storagePath = "src/plugins/pick3-is-blind-eval/pick3-is-blind-eval.storage.ts";
const appShellLayoutPath = "src/app/app-shell/app-shell-layout.ts";
const pick3ClientPath = "src/app/workbench-home-pick3-client.ts";
const pick3TargetClientPath = "src/app/workbench-home-pick3-target-client.ts";
const workbenchPick3RoutesPath = "src/app/workbench-pick3-routes.ts";
const workbenchApiBoundaryPath = "src/app/workbench-api-boundary.ts";
const workbenchPick3SupportPath = "src/lib/local-runtime/workbench-pick3-support.ts";
const pick3TrendClientPath = "src/app/workbench-home-pick3-trend-client.ts";

const readRepoTextIfExists = (repoPath: string): string => {
  try {
    return readFileSync(resolveFromRepo(repoPath), "utf8");
  } catch {
    return "";
  }
};

const addFinding = (findings: InspectorFinding[], lawId: string, filePath: string, checkId: string, message: string): void => {
  findings.push(createFinding({ checkId, filePath, lawId, message }));
};

const requireTokens = (findings: InspectorFinding[], lawId: string, filePath: string, text: string, checkId: string, tokens: readonly string[]): void => {
  for (const token of tokens) {
    if (!text.includes(token)) addFinding(findings, lawId, filePath, checkId, `${filePath} must contain ${token}.`);
  }
};

export const inspectPick3TrendDisplay = (
  findings: InspectorFinding[],
  trendDisplayLaw: string,
  lawText: string,
  blueprintText: string,
): void => {
  requireTokens(findings, trendDisplayLaw, lawPath, lawText, "pick3-is-blind-eval/trend-law", ["GRASSEYE-PICK3-TREND-DISPLAY-010-V1", "stored official `pick3_draws`", "fixed 80-draw window", "three separated rows", "Hover exposes phase, official drawn numbers, and expected prize time", "/api/pick3-is-blind-eval/trend", "Mouse drag changes the historical start index", "lastTargetPhase", "database-backed phase"]);
  requireTokens(findings, trendDisplayLaw, blueprintPath, blueprintText, "pick3-is-blind-eval/trend-blueprint", ["## Official Trend Display", "official sync -> pick3_draws -> listPick3TrendSnapshot", "GET /api/pick3-is-blind-eval/trend", "windowSize: 80", "Default view = latest 80 stored official draws", "Rows = hundreds, tens, ones as three separated rows", "Hover point info = phase + official drawn numbers + expected prize time", "Dragging right/left changes the window location", "Historical Target Range Selection", "targetDraws = last batchSize eligible draws ending at lastTargetPhase", "dropdown populated from stored official pick3_draws"]);
  requireTokens(findings, trendDisplayLaw, flowPath, readRepoTextIfExists(flowPath), "pick3-is-blind-eval/last-target-phase-flow", ["lastTargetPhase", "lastPhase"]);
  requireTokens(findings, trendDisplayLaw, storagePath, readRepoTextIfExists(storagePath), "pick3-is-blind-eval/last-target-phase-storage", ["lastPhase", "index <= lastIndex", "slice(-input.batchSize)"]);
  requireTokens(findings, trendDisplayLaw, appShellLayoutPath, readRepoTextIfExists(appShellLayoutPath), "pick3-is-blind-eval/last-target-phase-ui", ["name=\"lastTargetPhase\"", "data-pick3-last-target-phase", "Last target phase", "walks backward by batch size", "<select"]);
  requireTokens(findings, trendDisplayLaw, pick3ClientPath, readRepoTextIfExists(pick3ClientPath), "pick3-is-blind-eval/last-target-phase-client-wire", ["renderPick3TargetClient", "lastTargetPhase"]);
  requireTokens(findings, trendDisplayLaw, pick3TargetClientPath, readRepoTextIfExists(pick3TargetClientPath), "pick3-is-blind-eval/last-target-phase-client", ["renderPick3LastTargetPhaseOptions", "data-pick3-last-target-phase", "index >= windowSize", "Latest stored target"]);
  requireTokens(findings, trendDisplayLaw, trendPath, readRepoTextIfExists(trendPath), "pick3-is-blind-eval/trend-read-model", ["listPick3TrendSnapshot", "openPick3Storage", "storage.listDrawsAscending()", "windowSize: PICK3_WINDOW_SIZE", "source: \"pick3_draws\"", "latestWindowStartIndex"]);
  requireTokens(findings, trendDisplayLaw, workbenchPick3RoutesPath, readRepoTextIfExists(workbenchPick3RoutesPath), "pick3-is-blind-eval/trend-route", ["handlePick3Trend", "/api/pick3-is-blind-eval/trend", "workbench.listPick3TrendSnapshot()"]);
  requireTokens(findings, trendDisplayLaw, workbenchApiBoundaryPath, readRepoTextIfExists(workbenchApiBoundaryPath), "pick3-is-blind-eval/trend-api-boundary", ["/api/pick3-is-blind-eval/trend", "local_pick3_trend_snapshot", "externalApiAllowed: false"]);
  requireTokens(findings, trendDisplayLaw, workbenchPick3SupportPath, readRepoTextIfExists(workbenchPick3SupportPath), "pick3-is-blind-eval/trend-workbench-handle", ["listPick3TrendSnapshot(dataDir)"]);
  requireTokens(findings, trendDisplayLaw, appShellLayoutPath, readRepoTextIfExists(appShellLayoutPath), "pick3-is-blind-eval/trend-app-shell", ["data-workspace-page=\"trend\"", "data-pick3-trend-chart", "data-pick3-trend-tooltip", "data-pick3-trend-refresh"]);
  requireTokens(findings, trendDisplayLaw, pick3TrendClientPath, readRepoTextIfExists(pick3TrendClientPath), "pick3-is-blind-eval/trend-ui-client", ["pick3TrendPositions", "windowSize || 80", "showPick3TrendTooltip", "formatPick3TrendInfo", "bindPick3TrendDrag", "dragStartIndex", "/api/pick3-is-blind-eval/trend"]);
};
