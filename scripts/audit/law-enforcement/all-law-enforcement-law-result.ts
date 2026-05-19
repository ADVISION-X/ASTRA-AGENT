import type { LawRecord, OwnerManifest } from "../core/schema.js";
import type { ParsedClause } from "./clause-parser.js";
import type { DomainInspectorVerdict } from "./owner-verdicts.js";
import { toBinary, toEnforcementLevel } from "./all-law-enforcement-support.js";
import type { ActiveLawClauseMatrixItem, MatrixBuildInput } from "./all-law-enforcement-types.js";
import type { ClauseResult, LawResult } from "./all-law-enforcement-result-types.js";

type LawEvaluationInput = {
  law: LawRecord;
  owners: OwnerManifest[];
  parsedClauses: ParsedClause[];
  input: MatrixBuildInput;
  generatedDrift: string[];
  ciFullIsUnique: boolean;
  ciFullSteps: Array<{ name: string }>;
  ownerVerdicts: Map<string, DomainInspectorVerdict>;
  qualityFailingDomains: Set<string>;
  antiEscapeFailingDomains: Set<string>;
  auditSystemVerdict: { status: "PASS" | "FAIL"; evidence: string; failureReason?: string };
  matrixItems: ActiveLawClauseMatrixItem[];
};

const resolveVerdict = (data: LawEvaluationInput, ownerDomain: string | undefined, ownerInspectorId: string) => {
  if (ownerDomain !== "audit-system") return ownerDomain ? data.ownerVerdicts.get(ownerDomain) : undefined;
  return {
    capabilityDomain: ownerDomain,
    inspectorId: ownerInspectorId,
    status: data.auditSystemVerdict.status,
    evidence: data.auditSystemVerdict.evidence,
    findingLawIds: data.auditSystemVerdict.status === "PASS" ? [] : data.owners[0]?.allowedLawIds ?? [],
    ...(data.auditSystemVerdict.failureReason ? { failureReason: data.auditSystemVerdict.failureReason } : {}),
  };
};

const failureReasonFor = (data: LawEvaluationInput, state: {
  ownerMissing: boolean;
  ownerMultiple: boolean;
  verdictMissing: boolean;
  verdictPassed: boolean;
  qualityPass: boolean;
  antiEscapePass: boolean;
  manifestFailure?: string;
  ciFullScheduled: boolean;
  clauseSource: string;
  verdict?: { failureReason?: string };
}): string | undefined => {
  const rules: Array<[boolean, string | undefined]> = [
    [state.ownerMissing, "missing owner"],
    [state.ownerMultiple, "multiple owners"],
    [state.verdictMissing, "missing inspector verdict"],
    [!state.verdictPassed, state.verdict?.failureReason ?? "owner inspector failed"],
    [!state.qualityPass, "owner inspector lacks decisive AST or symbol proof"],
    [!state.antiEscapePass, "anti-escape finding exists inside owner roots"],
    [state.clauseSource === "generated" && data.generatedDrift.length > 0, data.generatedDrift[0]],
    [state.clauseSource === "manifest" && Boolean(state.manifestFailure), state.manifestFailure],
    [!state.ciFullScheduled, "owner inspector is not scheduled by ci-full"],
    [!data.ciFullIsUnique, "ci:full is not the unique full-chain entrypoint"],
  ];
  return rules.find(([matches]) => matches)?.[1];
};

const buildClauseResult = (
  input: {
    data: LawEvaluationInput;
    clause: ParsedClause;
    owner: OwnerManifest | undefined;
    ownerDomain: string | undefined;
    ownerInspectorId: string;
  },
): ClauseResult => {
  const { data, clause, owner, ownerDomain, ownerInspectorId } = input;
  const verdict = resolveVerdict(data, ownerDomain, ownerInspectorId);
  const enforcementLevel = toEnforcementLevel(clause.clauseSource);
  const ciFullScheduled = owner ? data.ciFullSteps.some((step) => step.name === owner.inspectorId || (owner.capabilityDomain === "audit-system" && step.name === "audit:audit-system")) : false;
  const manifestFailure = data.input.manifestFindings.find((item) => item.lawId === data.law.lawId)?.message;
  const qualityPass = ownerDomain ? !data.qualityFailingDomains.has(ownerDomain) : false;
  const antiEscapePass = clause.clauseSource !== "forbidden" || (ownerDomain ? !data.antiEscapeFailingDomains.has(ownerDomain) : false);
  const verdictPassed = verdict?.status === "PASS";
  const passed = data.owners.length === 1 && Boolean(owner) && verdictPassed && qualityPass && antiEscapePass && (clause.clauseSource !== "generated" || data.generatedDrift.length === 0) && (clause.clauseSource !== "manifest" || !manifestFailure) && ciFullScheduled && data.ciFullIsUnique;
  const failureState = { ownerMissing: data.owners.length === 0, ownerMultiple: data.owners.length > 1, verdictMissing: !verdict, verdictPassed, qualityPass, antiEscapePass, ciFullScheduled, clauseSource: clause.clauseSource, ...(manifestFailure ? { manifestFailure } : {}), ...(verdict ? { verdict } : {}) };
  const failureReason = failureReasonFor(data, failureState);
  data.matrixItems.push({ lawId: data.law.lawId, lawFilePath: clause.lawFilePath, ownerDomain: ownerDomain ?? "missing-owner", clauseId: clause.clauseId, clauseSource: clause.clauseSource, clauseText: clause.clauseText, enforcementLevel, inspectorId: ownerInspectorId, expectedResult: "PASS" });
  return { clauseId: clause.clauseId, status: toBinary(passed), enforcementLevel, inspectorId: ownerInspectorId, evidence: verdict?.evidence ?? "owner manifest mapping required", ...(failureReason ? { failureReason } : {}) };
};

export const evaluateLawResult = (data: LawEvaluationInput): LawResult => {
  const owner = data.owners[0];
  const ownerDomain = owner?.capabilityDomain;
  const ownerInspectorId = owner?.inspectorId ?? "missing-inspector";
  const clauses = data.parsedClauses.filter((clause) => clause.lawId === data.law.lawId);
  const clauseResults = clauses.map((clause) => buildClauseResult({ data, clause, owner, ownerDomain, ownerInspectorId }));
  const status = clauseResults.every((result) => result.status === "PASS") ? "PASS" : "FAIL";
  return { lawId: data.law.lawId, ownerDomain: ownerDomain ?? "missing-owner", status, clauseResults };
};
