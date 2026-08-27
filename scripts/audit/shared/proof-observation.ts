import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type QualityProofObservation = Readonly<{
  lawId: string;
  evidenceMode: string;
  clauses: string[];
  passed: boolean;
  refs: string[];
  findings: Array<{ code: string; evidenceRefs: string[] }>;
  proofRunId: string;
  candidate: string;
  proofKind: "exam" | "dynamic";
}>;

type QualityProofObservationInput = Readonly<{
  lawId: string;
  evidenceMode: string;
  clauses: string[];
  passed: boolean;
  findings: Array<{ code: string; evidenceRefs: string[] }>;
  locator: string;
  observedValue: string;
  receipt?: string;
}>;
export type QualityProofRequest = Readonly<{
  lawId: string;
  evidenceMode: string;
  proofRunId: string;
  candidate: string;
  proofKind: "exam" | "dynamic";
}>;
type ProofContext = Pick<QualityProofObservation, "proofRunId" | "candidate" | "proofKind">;
type EmissionContext = ProofContext & { script: string; timeoutMs: number };
export type DynamicObservationKind = "browser" | "service" | "database" | "storage"
  | "provider" | "authorization" | "recovery";
export type DynamicReceiptBinding = Readonly<{
  lawId: string;
  evidenceMode: string;
  clauses: readonly string[];
  observedValue: string;
  proofRunId: string;
  candidate: string;
  producerScript: string;
}>;

export const proofObservationPrefix = "QUALITY_PROOF_OBSERVATION ";
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const candidateValid = (value: unknown): value is string =>
  typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(value);
const receiptValid = (dynamic: boolean, receipt: unknown): boolean =>
  dynamic ? digest(receipt) : receipt === undefined;
const locatorValid = (dynamic: boolean, locator: unknown): locator is string => typeof locator === "string"
  && !/[\0-\x1f\x7f]/u.test(locator)
  && (dynamic
    ? /^\//u.test(locator)
    : /^(?:acceptance|proof):[a-z0-9][a-z0-9:._/-]*$/u.test(locator));
const clausesValid = (clauses: unknown): clauses is string[] => Array.isArray(clauses)
  && clauses.length > 0
  && clauses.every((clause) => typeof clause === "string"
    && (clause === "summary" || /^forbidden:(?:0|[1-9][0-9]*)$/u.test(clause)))
  && !(clauses.length === 1 && clauses[0] === "summary")
  && JSON.stringify(clauses) === JSON.stringify([...new Set(clauses)].sort((left, right) =>
    Buffer.compare(Buffer.from(left), Buffer.from(right))));
const findingsValid = (findings: unknown, passed: unknown): findings is QualityProofObservation["findings"] =>
  Array.isArray(findings) && findings.every((finding) => finding && typeof finding === "object"
    && Object.keys(finding).sort().join(",") === "code,evidenceRefs"
    && /^[A-Z][A-Z0-9_]*$/u.test((finding as { code?: string }).code ?? "")
    && Array.isArray((finding as { evidenceRefs?: unknown }).evidenceRefs)
    && (finding as { evidenceRefs: unknown[] }).evidenceRefs.length > 0)
  && (passed === true ? findings.length === 0 : findings.length > 0);
const refsValid = (refs: unknown, dynamic: boolean): refs is string[] => Array.isArray(refs)
  && refs.length > 0
  && refs.every((reference) => typeof reference === "string"
    && (dynamic ? reference.startsWith("dynamic:") : reference.startsWith("exam:")))
  && JSON.stringify(refs) === JSON.stringify([...new Set(refs)].sort((left, right) =>
    Buffer.compare(Buffer.from(left), Buffer.from(right))));
