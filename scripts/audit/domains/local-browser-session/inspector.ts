import { selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorEvaluation, type InspectorFinding, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { producerModePassed, recordStaticCheck, staticClauses, staticEvidenceRefs, validateStaticInspection } from "../../shared/static-inspection-contract.js";
import { observeStaticAst, observeStaticContract } from "../../shared/static-target-object-inspector.js";
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
  const staticCheckReceipts: InspectorEvaluation["staticCheckReceipts"] = [];
  const run = (check: string, lawIds: readonly string[], action: () => void): void => recordStaticCheck({
    check, findings, lawIds, receipts: staticCheckReceipts, run: action,
  });
  run("inspectSessionCore", [lawId], () => inspectSessionCore(context, findings, lawId));
  run("inspectRegistryAndMutationBoundary", [mutationLawId], () => inspectRegistryAndMutationBoundary(context, findings, mutationLawId));
  run("inspectAtomicIfAndThenBoundary", [mutationLawId], () => inspectAtomicIfAndThenBoundary(context, findings, mutationLawId));
  run("inspectJournalRecoveryBoundary", [mutationLawId], () => inspectJournalRecoveryBoundary(context, findings, mutationLawId));
  run("inspectAuthenticatedChannelGuards", [channelLawId], () => inspectAuthenticatedChannelGuards(context, findings, channelLawId));
  run("inspectAutomaticPairingAndReload", [channelLawId, claimLawId, releaseLawId], () => inspectAutomaticPairingAndReload(context, findings, channelLawId, claimLawId, releaseLawId));
  run("inspectTargetClaimGuards", [claimLawId], () => inspectTargetClaimGuards(context, findings, claimLawId));
  run("inspectReleaseAndRetiredPaths", [releaseLawId], () => inspectReleaseAndRetiredPaths(findings, releaseLawId));
  run("inspectOpaqueAuthorityBoundary", [opaqueLawId], () => inspectOpaqueAuthorityBoundary(context, findings, opaqueLawId));
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...context.targetPaths].sort(),
    staticCheckReceipts,
  };
};


export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  const evaluation = await inspectDomainEvaluation(context);
  const semanticChecks = (lawId: string): string[] => ({
    "LAW-LOCAL-BROWSER-SESSION-001-V4": ["inspectSessionCore"],
    "LAW-LOCAL-BROWSER-SESSION-002-V5": ["inspectAuthenticatedChannelGuards", "inspectAutomaticPairingAndReload"],
    "LAW-LOCAL-BROWSER-SESSION-003-V8": ["inspectAutomaticPairingAndReload", "inspectTargetClaimGuards"],
    "LAW-LOCAL-BROWSER-SESSION-004-V8": ["inspectAtomicIfAndThenBoundary", "inspectJournalRecoveryBoundary", "inspectRegistryAndMutationBoundary"],
    "LAW-LOCAL-BROWSER-SESSION-005-V5": ["inspectAutomaticPairingAndReload", "inspectReleaseAndRetiredPaths"],
    "LAW-LOCAL-BROWSER-SESSION-006-V3": ["inspectOpaqueAuthorityBoundary"],
  } as Readonly<Record<string, string[]>>)[lawId] ?? [];
  const lawResult = (lawId: string, astClauses: string[], hasContract = true) => {
    const findings = evaluation.findings.filter((finding) => finding.lawId === lawId);
    const checks = semanticChecks(lawId);
      const assertions = [{ clauses: astClauses, evidenceMode: "static.ast", passed: producerModePassed(evaluation.staticCheckReceipts, lawId, checks),
      refs: staticEvidenceRefs(context, lawId, "static.ast", astClauses, evaluation.staticCheckReceipts, checks,
        observeStaticAst({ context, lawId, evidenceMode: "static.ast", clauses: astClauses, checks,
          executionPassed: producerModePassed(evaluation.staticCheckReceipts, lawId, checks) })) }];
    if (hasContract) assertions.push({ clauses: staticClauses(0), evidenceMode: "static.contract", passed: producerModePassed(evaluation.staticCheckReceipts, lawId, checks),
      refs: staticEvidenceRefs(context, lawId, "static.contract", staticClauses(0), evaluation.staticCheckReceipts, checks,
        observeStaticContract({ context, lawId, evidenceMode: "static.contract", clauses: staticClauses(0), checks,
          executionPassed: producerModePassed(evaluation.staticCheckReceipts, lawId, checks) })) });
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
