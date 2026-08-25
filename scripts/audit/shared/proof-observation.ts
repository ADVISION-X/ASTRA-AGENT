export type QualityProofObservation = Readonly<{
  lawId: string;
  evidenceMode: string;
  locator: string;
  observedValue: string;
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
  observation: Pick<QualityProofObservation, "lawId" | "evidenceMode" | "locator" | "observedValue">,
): void => {
  if (!observation.lawId.startsWith("LAW-")
    || !/^(exam|dynamic)\./u.test(observation.evidenceMode)
    || !observation.locator.trim()
    || !observation.observedValue.trim()) {
    throw new Error("QUALITY_PROOF_OBSERVATION_INVALID");
  }
  process.stdout.write(`${proofObservationPrefix}${JSON.stringify(observation)}\n`);
};

export const parseQualityProofObservations = (stdout: string): QualityProofObservation[] =>
  stdout.split("\n").filter((line) => line.startsWith(proofObservationPrefix)).map((line) => {
    const parsed = JSON.parse(line.slice(proofObservationPrefix.length)) as Partial<QualityProofObservation>;
    if (Object.keys(parsed).sort().join(",") !== "evidenceMode,lawId,locator,observedValue"
      || typeof parsed.lawId !== "string" || typeof parsed.evidenceMode !== "string"
      || typeof parsed.locator !== "string" || typeof parsed.observedValue !== "string"
      || !parsed.locator.trim() || !parsed.observedValue.trim()) {
      throw new Error("QUALITY_PROOF_OBSERVATION_INVALID");
    }
    return parsed as QualityProofObservation;
  });
