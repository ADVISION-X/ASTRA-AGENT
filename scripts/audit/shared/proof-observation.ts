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
  && clauses.length > 1
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

const directRuntimeReceiptValid = (
  file: string, observation: QualityProofObservationInput, context: EmissionContext,
): boolean => {
  if (context.script !== "acceptance:agent-production-runtime:real-proof") return true;
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>; }
  catch { return false; }
  const kind = observation.evidenceMode.slice("dynamic.".length);
  const modeObjects = ["browser", "service", "database", "storage", "provider", "authorization", "recovery"];
  const value = parsed.observation;
  return parsed.schema_version === "direct-production-runtime-observation.v1"
    && parsed.proof_run_id === context.proofRunId && parsed.candidate === context.candidate
    && parsed.lawId === observation.lawId && parsed.evidenceMode === observation.evidenceMode
    && parsed.observation_kind === kind && value !== null && typeof value === "object" && !Array.isArray(value)
    && !modeObjects.some((field) => Object.hasOwn(value as object, field));
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
    && directRuntimeReceiptValid(file, observation, context);
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
