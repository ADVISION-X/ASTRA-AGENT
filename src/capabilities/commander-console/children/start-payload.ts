type StartPayloadInput = {
  userRequirementText: string;
  selectedPlatforms: string[];
  requestedPlatformId: string | null;
  maxRounds: number | null;
  maxMinutes: number | null;
  operatorNote: string | null;
  initialPayload: Record<string, unknown> | null;
};

const passInitialPayloadField = (
  output: Record<string, unknown>,
  input: Record<string, unknown> | null,
  field: string,
): void => {
  if (input?.[field] != null) output[field] = input[field];
};

const buildGovernedInitialPayload = (input: StartPayloadInput): Record<string, unknown> => {
  const payload = input.initialPayload;
  const output: Record<string, unknown> = {
    requestedBy: typeof payload?.["requestedBy"] === "string" ? payload["requestedBy"] : "commander-console",
    operatorNote: payload?.["operatorNote"] ?? input.operatorNote ?? null,
  };
  [
    "userRequirementRef",
    "missionMode",
    "runtimeMode",
    "productVideoPageUrl",
    "primaryPlatformId",
    "targetUrl",
    "targetTitle",
    "targetProfileRef",
    "sourceEvidenceRef",
    "sourceTargetRef",
    "promptInputRef",
    "commandInputRef",
  ].forEach((field) => passInitialPayloadField(output, payload, field));
  if (Array.isArray(payload?.["selectedPlatforms"])) output["selectedPlatforms"] = payload["selectedPlatforms"];
  return output;
};

export const buildStartMissionOrchestrationPayload = (input: StartPayloadInput): Record<string, unknown> => ({
  humanGoal: input.userRequirementText,
  requestedPlatform: input.requestedPlatformId ?? input.selectedPlatforms[0] ?? "",
  selectedPlatforms: input.selectedPlatforms,
  ...(input.maxRounds != null ? { maxRounds: input.maxRounds } : {}),
  ...(input.maxMinutes != null ? { maxMinutes: input.maxMinutes } : {}),
  initialPayload: buildGovernedInitialPayload(input),
});
