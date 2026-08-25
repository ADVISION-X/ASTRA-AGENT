import { createFinding } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorEvaluation, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveArchitectureLawIds } from "./components/architecture-boundary-shared.js";
import { inspectActivePluginGate } from "./components/scan-active-plugin-gate.js";
import { inspectActivePluginMediators } from "./components/scan-active-plugin-mediators.js";
import { inspectProjectSources } from "./components/scan-project-sources.js";
import { inspectRootAllowlist } from "./components/scan-root-allowlist.js";
import { inspectTypesContractRoot } from "./components/scan-types-contract-root.js";
import { staticClauses, staticEvidenceRefs, validateStaticInspection } from "../../shared/static-inspection-contract.js";



const inspectDomainEvaluation = async (context: InspectorContext): Promise<InspectorEvaluation> => {
  const lawIds = resolveArchitectureLawIds(context.planEntry);
  const lawId = context.planEntry.lawIds[0]!;
  const findings: ReturnType<typeof createFinding>[] = [];
  const inspectedFiles = new Set<string>();

  inspectRootAllowlist(findings, lawIds.rootLawId);
  inspectProjectSources(context.project, findings, inspectedFiles, lawIds);
  const activePluginGate = inspectActivePluginGate({
      lawId: lawIds.pluginStageLawId,
      project: context.project,
      inspectedFiles,
      targetPaths: context.targetPaths,
    });
  findings.push(...activePluginGate.findings);
  inspectActivePluginMediators({
        entries: activePluginGate.activeContracts,
        findings,
        inspectedFiles,
        lawId: lawIds.intakeLawId,
        project: context.project,
      });
  inspectTypesContractRoot({
        findings,
        inspectedFiles,
        lawId: lawIds.lawFirstChangeLawId,
        project: context.project,
      });

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...context.targetPaths],
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  const evaluation = await inspectDomainEvaluation(context);
  const lawId = "LAW-ARCHITECTURE-BOUNDARY-001-V1";
  const findings = evaluation.findings.filter((finding) => finding.lawId === lawId);
  const passed = findings.length === 0;
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain,
    reportedLawIds: evaluation.reportedLawIds,
    lawResults: [{ lawId, assertions: [
      { clauses: staticClauses(0, 1, 2, 3, 4, 5, 6), evidenceMode: "static.ast", passed, refs: staticEvidenceRefs(context, lawId, "static.ast") },
      { clauses: staticClauses(), evidenceMode: "static.dependency", passed, refs: staticEvidenceRefs(context, lawId, "static.dependency") },
      { clauses: staticClauses(), evidenceMode: "static.filesystem", passed, refs: staticEvidenceRefs(context, lawId, "static.filesystem") },
      { clauses: staticClauses(), evidenceMode: "static.types", passed, refs: staticEvidenceRefs(context, lawId, "static.types") },
    ], findings }],
    inspectedFiles: evaluation.inspectedFiles,
  });
};
