import { readFileSync } from "node:fs";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";
import { containsAny } from "../../shared/no-regex.js";
import { resolveFromRepo } from "../../shared/paths.js";

const facebookPagePath = "src/app/workbench-home-page.ts";
const facebookClientPath = "src/app/workbench-home-client.ts";
const facebookSchemaPath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.schema.ts";
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
  const forbiddenVisibleFields = ["feedEntryUrl", "providerKind", "modelName", "maxRounds", "maxMinutes"] as const;
  const visibleField = forbiddenVisibleFields.find((fieldName) => pageText.includes(`name="${fieldName}"`));
  if (visibleField) {
    findings.push(createFinding({
      checkId: "facebook-mining/forbidden-visible-advanced-input",
      lawId,
      filePath: facebookPagePath,
      message: "Facebook workbench must not expose feed URL, provider, model, max rounds, or max minutes inputs.",
      evidence: visibleField,
    }));
  }
};

const inspectForbiddenClientPayload = (
  findings: InspectorFinding[],
  lawId: string,
  clientText: string,
): void => {
  const forbiddenPayloadMarkers = [
    "feedEntryUrl: form.",
    "providerKind: form.",
    "modelName: form.",
    "maxRounds: Number",
    "maxMinutes: Number",
  ] as const;
  if (containsAny(clientText, forbiddenPayloadMarkers)) {
    findings.push(createFinding({
      checkId: "facebook-mining/forbidden-client-payload-advanced-input",
      lawId,
      filePath: facebookClientPath,
      message: "Facebook client mission payload must submit only targetProductCount from the visible form.",
      evidence: forbiddenPayloadMarkers.find((marker) => clientText.includes(marker)),
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

export { inspectFacebookSafetyDefaults } from "./input-surface-safety-inspector.js";