const contextForEmission = (): EmissionContext => ({
  proofRunId: process.env.GOVERNANCE_PROOF_RUN_ID?.trim() ?? "",
  candidate: process.env.GOVERNANCE_PROOF_CANDIDATE?.trim() ?? "",
  proofKind: process.env.GOVERNANCE_PROOF_KIND?.trim() as ProofContext["proofKind"],
  script: process.env.GOVERNANCE_PROOF_SCRIPT?.trim() ?? "",
  timeoutMs: Number(process.env.GOVERNANCE_PROOF_TIMEOUT_MS ?? ""),
});

const exactKeys = (value: Readonly<Record<string, unknown>>, expected: readonly string[]): boolean =>
  Object.keys(value).sort().join(",") === [...expected].sort().join(",");
const plainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const nonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && !/[\0-\x1f\x7f]/u.test(value);
const stringList = (value: unknown): value is string[] => Array.isArray(value) && value.length > 0
  && value.every(nonEmptyString) && value.length === new Set(value).size;
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const countMap = (value: unknown): boolean => plainObject(value) && Object.keys(value).length > 0
  && Object.values(value).every(count);
const factMap = (value: unknown): boolean => plainObject(value) && Object.keys(value).length > 0
  && Object.entries(value).every(([key, fact]) => /^[a-z][a-z0-9_]*$/u.test(key)
    && (typeof fact === "boolean" || count(fact) || nonEmptyString(fact)));

const browserObservationValid = (value: Record<string, unknown>): boolean =>
  exactKeys(value, ["browserVersion", "endpoint", "facts", "pageTitle", "sessionFacts"])
    && nonEmptyString(value.browserVersion) && nonEmptyString(value.endpoint) && nonEmptyString(value.pageTitle)
    && /^https?:\/\//u.test(value.endpoint) && plainObject(value.sessionFacts)
    && Object.keys(value.sessionFacts).length > 0 && factMap(value.facts);
const serviceObservationValid = (value: Record<string, unknown>): boolean => exactKeys(value, [
    "cleanupVerified", "components", "endpoint", "facts", "processId", "serviceName", "sourceFingerprint", "status",
  ]) && value.cleanupVerified === true && stringList(value.components) && nonEmptyString(value.endpoint)
    && /^https?:\/\//u.test(value.endpoint) && Number.isSafeInteger(value.processId) && Number(value.processId) > 0
    && nonEmptyString(value.serviceName) && nonEmptyString(value.sourceFingerprint) && nonEmptyString(value.status)
    && factMap(value.facts);
const databaseObservationValid = (value: Record<string, unknown>): boolean =>
  exactKeys(value, ["databaseEngine", "databasePath", "facts", "identitySet", "recordCounts"])
    && value.databaseEngine === "sqlite" && nonEmptyString(value.databasePath) && /^\//u.test(value.databasePath)
    && stringList(value.identitySet) && countMap(value.recordCounts) && factMap(value.facts);
const storageObservationValid = (value: Record<string, unknown>): boolean => exactKeys(value, [
    "confirmedCount", "facts", "mutationCount", "storageEngine", "storagePath", "unresolvedCount",
  ]) && value.storageEngine === "sqlite-wal" && nonEmptyString(value.storagePath) && /^\//u.test(value.storagePath)
    && count(value.confirmedCount) && count(value.mutationCount) && count(value.unresolvedCount)
    && Number(value.confirmedCount) <= Number(value.mutationCount) && factMap(value.facts);
const providerObservationValid = (value: Record<string, unknown>): boolean =>
  exactKeys(value, ["catalogHash", "facts", "pluginIds", "providerName", "terminalReceiptCount"])
    && nonEmptyString(value.catalogHash) && stringList(value.pluginIds) && nonEmptyString(value.providerName)
    && count(value.terminalReceiptCount) && Number(value.terminalReceiptCount) > 0 && factMap(value.facts);
const authorizationObservationValid = (value: Record<string, unknown>): boolean =>
  exactKeys(value, ["authorityState", "facts", "fenceHashes", "grantCount", "principalIds"])
    && value.authorityState === "present" && stringList(value.fenceHashes) && count(value.grantCount)
    && Number(value.grantCount) > 0 && stringList(value.principalIds) && factMap(value.facts);
