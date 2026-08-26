import { type InspectorContext, type InspectorEvaluation, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { runCodePurityPhases } from "./components/code-purity-phase-runner.js";
import { producerModePassed, staticClauses, staticEvidenceRefs, validateStaticInspection } from "../../shared/static-inspection-contract.js";
import { observeStaticAst, observeStaticConfig, observeStaticDependency, observeStaticFilesystem, observeStaticJson, observeStaticTypes, observeStaticYaml } from "../../shared/static-target-object-inspector.js";

const inspectDomainEvaluation = async (context: InspectorContext): Promise<InspectorEvaluation> => {
  const project = context.project;
  const phaseRun = await runCodePurityPhases({ ...context, project });
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings: phaseRun.findings,
    inspectedFiles: [...context.targetPaths],
    staticCheckReceipts: phaseRun.staticCheckReceipts,
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  const evaluation = await inspectDomainEvaluation(context);
  const lawResult = (lawId: string, clausesByMode: Readonly<Record<string, string[]>>) => {
    const findings = evaluation.findings.filter((finding) => finding.lawId === lawId);
    const checkForMode = (evidenceMode: string): string[] => evidenceMode === "static.ast" || evidenceMode === "static.types"
      ? ["scanStructuralBudgets"]
      : evidenceMode === "static.dependency" ? ["scanOwnerBoundaries"] : ["scanZombieSurfaces"];
    const nativeRefs = (evidenceMode: string, clauses: string[], checks: string[]): string[] => {
      const input = { context, lawId, evidenceMode, clauses, checks,
        executionPassed: producerModePassed(evaluation.staticCheckReceipts, lawId, checks) };
      if (evidenceMode === "static.ast") return observeStaticAst(input);
      if (evidenceMode === "static.types") return observeStaticTypes(input);
      if (evidenceMode === "static.dependency") return observeStaticDependency(input);
      if (evidenceMode === "static.filesystem") return observeStaticFilesystem(input);
      if (evidenceMode === "static.config") return observeStaticConfig(input);
      if (evidenceMode === "static.json") return observeStaticJson(input);
      if (evidenceMode === "static.yaml") return observeStaticYaml(input);
      return [];
    };
    return {
      lawId,
      assertions: Object.entries(clausesByMode).map(([evidenceMode, clauses]) => ({
        clauses,
        evidenceMode,
        passed: producerModePassed(evaluation.staticCheckReceipts, lawId, checkForMode(evidenceMode)),
        refs: staticEvidenceRefs(context, lawId, evidenceMode, clauses, evaluation.staticCheckReceipts,
          checkForMode(evidenceMode), nativeRefs(evidenceMode, clauses, checkForMode(evidenceMode))),
      })),
      findings,
    };
  };
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain, reportedLawIds: evaluation.reportedLawIds,
    lawResults: [
      lawResult("LAW-CODE-PURITY-001-V4", {
        "static.filesystem": staticClauses(0), "static.ast": staticClauses(0, 1, 2, 3, 4),
        "static.types": staticClauses(0), "static.dependency": staticClauses(0),
      }),
      lawResult("LAW-CODE-PURITY-002-V1", {
        "static.filesystem": staticClauses(0), "static.ast": staticClauses(0, 1, 2, 3, 4),
        "static.dependency": staticClauses(0), "static.config": staticClauses(0),
        "static.json": staticClauses(0), "static.yaml": staticClauses(0),
      }),
      lawResult("LAW-CODE-PURITY-003-V1", {
        "static.filesystem": staticClauses(0), "static.ast": staticClauses(0),
        "static.dependency": staticClauses(0), "static.config": staticClauses(0), "static.json": staticClauses(0),
      }),
    ], inspectedFiles: evaluation.inspectedFiles,
  });
};
