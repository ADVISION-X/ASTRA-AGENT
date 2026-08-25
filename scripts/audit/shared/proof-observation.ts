export type QualityProofObservation = Readonly<{
  lawId: string;
  evidenceMode: string;
  locator: string;
  observedValue: string;
}>;

export const proofObservationPrefix = "QUALITY_PROOF_OBSERVATION ";

const routeKey = (lawId: string, evidenceMode: string): string => `${lawId}\0${evidenceMode}`;

export const emitQualityProofObservation = (observation: QualityProofObservation): void => {
  if (!observation.lawId.startsWith("LAW-")
    || !/^(exam|dynamic)\./u.test(observation.evidenceMode)
    || !observation.locator.trim()
    || !observation.observedValue.trim()) {
    throw new Error("QUALITY_PROOF_OBSERVATION_INVALID");
  }
  const requested = process.env.GOVERNANCE_PROOF_ROUTES?.trim();
  if (requested) {
    const routes = JSON.parse(requested) as Array<{ lawId: string; evidenceMode: string }>;
    if (!routes.some((route) => routeKey(route.lawId, route.evidenceMode)
      === routeKey(observation.lawId, observation.evidenceMode))) return;
  }
  process.stdout.write(`${proofObservationPrefix}${JSON.stringify(observation)}\n`);
};

export const parseQualityProofObservations = (stdout: string): QualityProofObservation[] =>
  stdout.split("\n").filter((line) => line.startsWith(proofObservationPrefix)).map((line) => {
    const parsed = JSON.parse(line.slice(proofObservationPrefix.length)) as Partial<QualityProofObservation>;
    if (typeof parsed.lawId !== "string" || typeof parsed.evidenceMode !== "string"
      || typeof parsed.locator !== "string" || typeof parsed.observedValue !== "string"
      || !parsed.locator.trim() || !parsed.observedValue.trim()) {
      throw new Error("QUALITY_PROOF_OBSERVATION_INVALID");
    }
    return parsed as QualityProofObservation;
  });
