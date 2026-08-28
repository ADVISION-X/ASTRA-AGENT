import { existsSync, lstatSync, realpathSync } from "node:fs";
import { relative, resolve } from "node:path";

import { exactKeys } from "../governance-json.js";
import { ROOT, fail, validGitObjectId } from "../governance-runtime.js";
import type { Law, Level } from "../governance-contract.js";

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
  "static.types": "test",
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

const clauseDenominator = (law: Law): string[] => [
  ...law.forbidden.map((_, index) => `forbidden:${index}`),
  "summary",
].sort(byteCompare);

export const requiredModes = (law: Law, level: "READY" | "RELEASE"): string[] =>
  ordered(law.evidenceModes.filter((mode) => level === "RELEASE" || !mode.startsWith("dynamic.")));

export const deferredModes = (law: Law, level: "READY" | "RELEASE"): string[] =>
  level === "READY" ? ordered(law.evidenceModes.filter((mode) => mode.startsWith("dynamic."))) : [];

const canonicalPercentEncoded = (value: string): string | null => {
  try {
    const decoded = decodeURIComponent(value);
    return encodeURIComponent(decoded) === value ? decoded : null;
  } catch { return null; }
};

type ParsedEvidenceRef = Readonly<{ kind: string; locator: string; selector: string; receipt?: string }>;
const parseEvidenceRef = (value: string): ParsedEvidenceRef | null => {
  const match = /^([a-z]+):([^#@]+)#([^#@]+)(?:@((?:sha256:)?[a-f0-9]{64}))?$/u.exec(value);
  if (!match || !evidenceKinds.has(match[1]!) || /[\0-\x1f\x7f]/u.test(value)) return null;
  const selector = canonicalPercentEncoded(match[3]!);
  const dynamicLocator = match[1] === "dynamic" ? canonicalPercentEncoded(match[2]!) : match[2]!;
  if (selector === null || /[#:@]/u.test(match[3]!) || dynamicLocator === null
    || (match[1] !== "dynamic" && match[2]!.includes(":"))) return null;
  return { kind: match[1]!, locator: dynamicLocator, selector, ...(match[4] ? { receipt: match[4] } : {}) };
};
const validRepositoryLocator = (locator: string): boolean => !locator.startsWith("/")
  && !locator.startsWith("\\") && !locator.includes("%")
  && locator.split(/[\\/]/u).every((part) => part !== "" && part !== "." && part !== "..");
const repositoryObjectExists = (locator: string): boolean => {
  if (!validRepositoryLocator(locator)) return false;
  const root = realpathSync(ROOT);
  const absolute = resolve(root, locator);
  if (!existsSync(absolute)) return false;
  const escaped = relative(root, realpathSync(absolute));
  return escaped !== ".." && !escaped.startsWith("../") && lstatSync(absolute).isFile();
};
const validEvidenceObject = (reference: ParsedEvidenceRef): boolean => {
  if (reference.kind === "dynamic") return Boolean(reference.receipt)
    && /^\//u.test(reference.locator);
  if (reference.receipt !== undefined) return false;
  if (reference.kind !== "scope") return repositoryObjectExists(reference.locator);
  return /^LAW-[A-Z0-9-]+$/u.test(reference.locator) && reference.selector === "appliesTo-minus-excludes";
};

export const validEvidenceRef = (value: string): boolean => {
  const reference = parseEvidenceRef(value);
  return reference !== null && validEvidenceObject(reference)
    && !/(?:^|[;=])(?:fixed|pass|true)(?:$|[;=])/iu.test(reference.selector);
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
  const scopeOnly = assertion.evidenceMode.startsWith("static.") && assertion.refs.length === 1
    && assertion.refs[0] === `scope:${law.lawId}#appliesTo-minus-excludes`;
  if (!exactKeys(assertion, assertionKeys)) fail("LAW_EVIDENCE_MISSING", `${law.lawId}:shape`);
  if (!required.includes(assertion.evidenceMode) || !expectedKind) fail("UNDECLARED_EVIDENCE_MODE", `${law.lawId}:${assertion.evidenceMode}`);
  if (!assertion.refs.length) fail("EMPTY_EVIDENCE_REFS", `${law.lawId}:${assertion.evidenceMode}`);
  if (!assertion.clauses.length || !exactOrdered(assertion.clauses)
    || assertion.clauses.some((clause) => !clauseDenominator(law).includes(clause))
    || !exactOrdered(assertion.refs)
    || assertion.refs.some((ref) => !validEvidenceRef(ref))
    || (!scopeOnly && !assertion.refs.some((ref) => evidenceKind(ref) === expectedKind))
    || assertion.refs.some((ref) => ![expectedKind, "scope"].includes(evidenceKind(ref)))) {
    fail("LAW_EVIDENCE_MISSING", law.lawId);
  }
};

const validateLawExecution = (result: LawExecutionResult, law: Law, level: "READY" | "RELEASE"): void => {
  if (!exactKeys(result, resultKeys) || result.lawId !== law.lawId) {
    fail("LAW_DENOMINATOR_MISSING", law.lawId);
  }
  const required = requiredModes(law, level);
  result.assertions.forEach((assertion) => validateAssertion(assertion, law, required));
  result.findings.forEach((finding) => validateFinding(finding, law.lawId));
  const modes = ordered(result.assertions.map((assertion) => assertion.evidenceMode));
  if (JSON.stringify(modes) !== JSON.stringify(required)) fail("LAW_EVIDENCE_MISSING", law.lawId);
  for (const mode of required) {
    const current = result.assertions.filter((assertion) => assertion.evidenceMode === mode);
    const signatures = current.map((assertion) => JSON.stringify(assertion.clauses));
    if (!current.length) fail("LAW_EVIDENCE_MISSING", `${law.lawId}:${mode}`);
    if (signatures.length !== new Set(signatures).size) fail("LAW_EVIDENCE_DUPLICATE", `${law.lawId}:${mode}`);
  }
  const covered = ordered(result.assertions.flatMap((assertion) => assertion.clauses));
  if (JSON.stringify(covered) !== JSON.stringify(clauseDenominator(law))) fail("LAW_CLAUSE_DENOMINATOR_MISMATCH", law.lawId);
  if (result.assertions.some((assertion) => !assertion.passed) && !result.findings.length) fail("LAW_FAILED", law.lawId);
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
    fail("LAW_DENOMINATOR_MISSING", "quality results");
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
