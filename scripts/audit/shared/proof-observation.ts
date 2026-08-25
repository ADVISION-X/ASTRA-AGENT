export type QualityProofObservation = Readonly<{
  lawId: string;
  evidenceMode: string;
  locator: string;
  observedValue: string;
  receipt?: string;
  proofRunId: string;
  candidate: string;
  proofKind: "exam" | "dynamic";
}>;

type QualityProofObservationInput = Omit<QualityProofObservation, "proofRunId" | "candidate" | "proofKind">;
export type QualityProofRequest = Readonly<{
  lawId: string;
  evidenceMode: string;
  proofRunId: string;
  candidate: string;
  proofKind: "exam" | "dynamic";
}>;
type ProofContext = Pick<QualityProofObservation, "proofRunId" | "candidate" | "proofKind">;

export const proofObservationPrefix = "QUALITY_PROOF_OBSERVATION ";
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const candidateValid = (value: unknown): value is string =>
  typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(value);
const receiptValid = (dynamic: boolean, receipt: unknown): boolean =>
  dynamic ? digest(receipt) : receipt === undefined;
const contextForEmission = (): ProofContext => ({
  proofRunId: process.env.GOVERNANCE_PROOF_RUN_ID?.trim() ?? "",
  candidate: process.env.GOVERNANCE_PROOF_CANDIDATE?.trim() ?? "",
  proofKind: process.env.GOVERNANCE_PROOF_KIND?.trim() as ProofContext["proofKind"],
});

const observationValid = (
  observation: Partial<QualityProofObservation>, context: ProofContext, dynamic: boolean,
): boolean => observation.lawId?.startsWith("LAW-") === true
  && /^(exam|dynamic)\./u.test(observation.evidenceMode ?? "")
  && Boolean(observation.locator?.trim()) && Boolean(observation.observedValue?.trim())
  && digest(context.proofRunId) && candidateValid(context.candidate)
  && context.proofKind === (dynamic ? "dynamic" : "exam")
  && receiptValid(dynamic, observation.receipt);

export const emitQualityProofObservation = (observation: QualityProofObservationInput): void => {
  const context = contextForEmission();
  if (!context.proofRunId && !context.candidate && context.proofKind === undefined) return;
  const dynamic = observation.evidenceMode.startsWith("dynamic.");
  if (!observationValid(observation, context, dynamic)) throw new Error("QUALITY_PROOF_OBSERVATION_INVALID");
  process.stdout.write(`${proofObservationPrefix}${JSON.stringify({ ...observation, ...context })}\n`);
};

const exactObservationKeys = (parsed: Partial<QualityProofObservation>, dynamic: boolean): boolean => {
  const expected = dynamic
    ? "candidate,evidenceMode,lawId,locator,observedValue,proofKind,proofRunId,receipt"
    : "candidate,evidenceMode,lawId,locator,observedValue,proofKind,proofRunId";
  return Object.keys(parsed).sort().join(",") === expected;
};

const parseObservation = (line: string): QualityProofObservation => {
  const parsed = JSON.parse(line.slice(proofObservationPrefix.length)) as Partial<QualityProofObservation>;
  const dynamic = parsed.evidenceMode?.startsWith("dynamic.") ?? false;
  const context = { proofRunId: parsed.proofRunId, candidate: parsed.candidate, proofKind: parsed.proofKind } as ProofContext;
  if (!exactObservationKeys(parsed, dynamic) || !observationValid(parsed, context, dynamic)) {
    throw new Error("QUALITY_PROOF_OBSERVATION_INVALID");
  }
  return parsed as QualityProofObservation;
};

export const parseQualityProofObservations = (stdout: string): QualityProofObservation[] =>
  stdout.split("\n").filter((line) => line.startsWith(proofObservationPrefix)).map(parseObservation);
