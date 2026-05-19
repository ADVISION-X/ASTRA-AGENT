import { buildAuditSystemVerdict, buildDomainFailureSets } from "./all-law-enforcement-domain-state.js";
import { prepareLawMatrixContext } from "./all-law-enforcement-context.js";
import { evaluateLawResult } from "./all-law-enforcement-law-result.js";
import { buildLawFiles, buildMatrixReturn } from "./all-law-enforcement-result.js";
import type { ActiveLawClauseMatrixItem, MatrixBuildInput } from "./all-law-enforcement-types.js";
import type { LawResult } from "./all-law-enforcement-result-types.js";

export type { ActiveLawClauseMatrixItem, BinaryLawResult, LawEnforcementLevel } from "./all-law-enforcement-types.js";

export const buildAllLawEnforcementMatrix = async (input: MatrixBuildInput) => {
  const context = await prepareLawMatrixContext(input);
  const domainState = buildDomainFailureSets(input);
  const auditSystemVerdict = buildAuditSystemVerdict(input);
  const matrixItems: ActiveLawClauseMatrixItem[] = [];
  const lawFileResults = new Map<string, LawResult[]>();
  const sortedLaws = [...input.laws].sort((left, right) => left.lawFile.localeCompare(right.lawFile) || left.lawId.localeCompare(right.lawId));
  for (const [index, law] of sortedLaws.entries()) {
    emitLawHeartbeat({ file: law.lawFile, lawId: law.lawId, owner: law.capabilityDomain, index, total: sortedLaws.length });
    const lawResult = evaluateLawResult({
      law,
      owners: context.ownerAssignments.ownersByLawId.get(law.lawId) ?? [],
      parsedClauses: context.parsedClauses,
      input,
      generatedDrift: context.generatedDrift,
      ciFullIsUnique: context.ciFullIsUnique,
      ciFullSteps: context.ciFullSteps,
      ownerVerdicts: context.ownerVerdicts,
      auditSystemVerdict,
      matrixItems,
      ...domainState,
    });
    appendLawResult(lawFileResults, law.lawFile, lawResult);
    emitLawResult(law.lawId, lawResult);
  }
  return buildMatrixReturn({
    input,
    sortedLaws,
    lawFiles: buildLawFiles(lawFileResults),
    matrixItems,
    parsedLawFindings: context.parsedLawClauses.findings,
    ownerAssignments: context.ownerAssignments,
    generatedDrift: context.generatedDrift,
    discovery: context.discovery,
    blueprintClauses: context.blueprintClauses,
    ciFullIsUnique: context.ciFullIsUnique,
    ownerStepCount: context.ciFullSteps.filter((step) => step.layer === "owner-layer").length,
  });
};

const appendLawResult = (results: Map<string, LawResult[]>, lawFile: string, lawResult: LawResult): void => {
  results.set(lawFile, [...(results.get(lawFile) ?? []), lawResult]);
};

const emitLawHeartbeat = (input: { file: string; lawId: string; owner: string; index: number; total: number }): void => {
  process.stdout.write(`[CI-FULL][HEARTBEAT] file=${input.file} law=${input.lawId} owner=${input.owner} processed=${input.index}/${input.total} status=running\n`);
};

const emitLawResult = (lawId: string, lawResult: LawResult): void => {
  const passed = lawResult.clauseResults.filter((item) => item.status === "PASS").length;
  const failed = lawResult.clauseResults.filter((item) => item.status === "FAIL").length;
  process.stdout.write(`[CI-FULL][LAW-${lawResult.status}] law=${lawId} passed=${passed} failed=${failed}\n`);
};
