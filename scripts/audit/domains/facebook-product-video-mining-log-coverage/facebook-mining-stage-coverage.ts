import { existsSync, readFileSync } from "node:fs";

import { resolveFromRepo } from "../../shared/paths.js";
import { findLine } from "../runtime-log-spine/source-read.js";
import { FacebookLogCoverageLaw, type FacebookLogCoverageFinding } from "./constants.js";
import { FACEBOOK_MINING_STAGE_CONTRACTS } from "./facebook-mining-stage-matrix.js";

export type FacebookStageCoverageEntry = {
  stageName: string;
  ownerFiles: string[];
  hasStartedLog: boolean;
  hasTerminalLog: boolean;
  missingFields: string[];
};

const terminalPattern = /(?:complete|fail|skip|reviewRequired|RUNTIME_STAGE_COMPLETED|RUNTIME_STAGE_FAILED|RUNTIME_STAGE_SKIPPED|RUNTIME_STAGE_REVIEW_REQUIRED|status\s*:\s*["'](?:success|failed|skipped|review_required)["'])/u;

const readOwners = (ownerFiles: readonly string[]): string =>
  ownerFiles.map((file) => existsSync(resolveFromRepo(file)) ? readFileSync(resolveFromRepo(file), "utf8") : "").join("\n");

export const collectFacebookMiningStageCoverage = (): {
  findings: FacebookLogCoverageFinding[];
  inspectedFiles: string[];
  stageCoverage: FacebookStageCoverageEntry[];
  coveredStageCount: number;
  stageCoveragePercent: number;
} => {
  const findings: FacebookLogCoverageFinding[] = [];
  const inspectedFiles = [...new Set(FACEBOOK_MINING_STAGE_CONTRACTS.flatMap((contract) => contract.ownerFiles))].sort();
  const stageCoverage: FacebookStageCoverageEntry[] = [];

  for (const contract of FACEBOOK_MINING_STAGE_CONTRACTS) {
    const text = readOwners(contract.ownerFiles);
    const hasStageName = text.includes(contract.stageName);
    const hasStartedLog = hasStageName && /(?:start\(|RUNTIME_STAGE_STARTED|status\s*:\s*["']started["'])/u.test(text);
    const hasTerminalLog = hasStageName && terminalPattern.test(text);
    const requiredFields = [
      ...contract.requiredRefs,
      ...contract.requiredHashes,
      ...contract.requiredMetrics,
      ...contract.requiredFailureClasses,
    ];
    const missingFields = requiredFields.filter((field) => !text.includes(field));
    stageCoverage.push({
      stageName: contract.stageName,
      ownerFiles: contract.ownerFiles,
      hasStartedLog,
      hasTerminalLog,
      missingFields,
    });
    if (hasStartedLog && hasTerminalLog && missingFields.length === 0) continue;
    const primaryFile = contract.ownerFiles[0] ?? "src/plugins/facebook-product-video-mining";
    findings.push({
      checkId: "facebook-log-coverage/mandatory-stage",
      lawId: FacebookLogCoverageLaw.STAGE_MATRIX,
      file: primaryFile,
      line: findLine(text, contract.stageName),
      severity: "fatal",
      message: "Facebook mining mandatory stage is missing log coverage",
      hint: `Add started and terminal logs for ${contract.stageName} in ${contract.ownerFiles.join(", ")}. Missing fields: ${missingFields.join(", ") || "started/terminal pair"}.`,
    });
  }

  const coveredStageCount = stageCoverage.filter((stage) => stage.hasStartedLog && stage.hasTerminalLog && stage.missingFields.length === 0).length;
  const stageCoveragePercent = Math.round((coveredStageCount / FACEBOOK_MINING_STAGE_CONTRACTS.length) * 100);
  return { findings, inspectedFiles, stageCoverage, coveredStageCount, stageCoveragePercent };
};
