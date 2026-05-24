import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { collectFacebookMiningAiLogCoverage } from "./facebook-mining-ai-log-coverage.js";
import { collectFacebookMiningArtifactLogCoverage } from "./facebook-mining-artifact-log-coverage.js";
import { collectFacebookMiningFailureCoverage } from "./facebook-mining-failure-coverage.js";
import {
  renderFacebookLogCoverageMarkdown,
  type FacebookLogCoverageReport,
  writeFacebookLogCoverageReport,
  toInspectorFinding,
} from "./facebook-mining-report-writer.js";
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

type StageSectionRun = SectionRun & ReturnType<typeof collectFacebookMiningStageCoverage>;

type SectionRuns = {
  stage: StageSectionRun;
  failure: SectionRun & ReturnType<typeof collectFacebookMiningFailureCoverage>;
  ai: SectionRun & ReturnType<typeof collectFacebookMiningAiLogCoverage>;
  navigation: SectionRun & ReturnType<typeof collectFacebookMiningNavigationLogCoverage>;
  recovery: SectionRun & ReturnType<typeof collectFacebookMiningRecoveryLogCoverage>;
  artifact: SectionRun & ReturnType<typeof collectFacebookMiningArtifactLogCoverage>;
};

const statusOf = (findings: readonly FacebookLogCoverageFinding[]): "PASS" | "FAIL" =>
  findings.length === 0 ? "PASS" : "FAIL";

const collectSectionRuns = (context: InspectorContext): SectionRuns => {
  const stage = collectFacebookMiningStageCoverage(context);
  const failure = collectFacebookMiningFailureCoverage();
  const ai = collectFacebookMiningAiLogCoverage();
  const navigation = collectFacebookMiningNavigationLogCoverage();
  const recovery = collectFacebookMiningRecoveryLogCoverage();
  const artifact = collectFacebookMiningArtifactLogCoverage();

  return {
    stage: { name: "stage coverage table", ...stage, coveragePercent: stage.stageCoveragePercent },
    failure: { name: "failure coverage table", ...failure },
    ai: { name: "AI coverage", ...ai },
    navigation: { name: "navigation coverage", ...navigation },
    recovery: { name: "recovery coverage", ...recovery },
    artifact: { name: "artifact coverage", ...artifact },
  };
};

const buildReportSections = (sections: readonly SectionRun[]): FacebookLogCoverageSection[] =>
  sections.map((section) => ({
    name: section.name,
    status: statusOf(section.findings),
    findingCount: section.findings.length,
    ...(section.coveragePercent !== undefined ? { coveragePercent: section.coveragePercent } : {}),
  }));

const collectMissingMandatoryStages = (stageCoverage: ReturnType<typeof collectFacebookMiningStageCoverage>["stageCoverage"]) =>
  FACEBOOK_MINING_STAGE_CONTRACTS.filter((contract) =>
    stageCoverage.some((coverage) =>
      coverage.stageName === contract.stageName
      && (!coverage.hasStartedLog || !coverage.hasTerminalLog || coverage.missingFields.length > 0),
    ),
  );

const toSectionList = (sectionRuns: SectionRuns) => [
  sectionRuns.stage,
  sectionRuns.failure,
  sectionRuns.ai,
  sectionRuns.navigation,
  sectionRuns.recovery,
  sectionRuns.artifact,
] as const;

const buildFacebookCoverageReport = (
  sectionRuns: SectionRuns,
  reportSections: readonly FacebookLogCoverageSection[],
  findings: readonly FacebookLogCoverageFinding[],
  missingMandatoryStages: readonly (typeof FACEBOOK_MINING_STAGE_CONTRACTS)[number][],
): FacebookLogCoverageReport => ({
  generatedAt: new Date().toISOString(),
  status: findings.length === 0 ? "PASS" : "FAIL",
  summary: {
    totalFindings: findings.length,
    fatalFindings: findings.length,
    mandatoryStageCount: FACEBOOK_MINING_STAGE_CONTRACTS.length,
    coveredStageCount: sectionRuns.stage.coveredStageCount,
    stageCoveragePercent: sectionRuns.stage.stageCoveragePercent,
  },
  sections: [...reportSections],
  stageCoverage: sectionRuns.stage.stageCoverage,
  failureCoverage: sectionRuns.failure.findings,
  aiCoverage: sectionRuns.ai.findings,
  navigationCoverage: sectionRuns.navigation.findings,
  recoveryCoverage: sectionRuns.recovery.findings,
  artifactCoverage: sectionRuns.artifact.findings,
  missingMandatoryStages: [...missingMandatoryStages],
  findings: [...findings],
});

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const sectionRuns = collectSectionRuns({ ...context, project: context.project });
  const sections = toSectionList(sectionRuns);
  const findings = sections.flatMap((section) => section.findings);
  const inspectedFiles = [...new Set(sections.flatMap((section) => section.inspectedFiles))].sort();
  const reportSections = buildReportSections(sections);
  const missingMandatoryStages = collectMissingMandatoryStages(sectionRuns.stage.stageCoverage);
  const report = buildFacebookCoverageReport(sectionRuns, reportSections, findings, missingMandatoryStages);

  writeFacebookLogCoverageReport(report);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings: findings.map(toInspectorFinding),
    inspectedFiles,
    reportJson: report,
    reportMarkdown: renderFacebookLogCoverageMarkdown(report),
  };
};
