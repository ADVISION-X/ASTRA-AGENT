import { readFileSync } from "node:fs";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const facebookPagePath = "src/app/workbench-home-page.ts";
const facebookClientPath = "src/app/workbench-home-client.ts";
const facebookSchemaPath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.schema.ts";
const facebookAiJudgePath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-judge.ts";
const facebookAiTimeoutPath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-timeout.ts";
const facebookSelectionExportPath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.selection-export.ts";

const readRepoText = (repoPath: string): string => readFileSync(resolveFromRepo(repoPath), "utf8");

const inspectTargetCountInput = (
  findings: InspectorFinding[],
  lawId: string,
  pageText: string,
): void => {
  if (!pageText.includes('name="targetProductCount"')) {
    findings.push(createFinding({
      checkId: "facebook-mining/minimal-target-count-input",
      lawId,
      filePath: facebookPagePath,
      message: "Facebook workbench must expose targetProductCount as the only operator mission input.",
    }));
  }
};

const inspectForbiddenVisibleInputs = (
  findings: InspectorFinding[],
  lawId: string,
  pageText: string,
): void => {
  const forbiddenVisibleFields = /name="(?:feedEntryUrl|providerKind|modelName|maxRounds|maxMinutes)"/u;
  if (forbiddenVisibleFields.test(pageText)) {
    findings.push(createFinding({
      checkId: "facebook-mining/forbidden-visible-advanced-input",
      lawId,
      filePath: facebookPagePath,
      message: "Facebook workbench must not expose feed URL, provider, model, max rounds, or max minutes inputs.",
      evidence: String(forbiddenVisibleFields),
    }));
  }
};

const inspectForbiddenClientPayload = (
  findings: InspectorFinding[],
  lawId: string,
  clientText: string,
): void => {
  const forbiddenClientPayload = /feedEntryUrl:\s*form\.|providerKind:\s*form\.|modelName:\s*form\.|maxRounds:\s*Number|maxMinutes:\s*Number/u;
  if (forbiddenClientPayload.test(clientText)) {
    findings.push(createFinding({
      checkId: "facebook-mining/forbidden-client-payload-advanced-input",
      lawId,
      filePath: facebookClientPath,
      message: "Facebook client mission payload must submit only targetProductCount from the visible form.",
      evidence: String(forbiddenClientPayload),
    }));
  }
};

const inspectSchemaDefaultMarkers = (
  findings: InspectorFinding[],
  lawId: string,
  schemaText: string,
): void => {
  for (const marker of [
    "DEFAULT_FACEBOOK_MINING_FEED_ENTRY_URL",
    "DEFAULT_FACEBOOK_MINING_PROVIDER_KIND",
    "DEFAULT_FACEBOOK_MINING_MAX_MINUTES",
    "FACEBOOK_MINING_ROUNDS_PER_TARGET",
  ]) {
    if (!schemaText.includes(marker)) {
      findings.push(createFinding({
        checkId: "facebook-mining/schema-default-mission-parameter",
        lawId,
        filePath: facebookSchemaPath,
        message: `Facebook mission schema must own automatic default marker ${marker}.`,
      }));
    }
  }
};

const inspectResultSurface = (
  findings: InspectorFinding[],
  lawId: string,
  pageText: string,
  clientText: string,
): void => {
  if (!pageText.includes("data-facebook-record-list") || !pageText.includes("data-facebook-export")) {
    findings.push(createFinding({
      checkId: "facebook-mining/saved-records-visible-export",
      lawId,
      filePath: facebookPagePath,
      message: "Facebook workbench must display saved product records and expose an export control.",
    }));
  }
  if (!clientText.includes("/api/facebook-product-video-mining/results?runId=")
    || !clientText.includes("/api/facebook-product-video-mining/export?runId=")) {
    findings.push(createFinding({
      checkId: "facebook-mining/saved-records-client-fetch",
      lawId,
      filePath: facebookClientPath,
      message: "Facebook client must read saved records and export selection data for the active run.",
    }));
  }
};

const inspectSelectionExportOwner = (
  findings: InspectorFinding[],
  lawId: string,
  exportText: string,
): void => {
  if (!exportText.includes("c.status = 'saved'") || !exportText.includes("c.ai_selected_option_id = 'PRODUCT_SEEDING'")) {
    findings.push(createFinding({
      checkId: "facebook-mining/export-saved-product-only",
      lawId,
      filePath: facebookSelectionExportPath,
      message: "Facebook selection export must include only saved PRODUCT_SEEDING candidates.",
    }));
  }
};

export const inspectMinimalOperatorInput = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  for (const repoPath of [facebookPagePath, facebookClientPath, facebookSchemaPath]) inspectedFiles.add(repoPath);
  inspectTargetCountInput(findings, lawId, readRepoText(facebookPagePath));
  inspectForbiddenVisibleInputs(findings, lawId, readRepoText(facebookPagePath));
  inspectForbiddenClientPayload(findings, lawId, readRepoText(facebookClientPath));
  inspectSchemaDefaultMarkers(findings, lawId, readRepoText(facebookSchemaPath));
};

export const inspectSavedRecordExportSurface = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  for (const repoPath of [facebookPagePath, facebookClientPath, facebookSelectionExportPath]) inspectedFiles.add(repoPath);
  inspectResultSurface(findings, lawId, readRepoText(facebookPagePath), readRepoText(facebookClientPath));
  inspectSelectionExportOwner(findings, lawId, readRepoText(facebookSelectionExportPath));
};

export const inspectFacebookSafetyDefaults = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  for (const repoPath of [facebookSchemaPath, facebookAiJudgePath, facebookAiTimeoutPath]) inspectedFiles.add(repoPath);
  const schemaText = readRepoText(facebookSchemaPath);
  const aiJudgeText = readRepoText(facebookAiJudgePath);
  const aiTimeoutText = readRepoText(facebookAiTimeoutPath);
  if (!/notInterestedEnabled:\s*z\.boolean\(\)\.default\(false\)/u.test(schemaText)) {
    findings.push(createFinding({
      checkId: "facebook-mining/not-interested-default-off",
      lawId,
      filePath: facebookSchemaPath,
      message: "Facebook mining must keep notInterestedEnabled off by default to avoid polluting the operator's feed.",
    }));
  }
  if (!/executeFacebookAiFeedWithHardTimeout/u.test(aiJudgeText) || !/AbortController/u.test(aiTimeoutText)) {
    findings.push(createFinding({
      checkId: "facebook-mining/ai-hard-timeout",
      lawId,
      filePath: facebookAiTimeoutPath,
      message: "Facebook AI judgment must have a hard timeout and abort signal so runs cannot remain running indefinitely.",
    }));
  }
};
