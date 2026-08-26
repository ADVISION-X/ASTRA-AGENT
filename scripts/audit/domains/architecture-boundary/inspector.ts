import { createFinding } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorEvaluation, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveArchitectureLawIds } from "./components/architecture-boundary-shared.js";
import { inspectActivePluginGate } from "./components/scan-active-plugin-gate.js";
import { inspectActivePluginMediators } from "./components/scan-active-plugin-mediators.js";
import { inspectProjectSources } from "./components/scan-project-sources.js";
import { inspectRootAllowlist } from "./components/scan-root-allowlist.js";
import { inspectTypesContractRoot } from "./components/scan-types-contract-root.js";
import { inspectConstitutionalBoundary } from "./constitutional-boundary-inspector.js";
import { producerModePassed, recordStaticCheck, staticClauses, staticEvidenceRefs, validateStaticInspection } from "../../shared/static-inspection-contract.js";



const inspectDomainEvaluation = async (context: InspectorContext): Promise<InspectorEvaluation> => {
  const lawIds = resolveArchitectureLawIds(context.planEntry);
  const lawId = context.planEntry.lawIds[0]!;
  const findings: ReturnType<typeof createFinding>[] = [];
  const inspectedFiles = new Set<string>();
  const staticCheckReceipts: InspectorEvaluation["staticCheckReceipts"] = [];
  const run = <T>(check: string, action: () => T): T => recordStaticCheck({
    check, findings, lawIds: [lawId], receipts: staticCheckReceipts, run: action,
  });

  run("inspectRootAllowlist", () => inspectRootAllowlist(findings, lawIds.rootLawId));
  run("inspectProjectSources", () => inspectProjectSources(context.project, findings, inspectedFiles, lawIds));
  const activePluginGate = inspectActivePluginGate({
      lawId: lawIds.pluginStageLawId,
      project: context.project,
      inspectedFiles,
      targetPaths: context.targetPaths,
    });
  findings.push(...activePluginGate.findings);
  run("inspectActivePluginMediators", () => inspectActivePluginMediators({
        entries: activePluginGate.activeContracts,
        findings,
        inspectedFiles,
        lawId: lawIds.intakeLawId,
        project: context.project,
      }));
  run("inspectTypesContractRoot", () => inspectTypesContractRoot({
        findings,
        inspectedFiles,
        lawId: lawIds.lawFirstChangeLawId,
        project: context.project,
      }));

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
  const lawId = "LAW-ARCHITECTURE-BOUNDARY-001-V1";
  const findings = evaluation.findings.filter((finding) => finding.lawId === lawId);
  const refs = (mode: string, clauses: string[], checks: string[]) => ({
    passed: producerModePassed(evaluation.staticCheckReceipts, lawId, checks),
    refs: staticEvidenceRefs(context, lawId, mode, clauses, evaluation.staticCheckReceipts, checks),
  });
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain,
    reportedLawIds: evaluation.reportedLawIds,
    lawResults: [{ lawId, assertions: [
      { clauses: staticClauses(0, 1, 2, 3, 4, 5, 6), evidenceMode: "static.ast", ...refs("static.ast", staticClauses(0, 1, 2, 3, 4, 5, 6), ["inspectProjectSources"]) },
      { clauses: staticClauses(0), evidenceMode: "static.dependency", ...refs("static.dependency", staticClauses(0), ["inspectActivePluginMediators", "inspectProjectSources"]) },
      { clauses: staticClauses(0), evidenceMode: "static.filesystem", ...refs("static.filesystem", staticClauses(0), ["inspectRootAllowlist"]) },
      { clauses: staticClauses(0), evidenceMode: "static.types", ...refs("static.types", staticClauses(0), ["inspectTypesContractRoot"]) },
    ], findings }],
    inspectedFiles: evaluation.inspectedFiles,
  });
};
