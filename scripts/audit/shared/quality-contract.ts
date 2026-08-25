import { exactKeys } from "../governance-json.js";
import { fail, validGitObjectId } from "../governance-runtime.js";
import type { Law, Level } from "../governance-authority.js";

export type QualityAssertion = {
  clauses: string[];
  evidenceMode: string;
  passed: boolean;
  refs: string[];
};

export type QualityFinding = { code: string; evidenceRefs: string[] };
export type LawExecutionResult = { lawId: string; assertions: QualityAssertion[]; findings: QualityFinding[] };
export type QualityEvidence = { evidenceMode: string; refs: string[] };
export type QualityParticipant = { repo: string; gitCommit: string; contracts: Array<{ contractId: string; version: number }> };
export type QualityLawReport = {
  lawId: string;
  declaredEvidenceModes: string[];
  requiredEvidenceModes: string[];
  deferredEvidenceModes: string[];
  evidence: QualityEvidence[];
  outcome: "PASS" | "FAIL";
  findings: QualityFinding[];
};
export type QualityReport = {
  schemaVersion: 4;
  level: "READY" | "RELEASE";
  gitCommit: string;
  laws: QualityLawReport[];
  participants: QualityParticipant[];
  outcome: "PASS" | "FAIL";
};

const byteCompare = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));
const ordered = (values: readonly string[]): string[] => [...new Set(values)].sort(byteCompare);
const exactOrdered = (values: readonly string[]): boolean => JSON.stringify(values) === JSON.stringify(ordered(values));
const resultKeys = ["assertions", "findings", "lawId"];
const assertionKeys = ["clauses", "evidenceMode", "passed", "refs"];
const findingKeys = ["code", "evidenceRefs"];
const evidenceKinds = new Set(["file", "text", "ast", "json", "yaml", "sql", "dependency", "config", "test", "exam", "dynamic", "scope"]);

const validateParticipants = (
  level: "READY" | "RELEASE",
  participants: readonly QualityParticipant[],
): QualityParticipant[] => {
  if (level === "READY" && participants.length) fail("QUALITY_PARTICIPANTS_INVALID", level);
  const normalized = participants.map((participant) => ({
    repo: participant.repo,
    gitCommit: participant.gitCommit,
    contracts: participant.contracts.map((contract) => ({ ...contract })),
  }));
  for (const participant of normalized) {
    if (!exactKeys(participant, ["contracts", "gitCommit", "repo"])
      || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(participant.repo)
      || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(participant.gitCommit)
      || !participant.contracts.length) fail("QUALITY_PARTICIPANTS_INVALID", participant.repo);
    const signatures = participant.contracts.map((contract) => `${contract.contractId}\0${contract.version}`);
    if (participant.contracts.some((contract) => !exactKeys(contract, ["contractId", "version"])
      || !contract.contractId || !Number.isInteger(contract.version) || contract.version < 1)
      || !exactOrdered(signatures)) fail("QUALITY_PARTICIPANTS_INVALID", participant.repo);
  }
  if (!exactOrdered(normalized.map((participant) => participant.repo))) fail("QUALITY_PARTICIPANTS_INVALID", "order");
  return normalized;
};
const evidenceKindByMode: Readonly<Record<string, string>> = {
  "static.filesystem": "file",
  "static.text": "text",
  "static.ast": "ast",
  "static.types": "ast",
  "static.contract": "config",
  "static.dependency": "dependency",
  "static.config": "config",
  "static.json": "json",
  "static.yaml": "yaml",
  "static.sql": "sql",
  "static.migration": "file",
  "exam.golden": "exam",
  "exam.property": "exam",
  "exam.state-machine": "exam",
  "dynamic.browser": "dynamic",
  "dynamic.service": "dynamic",
  "dynamic.database": "dynamic",
  "dynamic.storage": "dynamic",
  "dynamic.provider": "dynamic",
  "dynamic.authorization": "dynamic",
  "dynamic.recovery": "dynamic",
  "dynamic.performance": "dynamic",
};

export const clausesForLaw = (law: Law): string[] => [
  ...law.forbidden.map((_, index) => `forbidden:${index}`),
  "summary",
].sort(byteCompare);

export const clausesForEvidenceMode = (law: Law, required: readonly string[], mode: string): string[] => {
  const clauses = clausesForLaw(law);
  const primaryStatic = required.includes("static.ast")
    ? "static.ast"
    : required.find((candidate) => candidate.startsWith("static."));
  const primary = primaryStatic ?? required[0];
  return mode === primary ? clauses : ["summary"];
};

export const requiredModes = (law: Law, level: "READY" | "RELEASE"): string[] =>
  ordered(law.evidenceModes.filter((mode) => level === "RELEASE" || !mode.startsWith("dynamic.")));

export const deferredModes = (law: Law, level: "READY" | "RELEASE"): string[] =>
  level === "READY" ? ordered(law.evidenceModes.filter((mode) => mode.startsWith("dynamic."))) : [];