const recoveryObservationValid = (value: Record<string, unknown>): boolean =>
  exactKeys(value, ["facts", "finalState", "observedStates", "recoveryJobId", "unresolvedCount"])
    && nonEmptyString(value.finalState) && stringList(value.observedStates) && nonEmptyString(value.recoveryJobId)
    && count(value.unresolvedCount) && factMap(value.facts);
const observationValidators: Readonly<Record<DynamicObservationKind,
  (value: Record<string, unknown>) => boolean>> = {
  browser: browserObservationValid,
  service: serviceObservationValid,
  database: databaseObservationValid,
  storage: storageObservationValid,
  provider: providerObservationValid,
  authorization: authorizationObservationValid,
  recovery: recoveryObservationValid,
};
const dynamicKind = (value: string): value is DynamicObservationKind => Object.hasOwn(observationValidators, value);
const dynamicObservationValid = (kind: DynamicObservationKind, value: unknown): boolean =>
  plainObject(value) && observationValidators[kind](value);

const dynamicReceiptIdentityValid = (
  payload: Record<string, unknown>, binding: DynamicReceiptBinding, kind: DynamicObservationKind,
): boolean => payload.schema_version === "governance-dynamic-observation.v2"
  && payload.proof_run_id === binding.proofRunId && payload.candidate === binding.candidate
  && payload.lawId === binding.lawId && payload.evidenceMode === binding.evidenceMode
  && payload.observation_kind === kind && payload.observed_value === binding.observedValue
  && payload.producer_script === binding.producerScript;
const dynamicReceiptClausesValid = (
  payload: Record<string, unknown>, binding: DynamicReceiptBinding,
): boolean => clausesValid(payload.clauses)
  && JSON.stringify(payload.clauses) === JSON.stringify(binding.clauses);
const dynamicReceiptTimestampValid = (value: unknown): boolean => {
  const capturedAt = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(capturedAt) && new Date(capturedAt).toISOString() === value;
};

