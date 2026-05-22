import { readFileSync } from "node:fs";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const requiredRoundStates = [
  "WAIT_VIDEO_STABLE",
  "SNAPSHOT_PAGE_FACTS",
  "LOAD_COMMENTS",
  "DOWNLOAD_VIDEO",
  "AI_JUDGE",
  "RECORD_RESULT",
  "ADVANCE_VIDEO",
  "VERIFY_NEW_VIDEO",
] as const;

const pushMissingRoundStateFindings = (
  findings: InspectorFinding[],
  lawId: string,
  runtimePath: string,
  runtimeText: string,
): void => {
  for (const state of requiredRoundStates) {
    if (!runtimeText.includes(state)) {
      findings.push(createFinding({
        checkId: "facebook-mining/round-state-machine",
        lawId,
        filePath: runtimePath,
        message: `Facebook round state machine must declare ${state}.`,
      }));
    }
  }
};

const pushNavigationLadderFindings = (
  findings: InspectorFinding[],
  lawId: string,
  navigationPath: string,
  navigationText: string,
): void => {
  if (!navigationText.includes("pressArrowDownForNextVideo")
    || !navigationText.includes("wheelScrollForNextVideo")
    || !navigationText.includes("safeZoneClickForNextVideo")
    || !navigationText.includes("ensureFacebookFeedTab")) {
    findings.push(createFinding({
      checkId: "facebook-mining/fixed-navigation-action-ladder",
      lawId,
      filePath: navigationPath,
      message: "Facebook next-video navigation must use the fixed ArrowDown, wheel scroll, safe-zone, recover action ladder.",
    }));
  }
};

const pushNavigationProofFindings = (
  findings: InspectorFinding[],
  lawId: string,
  navigationPath: string,
  navigationText: string,
  proofText: string,
): void => {
  if (!navigationText.includes("collectChangedNavigationSignals")
    || !proofText.includes("changedSignals.length >= 2")
    || !navigationText.includes("next_video_not_confirmed")) {
    findings.push(createFinding({
      checkId: "facebook-mining/navigation-proof-quorum",
      lawId,
      filePath: navigationPath,
      message: "Facebook next-video verification must require a two-signal proof quorum and record unconfirmed navigation as non-terminal.",
    }));
  }
};

const pushForbiddenNavigationControlFindings = (
  findings: InspectorFinding[],
  lawId: string,
  navigationPath: string,
  navigationText: string,
  scriptText: string,
): void => {
  if (/clicked_next|next_video_did_not_change/u.test(navigationText + scriptText)) {
    findings.push(createFinding({
      checkId: "facebook-mining/no-dom-next-primary-controller",
      lawId,
      filePath: navigationPath,
      message: "Facebook navigation must not restore DOM next button candidate control or terminal next_video_did_not_change behavior.",
    }));
  }
};

export const inspectStateMachineNavigationProof = (
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const runtimePath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-runtime.ts";
  const navigationPath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.navigation.ts";
  const proofPath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.navigation-proof.ts";
  const scriptPath = "src/plugins/facebook-product-video-mining/facebook-product-video-mining.navigation-scripts.ts";
  for (const repoPath of [runtimePath, navigationPath, proofPath, scriptPath]) inspectedFiles.add(repoPath);
  const runtimeText = readFileSync(resolveFromRepo(runtimePath), "utf8");
  const navigationText = readFileSync(resolveFromRepo(navigationPath), "utf8");
  const proofText = readFileSync(resolveFromRepo(proofPath), "utf8");
  const scriptText = readFileSync(resolveFromRepo(scriptPath), "utf8");
  pushMissingRoundStateFindings(findings, lawId, runtimePath, runtimeText);
  pushNavigationLadderFindings(findings, lawId, navigationPath, navigationText);
  pushNavigationProofFindings(findings, lawId, navigationPath, navigationText, proofText);
  pushForbiddenNavigationControlFindings(findings, lawId, navigationPath, navigationText, scriptText);
};
