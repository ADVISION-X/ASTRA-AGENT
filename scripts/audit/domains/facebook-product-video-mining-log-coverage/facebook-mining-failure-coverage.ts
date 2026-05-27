import { existsSync, readFileSync } from "node:fs";

import { resolveFromRepo } from "../../shared/paths.js";
import { findLine } from "../runtime-log-spine/source-read.js";
import { FacebookLogCoverageLaw, FACEBOOK_MINING_OWNER_FILES, type FacebookLogCoverageFinding } from "./constants.js";

const failureKeywords = [
  "failed",
  "review_required",
  "skipped",
  "terminal",
  "true",
  "handleProbeFailure",
  "handleDownloadFailure",
  "handleJudgmentFailure",
  "next_video_did_not_change",
  "source_tab_not_found",
] as const;
const requiredTokens = ["failureClass", "reason", "recoveryPolicy", "terminal"] as const;

export const collectFacebookMiningFailureCoverage = (): {
  findings: FacebookLogCoverageFinding[];
  inspectedFiles: string[];
} => {
  const findings: FacebookLogCoverageFinding[] = [];
  for (const file of FACEBOOK_MINING_OWNER_FILES) {
    if (!existsSync(resolveFromRepo(file))) continue;
    const text = readFileSync(resolveFromRepo(file), "utf8");
    if (!failureKeywords.some((keyword) => text.includes(keyword))) continue;
    const missing = requiredTokens.filter((token) => !text.includes(token));
    if (missing.length === 0) continue;
    findings.push({
      checkId: "facebook-log-coverage/failure-contract",
      lawId: FacebookLogCoverageLaw.FAILURE_CLASS,
      file,
      line: findLine(text, failureKeywords),
      severity: "fatal",
      message: "Facebook mining failure path lacks failureClass contract",
      hint: `Classify this path as DOM_PROBE_FAILURE / MEDIA_DOWNLOAD_FAILURE / AI_PARSE_FAILURE / NAVIGATION_FAILURE / RECOVERABLE_BROWSER_DRIFT / ACCOUNT_SECURITY_BLOCKER etc. Missing: ${missing.join(", ")}.`,
    });
  }
  return { findings, inspectedFiles: [...FACEBOOK_MINING_OWNER_FILES] };
};
