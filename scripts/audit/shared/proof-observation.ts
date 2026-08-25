export type QualityProofObservation = Readonly<{
  lawId: string;
  evidenceMode: string;
  locator: string;
  observedValue: string;
  proofRunId: string;
  candidate: string;
  proofKind: "exam" | "dynamic";
  routeReceipt: string;
}>;

export type QualityProofBinding = Readonly<{
  lawId: string;
  evidenceMode: string;
  proofRunId: string;
  candidate: string;
  proofKind: "exam" | "dynamic";
  routeReceipt: string;
}>;

export const proofObservationPrefix = "QUALITY_PROOF_OBSERVATION ";

const routeKey = (lawId: string, evidenceMode: string): string => `${lawId}\0${evidenceMode}`;
const validDigest = (value: string): boolean => /^[a-f0-9]{64}$/u.test(value);

const bindingsFromEnvironment = (): QualityProofBinding[] => {
  const source = process.env.GOVERNANCE_PROOF_BINDINGS?.trim();
  if (!source) return [];
  const parsed = JSON.parse(source) as QualityProofBinding[];
  if (!Array.isArray(parsed) || parsed.some((binding) => !binding || typeof binding !== "object"
    || !binding.lawId.startsWith("LAW-") || !/^(exam|dynamic)\./u.test(binding.evidenceMode)
    || !validDigest(binding.proofRunId) || !validDigest(binding.candidate)
    || !validDigest(binding.routeReceipt) || !["exam", "dynamic"].includes(binding.proofKind))) {
    throw new Error("QUALITY_PROOF_BINDING_INVALID");
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
  const bindings = bindingsFromEnvironment();
  if (!bindings.length) return;
  const binding = bindings.find((candidate) => routeKey(candidate.lawId, candidate.evidenceMode)
    === routeKey(observation.lawId, observation.evidenceMode));
  if (!binding) return;
  const observedValue = binding.proofKind === "dynamic"
    ? `run=${binding.proofRunId};candidate=${binding.candidate};${observation.observedValue}`
    : observation.observedValue;
  process.stdout.write(`${proofObservationPrefix}${JSON.stringify({ ...observation, observedValue, ...binding })}\n`);
};

export const parseQualityProofObservations = (stdout: string): QualityProofObservation[] =>
  stdout.split("\n").filter((line) => line.startsWith(proofObservationPrefix)).map((line) => {
    const parsed = JSON.parse(line.slice(proofObservationPrefix.length)) as Partial<QualityProofObservation>;
    if (typeof parsed.lawId !== "string" || typeof parsed.evidenceMode !== "string"
      || typeof parsed.locator !== "string" || typeof parsed.observedValue !== "string"
      || typeof parsed.proofRunId !== "string" || typeof parsed.candidate !== "string"
      || (parsed.proofKind !== "exam" && parsed.proofKind !== "dynamic")
      || typeof parsed.routeReceipt !== "string" || !validDigest(parsed.proofRunId)
      || !validDigest(parsed.candidate) || !validDigest(parsed.routeReceipt)
      || !parsed.locator.trim() || !parsed.observedValue.trim()) {
      throw new Error("QUALITY_PROOF_OBSERVATION_INVALID");
    }
    return parsed as QualityProofObservation;
  });
