export type GovernedAbilityGroupId =
  | "commander-console"
  | "orchestration"
  | "nerve-bus"
  | "open"
  | "screenshot"
  | "local-ai-decision"
  | "visual-target"
  | "mouse-click"
  | "mouse-scroll"
  | "forensics-persistence";

export type AbilityTargetId = Exclude<GovernedAbilityGroupId, "orchestration" | "nerve-bus">;
export type HumanCommandTargetId = Extract<GovernedAbilityGroupId, "orchestration" | "forensics-persistence">;
export type EnvelopePayload = Record<string, unknown>;
export type EnvelopeStatus = "success" | "failed" | "review_required";

export type CommandEnvelope = {
  envelopeId: string;
  commandId: string;
  missionId: string;
  mapId: string;
  stepId: string;
  from: "orchestration";
  to: AbilityTargetId;
  commandName: string;
  payloadRef: string[];
  payload: EnvelopePayload;
  createdAt: string;
};

export type ResultEnvelope = {
  envelopeId: string;
  resultId: string;
  missionId: string;
  mapId: string;
  stepId: string;
  from: AbilityTargetId;
  to: "orchestration";
  abilityGroupId: AbilityTargetId;
  status: EnvelopeStatus;
  payloadRef: string[];
  payload: EnvelopePayload;
  failureReason: string | null;
  createdAt: string;
};

export type AiRequestEnvelope = {
  envelopeId: string;
  requestId: string;
  missionId: string;
  mapId: string;
  stepId: string;
  from: "orchestration";
  to: "local-ai-decision";
  taskType: string;
  promptRef: string;
  payloadRef: string[];
  payload: EnvelopePayload;
  createdAt: string;
};

export type AiResponseEnvelope = {
  envelopeId: string;
  responseId: string;
  missionId: string;
  mapId: string;
  stepId: string;
  from: "local-ai-decision";
  to: "orchestration";
  status: EnvelopeStatus;
  decision: string;
  confidence: number | null;
  payloadRef: string[];
  payload: EnvelopePayload;
  failureReason: string | null;
  createdAt: string;
};

export type HumanCommandEnvelope = {
  envelopeId: string;
  commandId: string;
  missionId: string;
  mapId: string;
  stepId: string;
  from: "commander-console";
  to: HumanCommandTargetId;
  commandType: string;
  payloadRef: string[];
  payload: EnvelopePayload;
  createdAt: string;
};

export type HumanCommandResultEnvelope = {
  envelopeId: string;
  resultId: string;
  missionId: string;
  mapId: string;
  stepId: string;
  from: HumanCommandTargetId;
  to: "commander-console";
  status: EnvelopeStatus;
  payloadRef: string[];
  payload: EnvelopePayload;
  failureReason: string | null;
  createdAt: string;
};