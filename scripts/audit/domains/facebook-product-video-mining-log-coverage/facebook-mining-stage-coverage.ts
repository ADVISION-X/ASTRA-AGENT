import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { findLine } from "../runtime-log-spine/source-read.js";
import { FacebookLogCoverageLaw, type FacebookLogCoverageFinding } from "./constants.js";
import {
  collectSemanticFacebookStageSites,
  hasRequiredSemanticToken,
  hasRequiredVisibility,
  type FacebookStageCoverageSite,
} from "./facebook-mining-ast-stage-detector.js";
import { FACEBOOK_MINING_STAGE_CONTRACTS } from "./facebook-mining-stage-matrix.js";

type FacebookStageCoverageEntry = {
  stageName: string;
  ownerFiles: string[];
  hasStartedLog: boolean;
  hasTerminalLog: boolean;
  missingFields: string[];
  startSites: FacebookStageCoverageSite[];
  terminalSites: FacebookStageCoverageSite[];
  confidence: "semantic";
};

type SemanticStageSites = Parameters<typeof hasRequiredSemanticToken>[0];

const buildMissingFields = (input: {
  contract: typeof FACEBOOK_MINING_STAGE_CONTRACTS[number];
  startSites: SemanticStageSites;
  terminalSites: SemanticStageSites;
}): string[] => {
  const semanticSites = [...input.startSites, ...input.terminalSites];
  const missingFields = [
    ...input.contract.requiredRefs.filter((field) => !hasRequiredSemanticToken(semanticSites, field)),
    ...input.contract.requiredHashes.filter((field) => !hasRequiredSemanticToken(semanticSites, field)),
    ...input.contract.requiredMetrics.filter((field) => !hasRequiredSemanticToken(semanticSites, field)),
  ];
  if (input.contract.flowVisibility && !hasRequiredVisibility(input.startSites, "FLOW")) {
    missingFields.push("modeVisibility:FLOW");
  }
  if (input.contract.debugVisibility && !hasRequiredVisibility(input.startSites, "DEBUG")) {
    missingFields.push("modeVisibility:DEBUG");
  }
  if (input.contract.traceVisibility && !hasRequiredVisibility(input.startSites, "TRACE")) {
    missingFields.push("modeVisibility:TRACE");
  }
  return missingFields;
};

const buildStageCoverageFinding = (
  contract: typeof FACEBOOK_MINING_STAGE_CONTRACTS[number],
  entry: FacebookStageCoverageEntry,
  missingFields: readonly string[],
): FacebookLogCoverageFinding => {
  const primaryFile = contract.ownerFiles[0] ?? "src/plugins/facebook-product-video-mining";
  const primaryLine = entry.startSites[0]?.line ?? entry.terminalSites[0]?.line ?? findLine(contract.stageName, contract.stageName);
  return {
    checkId: "facebook-log-coverage/mandatory-stage",
    lawId: FacebookLogCoverageLaw.STAGE_MATRIX,
    file: primaryFile,
    line: primaryLine,
    severity: "fatal",
    message: "Facebook mining mandatory stage is missing log coverage",
    hint: `Add started and terminal logs for ${contract.stageName} in ${contract.ownerFiles.join(", ")}. Missing fields: ${missingFields.join(", ") || "started/terminal pair"}.`,
  };
};

export const collectFacebookMiningStageCoverage = (context: InspectorContext): {
  findings: FacebookLogCoverageFinding[];
  inspectedFiles: string[];
  stageCoverage: FacebookStageCoverageEntry[];
  coveredStageCount: number;
  stageCoveragePercent: number;
} => {
  const findings: FacebookLogCoverageFinding[] = [];
  const inspectedFiles = [...new Set(FACEBOOK_MINING_STAGE_CONTRACTS.flatMap((contract) => contract.ownerFiles))].sort();
  const stageCoverage: FacebookStageCoverageEntry[] = [];
  const sourceFiles = context.project.getSourceFiles().filter((sourceFile) => inspectedFiles.includes(getRepoSourcePath(sourceFile)));
  const semanticSites = collectSemanticFacebookStageSites(sourceFiles);

  for (const contract of FACEBOOK_MINING_STAGE_CONTRACTS) {
    const startSites = (semanticSites.startSitesByStage.get(contract.stageName) ?? []).filter((site) => contract.ownerFiles.includes(site.file));
    const terminalSites = (semanticSites.terminalSitesByStage.get(contract.stageName) ?? []).filter((site) => contract.ownerFiles.includes(site.file));
    const entry: FacebookStageCoverageEntry = {
      stageName: contract.stageName,
      ownerFiles: contract.ownerFiles,
      hasStartedLog: startSites.length > 0,
      hasTerminalLog: terminalSites.length > 0,
      missingFields: buildMissingFields({ contract, startSites, terminalSites }),
      startSites: startSites.map(({ file, line, method }) => ({ file, line, method })),
      terminalSites: terminalSites.map(({ file, line, method }) => ({ file, line, method })),
      confidence: "semantic",
    };
    stageCoverage.push(entry);
    if (entry.hasStartedLog && entry.hasTerminalLog && entry.missingFields.length === 0) continue;
    findings.push(buildStageCoverageFinding(contract, entry, entry.missingFields));
  }

  const coveredStageCount = stageCoverage.filter((stage) => stage.hasStartedLog && stage.hasTerminalLog && stage.missingFields.length === 0).length;
  const stageCoveragePercent = Math.round((coveredStageCount / FACEBOOK_MINING_STAGE_CONTRACTS.length) * 100);
  return { findings, inspectedFiles, stageCoverage, coveredStageCount, stageCoveragePercent };
};
