export type QualityProofObservation = Readonly<{
  lawId: string;
  evidenceMode: string;
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

export const proofObservationPrefix = "QUALITY_PROOF_OBSERVATION ";

export const emitQualityProofObservation = (
  observation: QualityProofObservation,
): void => {
  const dynamic = observation.evidenceMode.startsWith("dynamic.");
  if (!observation.lawId.startsWith("LAW-")
    || !/^(exam|dynamic)\./u.test(observation.evidenceMode)
    || !observation.locator.trim()
    || !observation.observedValue.trim()
    || (dynamic ? !/^[a-f0-9]{64}$/u.test(observation.receipt ?? "") : observation.receipt !== undefined)) {
    throw new Error("QUALITY_PROOF_OBSERVATION_INVALID");
  }
  process.stdout.write(`${proofObservationPrefix}${JSON.stringify(observation)}\n`);
};

export const parseQualityProofObservations = (stdout: string): QualityProofObservation[] =>
  stdout.split("\n").filter((line) => line.startsWith(proofObservationPrefix)).map((line) => {
    const parsed = JSON.parse(line.slice(proofObservationPrefix.length)) as Partial<QualityProofObservation>;
    const dynamic = parsed.evidenceMode?.startsWith("dynamic.") ?? false;
    const expectedKeys = dynamic ? "evidenceMode,lawId,locator,observedValue,receipt" : "evidenceMode,lawId,locator,observedValue";
    if (Object.keys(parsed).sort().join(",") !== expectedKeys
      || typeof parsed.lawId !== "string" || typeof parsed.evidenceMode !== "string"
      || typeof parsed.locator !== "string" || typeof parsed.observedValue !== "string"
      || !parsed.locator.trim() || !parsed.observedValue.trim()
      || (dynamic ? typeof parsed.receipt !== "string" || !/^[a-f0-9]{64}$/u.test(parsed.receipt) : parsed.receipt !== undefined)) {
      throw new Error("QUALITY_PROOF_OBSERVATION_INVALID");
    }
    return parsed as QualityProofObservation;
  });
