import {
  buildAcceptanceLeafSkeletons,
  sealAcceptanceLeafSteps,
  type AcceptanceLeafSkeleton,
} from "./ci-acceptance-leaf-plan.js";
import type { ClauseEvidenceFacet } from "./shared/law-contracts.js";

export type CommandStep = readonly [
  name: string,
  command: readonly [string, ...string[]],
  filePathHint: string | null,
  lawIdHint: string | null,
  minimalFixHint: string,
  ownerId: string,
  timeoutMs: number,
  clauseId: string | null,
  evidenceFacet: ClauseEvidenceFacet | null,
];

export type PlannedStep = readonly [
  phase: string,
  name: string,
  command: string,
  ownerId: string | null,
  lawId: string | null,
  timeoutMs: number,
  clauseId: string | null,
  evidenceFacet: ClauseEvidenceFacet | null,
];

const formatCommand = (command: readonly string[]): string => command.join(" ");
const requiredLaw = (step: CommandStep): string => {
  const lawId = step[3];
  if (!lawId) throw new Error(`Physical CI step ${step[0]} is missing law authority.`);
  return lawId;
};

export const codexEntryGateStep: CommandStep = [
  "codex-entry-gate",
  ["npm", "run", "codex:entry-gate"],
  "scripts/audit/codex-entry-gate.ts",
  "APEX-AUDIT-001-V1",
  "Repair codex-entry-gate before rerunning npm run ci:full.",
  "audit-system",
  60_000,
  null,
  null,
];

export const typecheckStep: CommandStep = [
  "typecheck",
  ["npm", "run", "typecheck"],
  "tsconfig.json",
  "APEX-CODE-PURITY-008-V1",
  "Run npm run typecheck directly and repair the first TypeScript error before rerunning ci:full.",
  "code-purity",
  180_000,
  null,
  null,
];

export const preArtifactPlannedSteps: readonly PlannedStep[] = [
  ["codex-entry-gate", codexEntryGateStep[0], formatCommand(codexEntryGateStep[1]), codexEntryGateStep[5], requiredLaw(codexEntryGateStep), codexEntryGateStep[6], null, null],
  ["build-audit-artifacts", "build-audit-artifacts", "internal:buildAuditArtifacts()", "audit-system", "APEX-AUDIT-004-V1", 0, null, null],
  ["active-law-full-coverage", "active-law-full-coverage", "internal:verifyActiveLawFullCoverage()", "audit-system", "APEX-AUDIT-001-V1", 0, null, null],
  ["generated-plan-runner", "generated-plan-runner", "worker:runGeneratedPlan()", "audit-system", "APEX-AUDIT-005-V1", 300_000, null, null],
  ["typecheck", typecheckStep[0], formatCommand(typecheckStep[1]), typecheckStep[5], requiredLaw(typecheckStep), typecheckStep[6], null, null],
  ["generated-artifact-truth", "generated-artifact-truth", "internal:verifyGeneratedArtifactTruth()", "audit-system", "APEX-AUDIT-004-V1", 0, null, null],
];

const skeletonStep = (leaf: AcceptanceLeafSkeleton): PlannedStep => [
  "acceptance-runner",
  leaf.name,
  formatCommand(leaf.command),
  null,
  null,
  leaf.timeoutMs,
  null,
  null,
];

export const buildCiPlanSkeleton = (
  acceptanceSkeletons: readonly AcceptanceLeafSkeleton[] = buildAcceptanceLeafSkeletons(),
): readonly PlannedStep[] => Object.freeze([
  ...preArtifactPlannedSteps.slice(0, 5),
  ...acceptanceSkeletons.map(skeletonStep),
  preArtifactPlannedSteps[5]!,
]);

export const buildCiPhasePlan = (
  acceptanceSkeletons: readonly AcceptanceLeafSkeleton[] = buildAcceptanceLeafSkeletons(),
): { acceptanceSteps: readonly CommandStep[]; plannedSteps: readonly PlannedStep[] } => {
  const acceptanceSteps = sealAcceptanceLeafSteps(acceptanceSkeletons);
  const plannedSteps: readonly PlannedStep[] = Object.freeze([
    ...preArtifactPlannedSteps.slice(0, 5),
    ...acceptanceSteps.map((step) => [
      "acceptance-runner",
      step[0],
      formatCommand(step[1]),
      step[5],
      requiredLaw(step),
      step[6],
      step[7],
      step[8],
    ] as const),
    preArtifactPlannedSteps[5]!,
  ]);
  return { acceptanceSteps, plannedSteps };
};
