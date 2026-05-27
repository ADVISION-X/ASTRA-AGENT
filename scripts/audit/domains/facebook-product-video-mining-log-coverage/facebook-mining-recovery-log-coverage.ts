import { existsSync, readFileSync } from "node:fs";

import { resolveFromRepo } from "../../shared/paths.js";
import { findLine } from "../runtime-log-spine/source-read.js";
import { FacebookLogCoverageLaw, FACEBOOK_MINING_OWNER_FILES, type FacebookLogCoverageFinding } from "./constants.js";

const recoveryTokens = ["fallback", "retry", "restore", "recover", "focusExistingFacebookVideoTab", "closeCommentSurface", "ArrowDown", "scroll", "reopen"] as const;
const requiredTokens = ["recoveryTrail", "action", "status", "reason", "durationMs", "beforeHash", "afterHash"] as const;

export const collectFacebookMiningRecoveryLogCoverage = (): {
  findings: FacebookLogCoverageFinding[];
  inspectedFiles: string[];
} => {
  const findings: FacebookLogCoverageFinding[] = [];
  for (const file of FACEBOOK_MINING_OWNER_FILES) {
    if (!existsSync(resolveFromRepo(file))) continue;
    const text = readFileSync(resolveFromRepo(file), "utf8");
    const lowered = text.toLowerCase();
    if (!recoveryTokens.some((token) => lowered.includes(token.toLowerCase()))) continue;
    const missing = requiredTokens.filter((token) => !text.includes(token));
    if (missing.length === 0) continue;
    findings.push({
      checkId: "facebook-log-coverage/recovery-trail",
      lawId: FacebookLogCoverageLaw.RECOVERY_TRAIL,
      file,
      line: findLine(text, recoveryTokens),
      severity: "fatal",
      message: "Facebook recovery/fallback path lacks recoveryTrail logging",
      hint: `Add RECOVERY_STARTED/COMPLETED/FAILED events and include recoveryTrail linked to original failure. Missing: ${missing.join(", ")}.`,
    });
  }
  return { findings, inspectedFiles: [...FACEBOOK_MINING_OWNER_FILES] };
};