type ProducerFact = Readonly<{ path: string; operator: "equals" | "includes" | "gte"; expected: unknown }>;
const claimContractMarker = Object.freeze({
  begin: "/* GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_BEGIN */",
  end: "/* GOVERNANCE_DYNAMIC_CLAIM_CONTRACT_END */",
});
const producerSourceFor = (script: string): string | null => {
  try {
    const manifest = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as { scripts?: Record<string, unknown> };
    const command = manifest.scripts?.[script];
    if (typeof command !== "string") return null;
    const source = command.split(/\s+/u).find((part) => /^scripts\/acceptance\/[a-z0-9._/-]+\.ts$/u.test(part));
    if (!source) return null;
    const absolute = resolve(source);
    return absolute.startsWith(`${resolve("scripts/acceptance")}/`) ? absolute : null;
  } catch { return null; }
};
const producerContractFor = (script: string): Record<string, unknown> | null => {
  const source = producerSourceFor(script);
  if (!source || !existsSync(source)) return null;
  const text = readFileSync(source, "utf8");
  const begin = text.indexOf(claimContractMarker.begin);
  const end = text.indexOf(claimContractMarker.end);
  if (begin < 0 || end <= begin || text.indexOf(claimContractMarker.begin, begin + 1) >= 0
    || text.indexOf(claimContractMarker.end, end + 1) >= 0) return null;
  try {
    const parsed: unknown = JSON.parse(text.slice(begin + claimContractMarker.begin.length, end).trim());
    return plainObject(parsed) ? parsed : null;
  } catch { return null; }
};
const valueAt = (observation: Record<string, unknown>, pointer: string): unknown => {
  if (!/^\/(?:facts\/)?[a-z][a-zA-Z0-9_]*(?:\/[a-z][a-zA-Z0-9_]*)*$/u.test(pointer)) return undefined;
  let current: unknown = observation;
  for (const segment of pointer.slice(1).split("/")) {
    if (!plainObject(current) || !Object.hasOwn(current, segment)) return undefined;
    current = current[segment];
  }
  return current;
};
const producerFactValid = (fact: unknown, observation: Record<string, unknown>): fact is ProducerFact => {
  if (!plainObject(fact) || !exactKeys(fact, ["expected", "operator", "path"])
    || typeof fact.path !== "string" || !["equals", "includes", "gte"].includes(String(fact.operator))) return false;
  const actual = valueAt(observation, fact.path);
  if (fact.operator === "equals") return JSON.stringify(actual) === JSON.stringify(fact.expected);
  if (fact.operator === "includes") return (Array.isArray(actual) || typeof actual === "string")
    && actual.includes(fact.expected as never);
  return typeof actual === "number" && typeof fact.expected === "number" && actual >= fact.expected;
};
const producerClaimsValid = (payload: Record<string, unknown>, binding: DynamicReceiptBinding): boolean => {
  const contract = producerContractFor(binding.producerScript);
  if (!contract || !exactKeys(contract, ["routes", "schema_version"])
    || contract.schema_version !== "producer-dynamic-claim-contract.v1" || !plainObject(contract.routes)
    || !plainObject(payload.observation)) return false;
  const route = contract.routes[`${binding.lawId}:${binding.evidenceMode}`];
  if (!plainObject(route) || !exactKeys(route, ["claims"]) || !plainObject(route.claims)) return false;
  const contractClauses = Object.keys(route.claims).sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  if (JSON.stringify(contractClauses) !== JSON.stringify(binding.clauses)) return false;
  return contractClauses.every((clause) => {
    const facts = (route.claims as Record<string, unknown>)[clause];
    return Array.isArray(facts) && facts.length > 0 && facts.every((fact) => producerFactValid(fact, payload.observation as Record<string, unknown>));
  });
};

export const validateDynamicReceiptPayload = (
  payload: unknown, binding: DynamicReceiptBinding,
): boolean => {
  if (!plainObject(payload) || !exactKeys(payload, [
    "candidate", "captured_at", "clauses", "evidenceMode", "lawId", "observation",
    "observation_kind", "observed_value", "producer_script", "proof_run_id", "schema_version",
  ])) return false;
  const kind = binding.evidenceMode.startsWith("dynamic.")
    ? binding.evidenceMode.slice("dynamic.".length) : "";
  return dynamicKind(kind) && dynamicReceiptIdentityValid(payload, binding, kind)
    && dynamicReceiptClausesValid(payload, binding) && dynamicReceiptTimestampValid(payload.captured_at)
    && dynamicObservationValid(kind, payload.observation) && producerClaimsValid(payload, binding);
};

export const dynamicReceiptFileValid = (file: string, binding: DynamicReceiptBinding): boolean => {
  try { return validateDynamicReceiptPayload(JSON.parse(readFileSync(file, "utf8")), binding); }
  catch { return false; }
};

const nativeReceiptValid = (locator: string, receipt: string | undefined,
  observation: QualityProofObservationInput, context: EmissionContext): boolean => {
  const configuredRoot = process.env.GOVERNANCE_PROOF_RECEIPT_DIR?.trim();
  if (!configuredRoot || !receipt) return false;
  const root = resolve(configuredRoot);
  const file = resolve(locator);
  if (file !== locator || dirname(file) !== root || !existsSync(root) || !existsSync(file)) return false;
  const rootStat = lstatSync(root);
  const fileStat = lstatSync(file);
  return rootStat.isDirectory() && !rootStat.isSymbolicLink()
    && fileStat.isFile() && !fileStat.isSymbolicLink() && fileStat.size <= 16 * 1024 * 1024
    && createHash("sha256").update(readFileSync(file)).digest("hex") === receipt
    && dynamicReceiptFileValid(file, {
      lawId: observation.lawId, evidenceMode: observation.evidenceMode, clauses: observation.clauses,
      observedValue: observation.observedValue, proofRunId: context.proofRunId, candidate: context.candidate,
      producerScript: context.script,
    });
};