const validEvidenceRef = (value: string): boolean => {
  const match = /^([a-z]+):([^#]+)#(.+)$/u.exec(value);
  return Boolean(match && evidenceKinds.has(match[1]!) && match[2] && match[3] && !/[\0-\x1f\x7f]/u.test(value));
};

const evidenceKind = (value: string): string => value.slice(0, value.indexOf(":"));

const validateFinding = (finding: QualityFinding, lawId: string): void => {
  if (!exactKeys(finding, findingKeys)
    || !/^[A-Z][A-Z0-9_]*$/u.test(finding.code)
    || !finding.evidenceRefs.length || !exactOrdered(finding.evidenceRefs)
    || finding.evidenceRefs.some((ref) => !validEvidenceRef(ref))) fail("QUALITY_FINDING_INVALID", lawId);
};

const validateAssertion = (assertion: QualityAssertion, law: Law, required: readonly string[]): void => {
  const expectedKind = evidenceKindByMode[assertion.evidenceMode];
  if (!exactKeys(assertion, assertionKeys)
    || !required.includes(assertion.evidenceMode)
    || !expectedKind
    || !assertion.clauses.length || !exactOrdered(assertion.clauses)
    || assertion.clauses.some((clause) => !clausesForLaw(law).includes(clause))
    || !assertion.refs.length || !exactOrdered(assertion.refs)
    || assertion.refs.some((ref) => !validEvidenceRef(ref))
    || !assertion.refs.some((ref) => evidenceKind(ref) === expectedKind)
    || assertion.refs.some((ref) => ![expectedKind, "scope"].includes(evidenceKind(ref)))) {
    fail("QUALITY_ASSERTION_INVALID", law.lawId);
  }
};

const validateLawExecution = (result: LawExecutionResult, law: Law, level: "READY" | "RELEASE"): void => {
  if (!exactKeys(result, resultKeys) || result.lawId !== law.lawId) {
    fail("LAW_RESULT_INVALID", law.lawId);
  }
  const required = requiredModes(law, level);
  result.assertions.forEach((assertion) => validateAssertion(assertion, law, required));
  result.findings.forEach((finding) => validateFinding(finding, law.lawId));
  const modes = ordered(result.assertions.map((assertion) => assertion.evidenceMode));
  if (JSON.stringify(modes) !== JSON.stringify(required)) fail("EVIDENCE_MODE_DENOMINATOR_MISMATCH", law.lawId);
  for (const mode of required) {
    const current = result.assertions.filter((assertion) => assertion.evidenceMode === mode);
    const signatures = current.map((assertion) => JSON.stringify(assertion.clauses));
    if (!current.length || signatures.length !== new Set(signatures).size) fail("QUALITY_ASSERTION_DUPLICATE", `${law.lawId}:${mode}`);
  }
  const covered = ordered(result.assertions.flatMap((assertion) => assertion.clauses));
  if (JSON.stringify(covered) !== JSON.stringify(clausesForLaw(law))) fail("LAW_CLAUSE_DENOMINATOR_MISMATCH", law.lawId);
  if (result.assertions.some((assertion) => !assertion.passed) && !result.findings.length) fail("FAILED_ASSERTION_WITHOUT_FINDING", law.lawId);
};

const lawReport = (result: LawExecutionResult, law: Law, level: "READY" | "RELEASE"): QualityLawReport => {
  validateLawExecution(result, law, level);
  const required = requiredModes(law, level);
  const positive = result.assertions.filter((assertion) => assertion.passed);
  const evidence = required.flatMap((mode) => {
    const refs = ordered(positive.filter((assertion) => assertion.evidenceMode === mode).flatMap((assertion) => assertion.refs));
    return refs.length ? [{ evidenceMode: mode, refs }] : [];
  });
  const passed = result.findings.length === 0 && result.assertions.every((assertion) => assertion.passed)
    && evidence.length === required.length;
  return {
    lawId: law.lawId,
    declaredEvidenceModes: law.evidenceModes,
    requiredEvidenceModes: required,
    deferredEvidenceModes: deferredModes(law, level),
    evidence,
    outcome: passed ? "PASS" : "FAIL",
    findings: result.findings,
  };
};

export const buildQualityReport = (input: {
  level: Level;
  gitCommit: string;
  laws: Law[];
  results: LawExecutionResult[];
  participants?: QualityParticipant[];
}): QualityReport => {
  if (input.level === "CHANGE") fail("ENTRY_CONTRACT_MISMATCH", "CHANGE has no full law report");
  if (!validGitObjectId(input.gitCommit)) fail("QUALITY_REPORT_INVALID", "gitCommit");
  const level: "READY" | "RELEASE" = input.level === "READY" ? "READY" : "RELEASE";
  const lawIds = input.laws.map((law) => law.lawId);
  const resultIds = input.results.map((result) => result.lawId);
  if (!exactOrdered(lawIds) || JSON.stringify(resultIds) !== JSON.stringify(lawIds) || resultIds.length !== new Set(resultIds).size) {
    fail("LAW_DENOMINATOR_MISMATCH", "quality results");
  }
  const laws = input.laws.map((law, index) => lawReport(input.results[index]!, law, level));
  const participants = validateParticipants(level, input.participants ?? []);
  return {
    schemaVersion: 4,
    level,
    gitCommit: input.gitCommit,
    laws,
    participants,
    outcome: laws.every((law) => law.outcome === "PASS") ? "PASS" : "FAIL",
  };
};
