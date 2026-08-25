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

export const proofObservationPrefix = "QUALITY_PROOF_OBSERVATION ";

export const emitQualityProofObservation = (
  observation: QualityProofObservationInput,
): void => {
  const dynamic = observation.evidenceMode.startsWith("dynamic.");
  const proofRunId = process.env.GOVERNANCE_PROOF_RUN_ID?.trim() ?? "";
  const candidate = process.env.GOVERNANCE_PROOF_CANDIDATE?.trim() ?? "";
  const proofKind = process.env.GOVERNANCE_PROOF_KIND?.trim();
  if (!proofRunId && !candidate && proofKind === undefined) return;
  if (!observation.lawId.startsWith("LAW-")
    || !/^(exam|dynamic)\./u.test(observation.evidenceMode)
    || !observation.locator.trim()
    || !observation.observedValue.trim()
    || !/^[a-f0-9]{64}$/u.test(proofRunId)
    || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(candidate)
    || proofKind !== (dynamic ? "dynamic" : "exam")
    || (dynamic ? !/^[a-f0-9]{64}$/u.test(observation.receipt ?? "") : observation.receipt !== undefined)) {
    throw new Error("QUALITY_PROOF_OBSERVATION_INVALID");
  }
  process.stdout.write(`${proofObservationPrefix}${JSON.stringify({
    ...observation, proofRunId, candidate, proofKind,
  })}\n`);
};

export const parseQualityProofObservations = (stdout: string): QualityProofObservation[] =>
  stdout.split("\n").filter((line) => line.startsWith(proofObservationPrefix)).map((line) => {
    const parsed = JSON.parse(line.slice(proofObservationPrefix.length)) as Partial<QualityProofObservation>;
    const dynamic = parsed.evidenceMode?.startsWith("dynamic.") ?? false;
    const expectedKeys = dynamic
      ? "candidate,evidenceMode,lawId,locator,observedValue,proofKind,proofRunId,receipt"
      : "candidate,evidenceMode,lawId,locator,observedValue,proofKind,proofRunId";
    if (Object.keys(parsed).sort().join(",") !== expectedKeys
      || typeof parsed.lawId !== "string" || typeof parsed.evidenceMode !== "string"
      || typeof parsed.locator !== "string" || typeof parsed.observedValue !== "string"
      || typeof parsed.proofRunId !== "string" || !/^[a-f0-9]{64}$/u.test(parsed.proofRunId)
      || typeof parsed.candidate !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(parsed.candidate)
      || parsed.proofKind !== (dynamic ? "dynamic" : "exam")
      || !parsed.locator.trim() || !parsed.observedValue.trim()
      || (dynamic ? typeof parsed.receipt !== "string" || !/^[a-f0-9]{64}$/u.test(parsed.receipt) : parsed.receipt !== undefined)) {
      throw new Error("QUALITY_PROOF_OBSERVATION_INVALID");
    }
    return parsed as QualityProofObservation;
  });