const observationValid = (
  observation: Partial<QualityProofObservation>, context: ProofContext, dynamic: boolean,
): boolean => observation.lawId?.startsWith("LAW-") === true
  && /^(exam|dynamic)\./u.test(observation.evidenceMode ?? "")
  && clausesValid(observation.clauses) && typeof observation.passed === "boolean"
  && refsValid(observation.refs, dynamic) && findingsValid(observation.findings, observation.passed)
  && digest(context.proofRunId) && candidateValid(context.candidate)
  && context.proofKind === (dynamic ? "dynamic" : "exam");

const proofRef = (observation: QualityProofObservationInput, context: EmissionContext): string => {
  const dynamic = observation.evidenceMode.startsWith("dynamic.");
  const selector = encodeURIComponent([
    `lawId=${observation.lawId}`, `mode=${observation.evidenceMode}`, `command=npm run ${context.script}`,
    `case=${observation.locator}`, `run=${context.proofRunId}`, `candidate=${context.candidate}`,
    `timeoutMs=${context.timeoutMs}`, `observedValue=${observation.observedValue}`,
  ].join(";"));
  return dynamic
    ? `dynamic:${encodeURIComponent(observation.locator)}#${selector}@${observation.receipt}`
    : `exam:package.json#${selector}`;
};

export const emitQualityProofObservation = (observation: QualityProofObservationInput): void => {
  const context = contextForEmission();
  if (!context.proofRunId && !context.candidate && context.proofKind === undefined) return;
  const dynamic = observation.evidenceMode.startsWith("dynamic.");
  if (!locatorValid(dynamic, observation.locator) || !observation.observedValue.trim()
    || !receiptValid(dynamic, observation.receipt) || !context.script
    || (dynamic && !nativeReceiptValid(observation.locator, observation.receipt, observation, context))
    || !Number.isSafeInteger(context.timeoutMs) || context.timeoutMs < 1) {
    throw new Error("QUALITY_PROOF_OBSERVATION_INVALID");
  }
  const emitted: QualityProofObservation = {
    lawId: observation.lawId, evidenceMode: observation.evidenceMode,
    clauses: observation.clauses, passed: observation.passed,
    refs: [proofRef(observation, context)], findings: observation.findings,
    proofRunId: context.proofRunId, candidate: context.candidate, proofKind: context.proofKind,
  };
  if (!observationValid(emitted, context, dynamic)) throw new Error("QUALITY_PROOF_OBSERVATION_INVALID");
  process.stdout.write(`${proofObservationPrefix}${JSON.stringify(emitted)}\n`);
};

const exactObservationKeys = (parsed: Partial<QualityProofObservation>): boolean => {
  const expected = "candidate,clauses,evidenceMode,findings,lawId,passed,proofKind,proofRunId,refs";
  return Object.keys(parsed).sort().join(",") === expected;
};

const parseObservation = (line: string): QualityProofObservation => {
  const parsed = JSON.parse(line.slice(proofObservationPrefix.length)) as Partial<QualityProofObservation>;
  const dynamic = parsed.evidenceMode?.startsWith("dynamic.") ?? false;
  const context = { proofRunId: parsed.proofRunId, candidate: parsed.candidate, proofKind: parsed.proofKind } as ProofContext;
  if (!exactObservationKeys(parsed) || !observationValid(parsed, context, dynamic)) {
    throw new Error("QUALITY_PROOF_OBSERVATION_INVALID");
  }
  return parsed as QualityProofObservation;
};

export const parseQualityProofObservations = (stdout: string): QualityProofObservation[] =>
  stdout.split("\n").filter((line) => line.startsWith(proofObservationPrefix)).map(parseObservation);
