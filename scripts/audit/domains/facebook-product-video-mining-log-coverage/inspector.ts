import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { collectFacebookMiningAiLogCoverage } from "./facebook-mining-ai-log-coverage.js";
import { collectFacebookMiningArtifactLogCoverage } from "./facebook-mining-artifact-log-coverage.js";
import { collectFacebookMiningFailureCoverage } from "./facebook-mining-failure-coverage.js";
import { writeFacebookLogCoverageReport, toInspectorFinding } from "./facebook-mining-report-writer.js";
import { collectFacebookMiningNavigationLogCoverage } from "./facebook-mining-navigation-log-coverage.js";
import { collectFacebookMiningRecoveryLogCoverage } from "./facebook-mining-recovery-log-coverage.js";
import { collectFacebookMiningStageCoverage } from "./facebook-mining-stage-coverage.js";
import { FACEBOOK_MINING_STAGE_CONTRACTS } from "./facebook-mining-stage-matrix.js";
import type { FacebookLogCoverageFinding, FacebookLogCoverageSection } from "./constants.js";

type SectionRun = {
  name: string;
  findings: FacebookLogCoverageFinding[];
  inspectedFiles: string[];
  coveragePercent?: number;
};

const statusOf = (findings: readonly FacebookLogCoverageFinding[]): "PASS" | "FAIL" =>
  findings.length === 0 ? "PASS" : "FAIL";

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const stage = collectFacebookMiningStageCoverage();
  const failure = collectFacebookMiningFailureCoverage();
  const ai = collectFacebookMiningAiLogCoverage();
  const navigation = collectFacebookMiningNavigationLogCoverage();
  const recovery = collectFacebookMiningRecoveryLogCoverage();
  const artifact = collectFacebookMiningArtifactLogCoverage();

  const sections: SectionRun[] = [
    { name: "stage coverage table", ...stage, coveragePercent: stage.stageCoveragePercent },
    { name: "failure coverage table", ...failure },
    { name: "AI coverage", ...ai },
    { name: "navigation coverage", ...navigation },
    { name: "recovery coverage", ...recovery },
    { name: "artifact coverage", ...artifact },
  ];
  const findings = sections.flatMap((section) => section.findings);
  const inspectedFiles = [...new Set(sections.flatMap((section) => section.inspectedFiles))].sort();
  const reportSections: FacebookLogCoverageSection[] = sections.map((section) => ({
    name: section.name,
    status: statusOf(section.findings),
    findingCount: section.findings.length,
    ...(section.coveragePercent !== undefined ? { coveragePercent: section.coveragePercent } : {}),
  }));
  const missingMandatoryStages = FACEBOOK_MINING_STAGE_CONTRACTS.filter((contract) =>
    stage.stageCoverage.some((coverage) =>
      coverage.stageName === contract.stageName
      && (!coverage.hasStartedLog || !coverage.hasTerminalLog || coverage.missingFields.length > 0),
    ),
  );

  writeFacebookLogCoverageReport({
    generatedAt: new Date().toISOString(),
    status: findings.length === 0 ? "PASS" : "FAIL",
    summary: {
      totalFindings: findings.length,
      fatalFindings: findings.length,
      mandatoryStageCount: FACEBOOK_MINING_STAGE_CONTRACTS.length,
      coveredStageCount: stage.coveredStageCount,
      stageCoveragePercent: stage.stageCoveragePercent,
    },
    sections: reportSections,
    stageCoverage: stage.stageCoverage,
    failureCoverage: failure.findings,
    aiCoverage: ai.findings,
    navigationCoverage: navigation.findings,
    recoveryCoverage: recovery.findings,
    artifactCoverage: artifact.findings,
    missingMandatoryStages,
    findings,
  });

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings: findings.map(toInspectorFinding),
    inspectedFiles,
  };
};
