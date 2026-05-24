import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { runCodePurityPhases } from "./components/code-purity-phase-runner.js";

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const project = context.project;
  const phaseRun = await runCodePurityPhases({ ...context, project });
  const status = phaseRun.findings.length > 0 ? "FAIL" : "PASS";

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings: phaseRun.findings,
    inspectedFiles: [...phaseRun.inspectedFiles].sort(),
    reportJson: {
      antiEvasionFindingCount: phaseRun.summary.antiEvasionFindingCount
        + phaseRun.findings.filter((finding) => finding.checkId === "code-purity/no-regex").length,
      capabilityDomain: context.planEntry.capabilityDomain,
      commentedOutCodeCount: phaseRun.summary.commentedOutCodeCount,
      deadBranchCount: phaseRun.summary.deadBranchCount,
      executionGroup: context.planEntry.executionGroup,
      findings: phaseRun.findings,
      generatedAt: new Date().toISOString(),
      inspectedFiles: [...phaseRun.inspectedFiles].sort(),
      lawIds: context.planEntry.lawIds,
      liveEntryPoints: phaseRun.summary.liveEntryPoints,
      liveExportCount: phaseRun.summary.liveExportCount,
      orphanDeclarationCount: phaseRun.summary.orphanDeclarationCount,
      reachableFileCount: phaseRun.summary.reachableFileCount,
      status,
      unreachableFileCount: phaseRun.summary.unreachableFileCount,
      zombieExportCount: phaseRun.summary.zombieExportCount,
      zombieSummary: {
        antiEvasionFindingCount: phaseRun.summary.antiEvasionFindingCount
          + phaseRun.findings.filter((finding) => finding.checkId === "code-purity/no-regex").length,
        commentedOutCodeCount: phaseRun.summary.commentedOutCodeCount,
        deadBranchCount: phaseRun.summary.deadBranchCount,
        liveExportCount: phaseRun.summary.liveExportCount,
        orphanDeclarationCount: phaseRun.summary.orphanDeclarationCount,
        reachableFileCount: phaseRun.summary.reachableFileCount,
        unreachableFileCount: phaseRun.summary.unreachableFileCount,
        zombieExportCount: phaseRun.summary.zombieExportCount,
      },
    },
  };
};