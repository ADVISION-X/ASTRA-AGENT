import { selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorEvaluation, type InspectorFinding, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { producerModePassed, recordStaticCheck, staticClauses, staticEvidenceRefs, validateStaticInspection } from "../../shared/static-inspection-contract.js";
import { inspectAuthenticatedChannelGuards } from "./authenticated-channel-inspection.js";
import { inspectBrowserMutationSettlement } from "./browser-mutation-settlement-inspection.js";
import { inspectDomMechanicalFacts } from "./dom-mechanical-facts-inspection.js";
import { inspectAtomicIfAndThenBoundary, inspectCompactMutationRecoveryBoundary, inspectJobScopedMutationRecovery } from "./mutation-atomicity-inspection.js";
import { inspectRegistryAndMutationBoundary } from "./mutation-registry-inspection.js";
import { inspectOpaqueAuthorityBoundary } from "./opaque-proof-inspection.js";
import { inspectAutomaticPairingAndReload, inspectReleaseAndRetiredPaths } from "./release-boundary-inspection.js";
import { inspectSessionCore } from "./session-core-inspection.js";
import { inspectTargetClaimGuards } from "./target-claim-inspection.js";
import {
  inspectAuthenticatedChannelContract,
  inspectOpaqueAuthorityContract,
  inspectReleaseIdentityContract,
  inspectSessionCoreContract,
  inspectTargetClaimContract,
} from "./contract-inspection.js";

const inspectDomainEvaluation = async (context: InspectorContext): Promise<InspectorEvaluation> => {
  const lawId = selectLawId(context.planEntry.lawIds, "LAW-LOCAL-BROWSER-SESSION-001-V4");
  const mutationLawId = selectLawId(context.planEntry.lawIds, "LAW-LOCAL-BROWSER-SESSION-004-V20");
  const channelLawId = selectLawId(context.planEntry.lawIds, "LAW-LOCAL-BROWSER-SESSION-002-V6");
  const claimLawId = selectLawId(context.planEntry.lawIds, "LAW-LOCAL-BROWSER-SESSION-003-V21");
  const releaseLawId = selectLawId(context.planEntry.lawIds, "LAW-LOCAL-BROWSER-SESSION-005-V6");
  const opaqueLawId = selectLawId(context.planEntry.lawIds, "LAW-LOCAL-BROWSER-SESSION-006-V15");
  const findings: InspectorFinding[] = [];
  const staticCheckReceipts: InspectorEvaluation["staticCheckReceipts"] = [];
  const run = (check: string, lawIds: readonly string[], implementation: (...args: never[]) => unknown,
    action: () => void): void => recordStaticCheck({
    check, findings, implementation, lawIds, receipts: staticCheckReceipts, run: action,
  });
  run("inspectSessionCore", [lawId], inspectSessionCore, () => inspectSessionCore(context, findings, lawId));
  run("inspectRegistryAndMutationBoundary", [mutationLawId], inspectRegistryAndMutationBoundary, () => inspectRegistryAndMutationBoundary(context, findings, mutationLawId));
  run("inspectAtomicIfAndThenBoundary", [mutationLawId], inspectAtomicIfAndThenBoundary, () => inspectAtomicIfAndThenBoundary(context, findings, mutationLawId));
  run("inspectDomMechanicalFacts", [mutationLawId], inspectDomMechanicalFacts, () => inspectDomMechanicalFacts(context, findings, mutationLawId));
  run("inspectDomMechanicalFacts", [opaqueLawId], inspectDomMechanicalFacts, () => inspectDomMechanicalFacts(context, findings, opaqueLawId));
  run("inspectBrowserMutationSettlement", [mutationLawId], inspectBrowserMutationSettlement, () => inspectBrowserMutationSettlement(context, findings, mutationLawId));
  run("inspectCompactMutationRecoveryBoundary", [mutationLawId], inspectCompactMutationRecoveryBoundary, () => inspectCompactMutationRecoveryBoundary(context, findings, mutationLawId));
  run("inspectJobScopedMutationRecovery", [mutationLawId], inspectJobScopedMutationRecovery, () => inspectJobScopedMutationRecovery(context, findings, mutationLawId));
  run("inspectAuthenticatedChannelGuards", [channelLawId], inspectAuthenticatedChannelGuards, () => inspectAuthenticatedChannelGuards(context, findings, channelLawId));
  run("inspectAutomaticPairingAndReload", [channelLawId, claimLawId, releaseLawId], inspectAutomaticPairingAndReload, () => inspectAutomaticPairingAndReload(context, findings, channelLawId, claimLawId, releaseLawId));
  run("inspectTargetClaimGuards", [claimLawId], inspectTargetClaimGuards, () => inspectTargetClaimGuards(context, findings, claimLawId));
  run("inspectTargetClaimGuards", [opaqueLawId], inspectTargetClaimGuards, () => inspectTargetClaimGuards(context, findings, opaqueLawId));
  run("inspectReleaseAndRetiredPaths", [releaseLawId], inspectReleaseAndRetiredPaths, () => inspectReleaseAndRetiredPaths(findings, releaseLawId));
  run("inspectOpaqueAuthorityBoundary", [opaqueLawId], inspectOpaqueAuthorityBoundary, () => inspectOpaqueAuthorityBoundary(context, findings, opaqueLawId));
  run("inspectSessionCoreContract", [lawId], inspectSessionCoreContract, () => inspectSessionCoreContract(context, findings, lawId));
  run("inspectAuthenticatedChannelContract", [channelLawId], inspectAuthenticatedChannelContract, () => inspectAuthenticatedChannelContract(context, findings, channelLawId));
  run("inspectTargetClaimContract", [claimLawId], inspectTargetClaimContract, () => inspectTargetClaimContract(context, findings, claimLawId));
  run("inspectReleaseIdentityContract", [releaseLawId], inspectReleaseIdentityContract, () => inspectReleaseIdentityContract(context, findings, releaseLawId));
  run("inspectOpaqueAuthorityContract", [opaqueLawId], inspectOpaqueAuthorityContract, () => inspectOpaqueAuthorityContract(context, findings, opaqueLawId));
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
  const astChecks = (lawId: string): string[] => ({
    "LAW-LOCAL-BROWSER-SESSION-001-V4": ["inspectSessionCore"],
    "LAW-LOCAL-BROWSER-SESSION-002-V6": ["inspectAuthenticatedChannelGuards", "inspectAutomaticPairingAndReload"],
    "LAW-LOCAL-BROWSER-SESSION-003-V21": ["inspectAutomaticPairingAndReload", "inspectTargetClaimGuards"],
    "LAW-LOCAL-BROWSER-SESSION-004-V20": ["inspectAtomicIfAndThenBoundary", "inspectDomMechanicalFacts", "inspectBrowserMutationSettlement", "inspectCompactMutationRecoveryBoundary", "inspectJobScopedMutationRecovery", "inspectRegistryAndMutationBoundary"],
    "LAW-LOCAL-BROWSER-SESSION-005-V6": ["inspectAutomaticPairingAndReload", "inspectReleaseAndRetiredPaths"],
    "LAW-LOCAL-BROWSER-SESSION-006-V15": ["inspectDomMechanicalFacts", "inspectOpaqueAuthorityBoundary", "inspectTargetClaimGuards"],
  } as Readonly<Record<string, string[]>>)[lawId] ?? [];
  const contractChecks = (lawId: string): string[] => ({
    "LAW-LOCAL-BROWSER-SESSION-001-V4": ["inspectSessionCoreContract"],
    "LAW-LOCAL-BROWSER-SESSION-002-V6": ["inspectAuthenticatedChannelContract"],
    "LAW-LOCAL-BROWSER-SESSION-003-V21": ["inspectTargetClaimContract"],
    "LAW-LOCAL-BROWSER-SESSION-005-V6": ["inspectReleaseIdentityContract"],
    "LAW-LOCAL-BROWSER-SESSION-006-V15": ["inspectOpaqueAuthorityContract"],
  } as Readonly<Record<string, string[]>>)[lawId] ?? [];
  const contractClauses = (lawId: string): string[] => ({
    "LAW-LOCAL-BROWSER-SESSION-001-V4": staticClauses(6, 7),
    "LAW-LOCAL-BROWSER-SESSION-002-V6": staticClauses(5, 8),
    "LAW-LOCAL-BROWSER-SESSION-003-V21": staticClauses(15),
    "LAW-LOCAL-BROWSER-SESSION-005-V6": staticClauses(4, 5),
    "LAW-LOCAL-BROWSER-SESSION-006-V15": staticClauses(0),
  } as Readonly<Record<string, string[]>>)[lawId] ?? [];
  const lawResult = (lawId: string, astClauses: string[], hasContract = true) => {
    const findings = evaluation.findings.filter((finding) => finding.lawId === lawId);
    const checks = astChecks(lawId);
    const assertions = [{ clauses: astClauses, evidenceMode: "static.ast", passed: producerModePassed(evaluation.staticCheckReceipts, lawId, checks),
      refs: staticEvidenceRefs(context, lawId, "static.ast", astClauses, evaluation.staticCheckReceipts, checks) }];
    if (hasContract) {
      const clauses = contractClauses(lawId);
      const contract = contractChecks(lawId);
      assertions.push({ clauses, evidenceMode: "static.contract", passed: producerModePassed(evaluation.staticCheckReceipts, lawId, contract),
        refs: staticEvidenceRefs(context, lawId, "static.contract", clauses, evaluation.staticCheckReceipts, contract) });
    }
    return { lawId, assertions, findings };
  };
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain, reportedLawIds: evaluation.reportedLawIds,
    lawResults: [
      lawResult("LAW-LOCAL-BROWSER-SESSION-001-V4", staticClauses(0, 1, 2, 3, 4, 5, 6, 7, 8, 9)),
      lawResult("LAW-LOCAL-BROWSER-SESSION-002-V6", staticClauses(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13)),
      lawResult("LAW-LOCAL-BROWSER-SESSION-003-V21", staticClauses(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15)),
      lawResult("LAW-LOCAL-BROWSER-SESSION-004-V20", staticClauses(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16), false),
      lawResult("LAW-LOCAL-BROWSER-SESSION-005-V6", staticClauses(0, 1, 2, 3, 4, 5, 6)),
      lawResult("LAW-LOCAL-BROWSER-SESSION-006-V15", staticClauses(0, 1, 2, 3)),
    ], inspectedFiles: evaluation.inspectedFiles,
  });
};
