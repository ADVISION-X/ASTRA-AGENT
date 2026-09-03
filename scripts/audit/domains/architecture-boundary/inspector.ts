import { createFinding } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorEvaluation, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveArchitectureLawIds } from "./components/architecture-boundary-shared.js";
import { inspectActivePluginGate } from "./components/scan-active-plugin-gate.js";
import { inspectProductAcceptanceBoundaries } from "./components/scan-product-acceptance-boundaries.js";
import { inspectProjectSources } from "./components/scan-project-sources.js";
import { inspectRootAllowlist } from "./components/scan-root-allowlist.js";
import { inspectTypesContractRelations, inspectTypesContractRoot } from "./components/scan-types-contract-root.js";
import { inspectConstitutionalBoundary } from "./constitutional-boundary-inspector.js";
import { producerModePassed, recordStaticCheck, staticClauses, staticEvidenceRefs, validateStaticInspection } from "../../shared/static-inspection-contract.js";
import { observeTypeCheckerRelations } from "../../shared/typechecker-observation.js";



const inspectDomainEvaluation = async (context: InspectorContext): Promise<InspectorEvaluation> => {
  const lawIds = resolveArchitectureLawIds(context.planEntry);
  const lawId = context.planEntry.lawIds[0]!;
  const findings: ReturnType<typeof createFinding>[] = [];
  const inspectedFiles = new Set<string>();
  const staticCheckReceipts: InspectorEvaluation["staticCheckReceipts"] = [];
  const run = <T>(check: string, implementation: (...args: never[]) => unknown, action: () => T): T => recordStaticCheck({
    check, findings, implementation, lawIds: [lawId], receipts: staticCheckReceipts, run: action,
  });

  run("inspectRootAllowlist", inspectRootAllowlist, () => inspectRootAllowlist(findings, lawIds.rootLawId));
  run("inspectProjectSources", inspectProjectSources, () => inspectProjectSources(context.project, findings, inspectedFiles, lawIds));
  run("inspectActivePluginGate", inspectActivePluginGate, () => {
    const result = inspectActivePluginGate({
      lawId: lawIds.pluginStageLawId,
      project: context.project,
      inspectedFiles,
      targetPaths: context.targetPaths,
    });
    findings.push(...result.findings);
    return result;
  });
  run("inspectProductAcceptanceBoundaries", inspectProductAcceptanceBoundaries, () =>
    inspectProductAcceptanceBoundaries({
      findings,
      inspectedFiles,
      lawId,
      project: context.project,
    }));
  run("inspectTypesContractRoot", inspectTypesContractRoot, () => inspectTypesContractRoot({
        findings,
        inspectedFiles,
        lawId: lawIds.lawFirstChangeLawId,
        project: context.project,
      }));
  recordStaticCheck({ check: "inspectTypesContractRelations", findings, implementation: inspectTypesContractRelations,
    lawIds: [lawId], observe: () => observeTypeCheckerRelations(context.project, context.targetPaths),
    receipts: staticCheckReceipts, run: () => inspectTypesContractRelations({
      findings, inspectedFiles, lawId: lawIds.lawFirstChangeLawId, project: context.project,
    }) });

  const constitutional = await inspectConstitutionalBoundary(context);
  findings.push(...constitutional.findings);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...context.targetPaths],
    staticCheckReceipts,
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  const evaluation = await inspectDomainEvaluation(context);
  const lawId = context.planEntry.lawIds[0]!;
  const findings = evaluation.findings.filter((finding) => finding.lawId === lawId);
  const refs = (mode: string, clauses: string[], checks: string[]) => ({
    passed: producerModePassed(evaluation.staticCheckReceipts, lawId, checks),
    refs: staticEvidenceRefs(context, lawId, mode, clauses, evaluation.staticCheckReceipts, checks),
  });
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain,
    reportedLawIds: evaluation.reportedLawIds,
    lawResults: [{ lawId, assertions: [
      { clauses: staticClauses(0, 1, 2, 3, 4, 5, 6, 7, 8), evidenceMode: "static.ast", ...refs("static.ast", staticClauses(0, 1, 2, 3, 4, 5, 6, 7, 8), ["inspectProjectSources", "inspectProductAcceptanceBoundaries", "inspectTypesContractRoot"]) },
      { clauses: staticClauses(0), evidenceMode: "static.dependency", ...refs("static.dependency", staticClauses(0), ["inspectActivePluginGate"]) },
      { clauses: staticClauses(0), evidenceMode: "static.filesystem", ...refs("static.filesystem", staticClauses(0), ["inspectRootAllowlist"]) },
      { clauses: staticClauses(0), evidenceMode: "static.types", ...refs("static.types", staticClauses(0), ["inspectTypesContractRelations"]) },
    ], findings }],
    inspectedFiles: evaluation.inspectedFiles,
  });
};
