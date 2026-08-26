import { selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorEvaluation, type InspectorFinding, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { producerModePassed, staticClauses, staticEvidenceRefs, validateStaticInspection } from "../../shared/static-inspection-contract.js";
import { inspectAuthenticatedChannelGuards } from "./authenticated-channel-inspection.js";
import { inspectAtomicIfAndThenBoundary, inspectJournalRecoveryBoundary, inspectRegistryAndMutationBoundary } from "./mutation-atomicity-inspection.js";
import { inspectOpaqueAuthorityBoundary } from "./opaque-proof-inspection.js";
import { inspectAutomaticPairingAndReload, inspectReleaseAndRetiredPaths } from "./release-boundary-inspection.js";
import { inspectSessionCore } from "./session-core-inspection.js";
import { inspectTargetClaimGuards } from "./target-claim-inspection.js";

const inspectDomainEvaluation = async (context: InspectorContext): Promise<InspectorEvaluation> => {
  const lawId = selectLawId(context.planEntry.lawIds, "LAW-LOCAL-BROWSER-SESSION-001-V4");
  const mutationLawId = selectLawId(context.planEntry.lawIds, "LAW-LOCAL-BROWSER-SESSION-004-V8");
  const channelLawId = selectLawId(context.planEntry.lawIds, "LAW-LOCAL-BROWSER-SESSION-002-V5");
  const claimLawId = selectLawId(context.planEntry.lawIds, "LAW-LOCAL-BROWSER-SESSION-003-V8");
  const releaseLawId = selectLawId(context.planEntry.lawIds, "LAW-LOCAL-BROWSER-SESSION-005-V5");
  const opaqueLawId = selectLawId(context.planEntry.lawIds, "LAW-LOCAL-BROWSER-SESSION-006-V3");
  const findings: InspectorFinding[] = [];
  inspectSessionCore(context, findings, lawId);
  inspectRegistryAndMutationBoundary(context, findings, mutationLawId);
  inspectAtomicIfAndThenBoundary(context, findings, mutationLawId);
  inspectJournalRecoveryBoundary(context, findings, mutationLawId);
  inspectAuthenticatedChannelGuards(context, findings, channelLawId);
  inspectAutomaticPairingAndReload(context, findings, channelLawId, claimLawId, releaseLawId);
  inspectTargetClaimGuards(context, findings, claimLawId);
  inspectReleaseAndRetiredPaths(findings, releaseLawId);
  inspectOpaqueAuthorityBoundary(context, findings, opaqueLawId);
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...context.targetPaths].sort(),
  };
};


export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  const evaluation = await inspectDomainEvaluation(context);
  const lawResult = (lawId: string, astClauses: string[], hasContract = true) => {
    const findings = evaluation.findings.filter((finding) => finding.lawId === lawId);
      const assertions = [{ clauses: astClauses, evidenceMode: "static.ast", passed: producerModePassed(findings, "static.ast"),
      refs: staticEvidenceRefs(context, lawId, "static.ast") }];
    if (hasContract) assertions.push({ clauses: staticClauses(0), evidenceMode: "static.contract", passed: producerModePassed(findings, "static.contract"),
      refs: staticEvidenceRefs(context, lawId, "static.contract") });
    return { lawId, assertions, findings };
  };
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain, reportedLawIds: evaluation.reportedLawIds,
    lawResults: [
      lawResult("LAW-LOCAL-BROWSER-SESSION-001-V4", staticClauses(0, 1, 2, 3, 4, 5, 6, 7, 8, 9)),
      lawResult("LAW-LOCAL-BROWSER-SESSION-002-V5", staticClauses(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13)),
      lawResult("LAW-LOCAL-BROWSER-SESSION-003-V8", staticClauses(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13)),
      lawResult("LAW-LOCAL-BROWSER-SESSION-004-V8", staticClauses(10, 11, 12, 13, 14, 15, 16), false),
      lawResult("LAW-LOCAL-BROWSER-SESSION-005-V5", staticClauses(0, 1, 2, 3, 4, 5, 6)),
      lawResult("LAW-LOCAL-BROWSER-SESSION-006-V3", staticClauses(0)),
    ], inspectedFiles: evaluation.inspectedFiles,
  });
};
