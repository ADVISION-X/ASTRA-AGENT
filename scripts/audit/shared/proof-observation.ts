export type QualityProofObservation = Readonly<{
  lawId: string;
  evidenceMode: string;
  locator: string;
  observedValue: string;
  proofRunId: string;
  candidate: string;
  proofKind: "exam" | "dynamic";
}>;

export type QualityProofRequest = Readonly<{
  lawId: string;
  evidenceMode: string;
  proofRunId: string;
  candidate: string;
  proofKind: "exam" | "dynamic";
}>;

export const proofObservationPrefix = "QUALITY_PROOF_OBSERVATION ";

const routeKey = (lawId: string, evidenceMode: string): string => `${lawId}\0${evidenceMode}`;
const validDigest = (value: string): boolean => /^[a-f0-9]{64}$/u.test(value);
const validCandidate = (value: string): boolean => /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(value);

const requestsFromEnvironment = (): QualityProofRequest[] => {
  const source = process.env.GOVERNANCE_PROOF_REQUESTS?.trim();
  if (!source) return [];
  const parsed = JSON.parse(source) as QualityProofRequest[];
  if (!Array.isArray(parsed) || parsed.some((request) => !request || typeof request !== "object"
    || !request.lawId.startsWith("LAW-") || !/^(exam|dynamic)\./u.test(request.evidenceMode)
    || !validDigest(request.proofRunId) || !validCandidate(request.candidate)
    || !["exam", "dynamic"].includes(request.proofKind))) {
    throw new Error("QUALITY_PROOF_REQUEST_INVALID");
  }
  return parsed;
};

export const emitQualityProofObservation = (
  observation: Pick<QualityProofObservation, "lawId" | "evidenceMode" | "locator" | "observedValue">,
): void => {
  if (!observation.lawId.startsWith("LAW-")
    || !/^(exam|dynamic)\./u.test(observation.evidenceMode)
    || !observation.locator.trim()
    || !observation.observedValue.trim()) {
    throw new Error("QUALITY_PROOF_OBSERVATION_INVALID");
  }
  const request = requestsFromEnvironment().find((candidate) => routeKey(candidate.lawId, candidate.evidenceMode)
    === routeKey(observation.lawId, observation.evidenceMode));
  if (!request) return;
  process.stdout.write(`${proofObservationPrefix}${JSON.stringify({ ...observation, ...request })}\n`);
};

export const parseQualityProofObservations = (stdout: string): QualityProofObservation[] =>
  stdout.split("\n").filter((line) => line.startsWith(proofObservationPrefix)).map((line) => {
    const parsed = JSON.parse(line.slice(proofObservationPrefix.length)) as Partial<QualityProofObservation>;
    if (typeof parsed.lawId !== "string" || typeof parsed.evidenceMode !== "string"
      || typeof parsed.locator !== "string" || typeof parsed.observedValue !== "string"
      || typeof parsed.proofRunId !== "string" || typeof parsed.candidate !== "string"
      || (parsed.proofKind !== "exam" && parsed.proofKind !== "dynamic")
      || !validDigest(parsed.proofRunId) || !validCandidate(parsed.candidate)
      || !parsed.locator.trim() || !parsed.observedValue.trim()) {
      throw new Error("QUALITY_PROOF_OBSERVATION_INVALID");
    }
    return parsed as QualityProofObservation;
  });
