import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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
  passed?: boolean;
  findings?: Array<{ code: string; evidenceRefs: string[] }>;
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
export type ExamReceiptBinding = Readonly<{
  lawId: string;
  evidenceMode: string;
  clauses: readonly string[];
  observedValue: string;
  caseLocator: string;
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
const producerContractFor = (script: string, sourcePath?: string): Record<string, unknown> | null => {
  const source = sourcePath ? resolve(sourcePath) : producerSourceFor(script);
  if (!source || !source.startsWith(`${resolve("scripts/acceptance")}/`) || !existsSync(source)) return null;
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
export const producerClaimRoutesFor = (script: string, sourcePath?: string): string[] | null => {
  const contract = producerContractFor(script, sourcePath);
  if (!contract || !exactKeys(contract, ["routes", "schema_version"])
    || contract.schema_version !== "producer-dynamic-claim-contract.v1" || !plainObject(contract.routes)) return null;
  const routes = Object.entries(contract.routes);
  if (!routes.length || routes.some(([route, value]) => !/^LAW-[A-Z0-9-]+:dynamic\.[a-z]+$/u.test(route)
    || !plainObject(value) || !exactKeys(value, ["claims"]) || !plainObject(value.claims)
    || Object.keys(value.claims).length === 0)) return null;
  return routes.map(([route]) => route).sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
};
export const producerClaimRoutesMatch = (script: string, required: readonly string[]): boolean =>
  JSON.stringify(producerClaimRoutesFor(script)) === JSON.stringify([...required].sort((left, right) =>
    Buffer.compare(Buffer.from(left), Buffer.from(right))));
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

type ExamAssertionTrace = Readonly<{
  schema_version: "governance-exam-assertion.v1";
  proof_run_id: string;
  candidate: string;
  producer_script: string;
  process_id: number;
  sequence: number;
  method: string;
  source_path: string;
  source_line: number;
  source_column: number;
  source_digest: string;
  source_line_digest: string;
  argument_digest: string;
}>;
const examTraceKeys = [
  "argument_digest", "candidate", "method", "process_id", "producer_script", "proof_run_id", "schema_version",
  "sequence", "source_column", "source_digest", "source_line", "source_line_digest", "source_path",
];
const examAssertionMethods = new Set([
  "deepEqual", "deepStrictEqual", "doesNotMatch", "doesNotReject", "doesNotThrow", "equal", "ifError", "match",
  "notDeepEqual", "notDeepStrictEqual", "notEqual", "notStrictEqual", "ok", "partialDeepStrictEqual", "rejects",
  "strictEqual", "throws",
]);
const examAssertionSourceValid = (trace: ExamAssertionTrace): boolean => {
  const root = resolve();
  const sourcePath = resolve(trace.source_path);
  if (sourcePath !== trace.source_path || !sourcePath.startsWith(`${root}/`)
    || !/(?:\/scripts\/acceptance\/|\/src\/[^/]+(?:\/[^/]+)*\/acceptance\/)/u.test(sourcePath)
    || !existsSync(sourcePath)) return false;
  const stat = lstatSync(sourcePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4 * 1024 * 1024) return false;
  const source = readFileSync(sourcePath, "utf8");
  const line = source.split("\n")[trace.source_line - 1] ?? "";
  const compact = line.replace(/\s+/gu, "");
  return trace.source_digest === createHash("sha256").update(source).digest("hex")
    && trace.source_line_digest === createHash("sha256").update(line).digest("hex")
    && /\bassert(?:\.[A-Za-z]+)?\s*\(/u.test(line)
    && !/assert(?:\.ok)?\(true(?:[,\)])|assert\.(?:equal|strictEqual|deepEqual|deepStrictEqual)\(([^,()]+),\1[,\)]/u.test(compact);
};
const examTraceBindingValid = (value: Record<string, unknown>, binding: ExamReceiptBinding): boolean =>
  value.schema_version === "governance-exam-assertion.v1"
  && value.proof_run_id === binding.proofRunId
  && value.candidate === binding.candidate
  && value.producer_script === binding.producerScript
  && examAssertionMethods.has(String(value.method));
const examTraceCoordinatesValid = (value: Record<string, unknown>): boolean =>
  Number.isSafeInteger(value.process_id) && Number(value.process_id) > 0
  && Number.isSafeInteger(value.sequence) && Number(value.sequence) > 0
  && Number.isSafeInteger(value.source_line) && Number(value.source_line) > 0
  && Number.isSafeInteger(value.source_column) && Number(value.source_column) > 0;
const examTraceSourceFieldsValid = (value: Record<string, unknown>): boolean =>
  typeof value.source_path === "string"
  && digest(value.source_digest)
  && digest(value.source_line_digest)
  && digest(value.argument_digest);
const examTraceValid = (value: unknown, binding: ExamReceiptBinding): value is ExamAssertionTrace => {
  if (!plainObject(value) || !exactKeys(value, examTraceKeys)
    || !examTraceBindingValid(value, binding)
    || !examTraceCoordinatesValid(value)
    || !examTraceSourceFieldsValid(value)) return false;
  return examAssertionSourceValid(value as ExamAssertionTrace);
};
const examAssertionTraces = (root: string, binding: ExamReceiptBinding): ExamAssertionTrace[] => {
  const traces: ExamAssertionTrace[] = [];
  const names = readdirSync(root).filter((entry) => /^exam-assertions-[1-9][0-9]*\.jsonl$/u.test(entry)).sort();
  for (const name of names) {
    const file = resolve(root, name);
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16 * 1024 * 1024) {
      throw new Error("QUALITY_EXAM_ASSERTION_TRACE_INVALID");
    }
    for (const line of readFileSync(file, "utf8").split("\n").filter(Boolean)) {
      const trace: unknown = JSON.parse(line);
      if (!examTraceValid(trace, binding)) throw new Error("QUALITY_EXAM_ASSERTION_TRACE_INVALID");
      traces.push(trace);
    }
  }
  const unique = new Set(traces.map((trace) => createHash("sha256").update(JSON.stringify(trace)).digest("hex")));
  if (!traces.length || unique.size !== traces.length) throw new Error("QUALITY_EXAM_ASSERTION_TRACE_INVALID");
  return traces;
};
export const validateExamReceiptPayload = (payload: unknown, binding: ExamReceiptBinding): boolean => {
  if (!plainObject(payload) || !exactKeys(payload, [
    "assertion_traces", "candidate", "captured_at", "case_locator", "clauses", "evidenceMode", "lawId",
    "observed_value", "producer_script", "proof_run_id", "schema_version",
  ]) || payload.schema_version !== "governance-exam-observation.v1"
    || payload.proof_run_id !== binding.proofRunId || payload.candidate !== binding.candidate
    || payload.lawId !== binding.lawId || payload.evidenceMode !== binding.evidenceMode
    || payload.case_locator !== binding.caseLocator || payload.observed_value !== binding.observedValue
    || payload.producer_script !== binding.producerScript || !dynamicReceiptTimestampValid(payload.captured_at)
    || !clausesValid(payload.clauses) || JSON.stringify(payload.clauses) !== JSON.stringify(binding.clauses)
    || !Array.isArray(payload.assertion_traces) || !payload.assertion_traces.length) return false;
  return payload.assertion_traces.every((trace) => examTraceValid(trace, binding));
};
export const examReceiptFileValid = (file: string, binding: ExamReceiptBinding): boolean => {
  try { return validateExamReceiptPayload(JSON.parse(readFileSync(file, "utf8")), binding); }
  catch { return false; }
};
const createExamReceipt = (
  observation: QualityProofObservationInput, context: EmissionContext,
): Readonly<{ locator: string; digest: string }> => {
  const configuredRoot = process.env.GOVERNANCE_PROOF_RECEIPT_DIR?.trim();
  if (!configuredRoot) throw new Error("QUALITY_EXAM_RECEIPT_ROOT_MISSING");
  const root = resolve(configuredRoot);
  const binding: ExamReceiptBinding = {
    lawId: observation.lawId, evidenceMode: observation.evidenceMode, clauses: observation.clauses,
    observedValue: observation.observedValue, caseLocator: observation.locator,
    proofRunId: context.proofRunId, candidate: context.candidate, producerScript: context.script,
  };
  const payload = {
    schema_version: "governance-exam-observation.v1",
    proof_run_id: binding.proofRunId,
    candidate: binding.candidate,
    lawId: binding.lawId,
    evidenceMode: binding.evidenceMode,
    clauses: [...binding.clauses],
    case_locator: binding.caseLocator,
    observed_value: binding.observedValue,
    producer_script: binding.producerScript,
    captured_at: new Date().toISOString(),
    assertion_traces: examAssertionTraces(root, binding),
  };
  if (!validateExamReceiptPayload(payload, binding)) throw new Error("QUALITY_EXAM_RECEIPT_INVALID");
  const token = createHash("sha256").update(`${binding.lawId}\0${binding.evidenceMode}`).digest("hex").slice(0, 24);
  const locator = resolve(root, `exam-${token}.json`);
  writeFileSync(locator, `${JSON.stringify(payload)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  return { locator, digest: createHash("sha256").update(readFileSync(locator)).digest("hex") };
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

const proofRef = (observation: QualityProofObservationInput, context: EmissionContext,
  examReceipt: Readonly<{ locator: string; digest: string }> | null): string => {
  const dynamic = observation.evidenceMode.startsWith("dynamic.");
  const selector = encodeURIComponent([
    `lawId=${observation.lawId}`, `mode=${observation.evidenceMode}`, `command=npm run ${context.script}`,
    `case=${observation.locator}`, `run=${context.proofRunId}`, `candidate=${context.candidate}`,
    `timeoutMs=${context.timeoutMs}`, `observedValue=${observation.observedValue}`,
  ].join(";"));
  return dynamic
    ? `dynamic:${encodeURIComponent(observation.locator)}#${selector}@${observation.receipt}`
    : `exam:${encodeURIComponent(examReceipt!.locator)}#${selector}@${examReceipt!.digest}`;
};

const emissionContextValid = (context: EmissionContext): boolean => Boolean(context.script)
  && Number.isSafeInteger(context.timeoutMs) && context.timeoutMs >= 1;
const emissionShapeValid = (observation: QualityProofObservationInput, dynamic: boolean): boolean =>
  locatorValid(dynamic, observation.locator)
  && Boolean(observation.observedValue.trim())
  && receiptValid(dynamic, observation.receipt)
  && (dynamic
    ? typeof observation.passed === "boolean" && Array.isArray(observation.findings)
    : observation.passed === undefined && observation.findings === undefined);
const nativeEmissionReceiptValid = (
  observation: QualityProofObservationInput,
  context: EmissionContext,
  dynamic: boolean,
): boolean => !dynamic || nativeReceiptValid(observation.locator, observation.receipt, observation, context);

export const emitQualityProofObservation = (observation: QualityProofObservationInput): void => {
  const context = contextForEmission();
  if (!context.proofRunId && !context.candidate && context.proofKind === undefined) return;
  const dynamic = observation.evidenceMode.startsWith("dynamic.");
  if (!emissionContextValid(context) || !emissionShapeValid(observation, dynamic)
    || !nativeEmissionReceiptValid(observation, context, dynamic)) {
    throw new Error("QUALITY_PROOF_OBSERVATION_INVALID");
  }
  const examReceipt = dynamic ? null : createExamReceipt(observation, context);
  const emitted: QualityProofObservation = {
    lawId: observation.lawId, evidenceMode: observation.evidenceMode,
    clauses: observation.clauses, passed: dynamic ? observation.passed! : true,
    refs: [proofRef(observation, context, examReceipt)], findings: dynamic ? observation.findings! : [],
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
