import { type InspectorContext, type InspectorEvaluation, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { runCodePurityPhases } from "./components/code-purity-phase-runner.js";
import { producerModePassed, staticClauses, staticEvidenceRefs, staticForbiddenClauses, validateStaticInspection } from "../../shared/static-inspection-contract.js";

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
    const checkForMode = (evidenceMode: string): string[] => ({
      "LAW-CODE-PURITY-001-V6": {
        "static.ast": ["scanStructuralAstBudgets", "scanZombieAst"],
        "static.dependency": ["scanStructuralDependencyBudgets"],
        "static.filesystem": ["scanStructuralFilesystemBudgets"],
        "static.types": ["scanStructuralTypeBudgets"],
      },
      "LAW-CODE-PURITY-002-V2": {
        "static.ast": ["scanOwnerAstRoles"],
        "static.config": ["scanOwnerConfiguration"],
        "static.dependency": ["scanOwnerBoundaries"],
        "static.filesystem": ["scanOwnerFilesystemAuthority"],
        "static.json": ["scanOwnerJsonAuthority"],
        "static.yaml": ["scanOwnerYamlAuthority"],
      },
      "LAW-CODE-PURITY-003-V3": {
        "static.ast": ["scanZombieAst"],
        "static.config": ["scanConfiguredEntrypointLiveness"],
        "static.dependency": ["scanZombieDependencies"],
        "static.filesystem": ["scanZombieFilesystem"],
        "static.json": ["scanJsonRegistryLiveness"],
      },
    } as Readonly<Record<string, Readonly<Record<string, string[]>>>>)[lawId]?.[evidenceMode] ?? [];
    return {
      lawId,
      assertions: Object.entries(clausesByMode).map(([evidenceMode, clauses]) => ({
        clauses,
        evidenceMode,
        passed: producerModePassed(evaluation.staticCheckReceipts, lawId, checkForMode(evidenceMode)),
        refs: staticEvidenceRefs(context, lawId, evidenceMode, clauses, evaluation.staticCheckReceipts,
          checkForMode(evidenceMode)),
      })),
      findings,
    };
  };
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain, reportedLawIds: evaluation.reportedLawIds,
    lawResults: [
      lawResult("LAW-CODE-PURITY-001-V6", {
        "static.filesystem": staticForbiddenClauses(0), "static.ast": staticClauses(0, 1, 3, 4),
        "static.types": staticForbiddenClauses(1), "static.dependency": staticForbiddenClauses(2),
      }),
      lawResult("LAW-CODE-PURITY-002-V2", {
        "static.filesystem": staticForbiddenClauses(0, 3), "static.ast": staticClauses(0),
        "static.dependency": staticForbiddenClauses(1, 2, 4, 5), "static.config": staticForbiddenClauses(0, 3),
        "static.json": staticForbiddenClauses(0, 3), "static.yaml": staticForbiddenClauses(0),
      }),
      lawResult("LAW-CODE-PURITY-003-V3", {
        "static.filesystem": staticForbiddenClauses(0), "static.ast": staticClauses(0),
        "static.dependency": staticForbiddenClauses(1, 2, 3, 4), "static.config": staticForbiddenClauses(0, 3),
        "static.json": staticForbiddenClauses(1, 3),
      }),
    ], inspectedFiles: evaluation.inspectedFiles,
  });
};
