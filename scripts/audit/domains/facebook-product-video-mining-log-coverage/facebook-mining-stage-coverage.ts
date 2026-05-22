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

type StageCoverageScan = {
  text: string;
  entry: FacebookStageCoverageEntry;
};

const terminalPattern = /(?:complete|fail|skip|reviewRequired|RUNTIME_STAGE_COMPLETED|RUNTIME_STAGE_FAILED|RUNTIME_STAGE_SKIPPED|RUNTIME_STAGE_REVIEW_REQUIRED|status\s*:\s*["'](?:success|failed|skipped|review_required)["'])/u;

const readOwners = (ownerFiles: readonly string[]): string =>
  ownerFiles.map((file) => existsSync(resolveFromRepo(file)) ? readFileSync(resolveFromRepo(file), "utf8") : "").join("\n");

const buildStageCoverageScan = (contract: typeof FACEBOOK_MINING_STAGE_CONTRACTS[number]): StageCoverageScan => {
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
  return {
    text,
    entry: {
      stageName: contract.stageName,
      ownerFiles: contract.ownerFiles,
      hasStartedLog,
      hasTerminalLog,
      missingFields,
    },
  };
};

const buildStageCoverageFinding = (
  contract: typeof FACEBOOK_MINING_STAGE_CONTRACTS[number],
  text: string,
  missingFields: readonly string[],
): FacebookLogCoverageFinding => {
  const primaryFile = contract.ownerFiles[0] ?? "src/plugins/facebook-product-video-mining";
  return {
    checkId: "facebook-log-coverage/mandatory-stage",
    lawId: FacebookLogCoverageLaw.STAGE_MATRIX,
    file: primaryFile,
    line: findLine(text, contract.stageName),
    severity: "fatal",
    message: "Facebook mining mandatory stage is missing log coverage",
    hint: `Add started and terminal logs for ${contract.stageName} in ${contract.ownerFiles.join(", ")}. Missing fields: ${missingFields.join(", ") || "started/terminal pair"}.`,
  };
};

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
    const scan = buildStageCoverageScan(contract);
    stageCoverage.push(scan.entry);
    if (scan.entry.hasStartedLog && scan.entry.hasTerminalLog && scan.entry.missingFields.length === 0) continue;
    findings.push(buildStageCoverageFinding(contract, scan.text, scan.entry.missingFields));
  }

  const coveredStageCount = stageCoverage.filter((stage) => stage.hasStartedLog && stage.hasTerminalLog && stage.missingFields.length === 0).length;
  const stageCoveragePercent = Math.round((coveredStageCount / FACEBOOK_MINING_STAGE_CONTRACTS.length) * 100);
  return { findings, inspectedFiles, stageCoverage, coveredStageCount, stageCoveragePercent };
};
