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

const dynamicObservationValid = (kind: DynamicObservationKind, value: unknown): boolean => {
  if (!plainObject(value)) return false;
  if (kind === "browser") return exactKeys(value, ["browserVersion", "endpoint", "pageTitle", "sessionFacts"])
    && nonEmptyString(value.browserVersion) && nonEmptyString(value.endpoint) && nonEmptyString(value.pageTitle)
    && /^https?:\/\//u.test(value.endpoint) && plainObject(value.sessionFacts)
    && Object.keys(value.sessionFacts).length > 0;
  if (kind === "service") return exactKeys(value, [
    "cleanupVerified", "components", "endpoint", "processId", "serviceName", "sourceFingerprint", "status",
  ]) && value.cleanupVerified === true && stringList(value.components) && nonEmptyString(value.endpoint)
    && /^https?:\/\//u.test(value.endpoint) && Number.isSafeInteger(value.processId) && Number(value.processId) > 0
    && nonEmptyString(value.serviceName) && nonEmptyString(value.sourceFingerprint) && nonEmptyString(value.status);
  if (kind === "database") return exactKeys(value, ["databaseEngine", "databasePath", "identitySet", "recordCounts"])
    && value.databaseEngine === "sqlite" && nonEmptyString(value.databasePath) && /^\//u.test(value.databasePath)
    && stringList(value.identitySet) && countMap(value.recordCounts);
  if (kind === "storage") return exactKeys(value, [
    "confirmedCount", "mutationCount", "storageEngine", "storagePath", "unresolvedCount",
  ]) && value.storageEngine === "sqlite-wal" && nonEmptyString(value.storagePath) && /^\//u.test(value.storagePath)
    && count(value.confirmedCount) && count(value.mutationCount) && count(value.unresolvedCount)
    && Number(value.confirmedCount) <= Number(value.mutationCount);
  if (kind === "provider") return exactKeys(value, ["catalogHash", "pluginIds", "providerName", "terminalReceiptCount"])
    && nonEmptyString(value.catalogHash) && stringList(value.pluginIds) && nonEmptyString(value.providerName)
    && count(value.terminalReceiptCount) && Number(value.terminalReceiptCount) > 0;
  if (kind === "authorization") return exactKeys(value, ["authorityState", "fenceHashes", "grantCount", "principalIds"])
    && value.authorityState === "present" && stringList(value.fenceHashes) && count(value.grantCount)
    && Number(value.grantCount) > 0 && stringList(value.principalIds);
  return exactKeys(value, ["finalState", "observedStates", "recoveryJobId", "unresolvedCount"])
    && nonEmptyString(value.finalState) && stringList(value.observedStates) && nonEmptyString(value.recoveryJobId)
    && count(value.unresolvedCount);
};

export const validateDynamicReceiptPayload = (
  payload: unknown, binding: DynamicReceiptBinding,
): boolean => {
  if (!plainObject(payload) || !exactKeys(payload, [
    "candidate", "captured_at", "clauses", "evidenceMode", "lawId", "observation",
    "observation_kind", "observed_value", "proof_run_id", "schema_version",
  ])) return false;
  const kind = binding.evidenceMode.startsWith("dynamic.")
    ? binding.evidenceMode.slice("dynamic.".length) as DynamicObservationKind : "";
  const capturedAt = typeof payload.captured_at === "string" ? Date.parse(payload.captured_at) : Number.NaN;
  return ["browser", "service", "database", "storage", "provider", "authorization", "recovery"].includes(kind)
    && payload.schema_version === "governance-dynamic-observation.v1"
    && payload.proof_run_id === binding.proofRunId && payload.candidate === binding.candidate
    && payload.lawId === binding.lawId && payload.evidenceMode === binding.evidenceMode
    && payload.observation_kind === kind && payload.observed_value === binding.observedValue
    && clausesValid(payload.clauses)
    && JSON.stringify(payload.clauses) === JSON.stringify(binding.clauses)
    && Number.isFinite(capturedAt) && new Date(capturedAt).toISOString() === payload.captured_at
    && dynamicObservationValid(kind as DynamicObservationKind, payload.observation);
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
