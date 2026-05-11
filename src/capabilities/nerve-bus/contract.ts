/**
 * Nerve Bus — public contract types.
 * Pure transport interface. No AI logic. No browser logic. No Forensics.
 */

import type {
  AbilityCommandEnvelope,
  AbilityResultEnvelope,
  AiRequestEnvelope,
  AiResponseEnvelope,
  HumanCommandEnvelope,
  HumanCommandResultEnvelope,
  NerveBusPayloadDocument,
} from "./schema.js";

export type {
  AbilityCommandEnvelope,
  AbilityResultEnvelope,
  AiRequestEnvelope,
  AiResponseEnvelope,
  HumanCommandEnvelope,
  HumanCommandResultEnvelope,
  NerveBusPayloadDocument,
};

// ─── Handler Port ─────────────────────────────────────────────────────────

export type NerveBusHandledResult<TEnvelope> = {
  envelope: TEnvelope;
  outputPayload: NerveBusPayloadDocument | null;
};

export interface NerveBusHandlerPort {
  dispatchAbilityCommand(input: {
    envelope: AbilityCommandEnvelope;
    inputPayload: NerveBusPayloadDocument;
    signal: AbortSignal;
  }): Promise<NerveBusHandledResult<AbilityResultEnvelope> | null>;

  requestAi(input: {
    envelope: AiRequestEnvelope;
    inputPayload: NerveBusPayloadDocument;
    signal: AbortSignal;
  }): Promise<NerveBusHandledResult<AiResponseEnvelope> | null>;

  dispatchHumanCommand(input: {
    envelope: HumanCommandEnvelope;
    inputPayload: NerveBusPayloadDocument;
    signal: AbortSignal;
  }): Promise<NerveBusHandledResult<HumanCommandResultEnvelope> | null>;
}

// ─── Dispatch Input / Output Types ───────────────────────────────────────

export type AbilityCommandDispatchInput = {
  abilityGroupId: string;
  childCapabilityId: string;
  missionId: string;
  runId: string;
  sessionId: string | null;
  roundId: string | null;
  inputOverrides: Record<string, unknown>;
};

export type AbilityDispatchResult = {
  status: "success" | "failed" | "review_required";
  failureReason: string | null;
};

export type AiRequestDispatchInput = {
  missionId: string;
  runId: string;
  sessionId: string | null;
  roundId: string | null;
  requestType: string;
  inputPayload: NerveBusPayloadDocument;
};

export type AiRequestDispatchResult = {
  status: "success" | "failed";
  failureReason: string | null;
  outputPayload: NerveBusPayloadDocument | null;
};

export type HumanCommandDispatchInput = {
  missionId: string;
  runId: string;
  sessionId: string | null;
  roundId: string | null;
  commandType: string;
  inputPayload: NerveBusPayloadDocument;
};

export type HumanCommandDispatchResult = {
  status: "success" | "failed";
  failureReason: string | null;
  outputPayload: NerveBusPayloadDocument | null;
};

// ─── Ability Group Interface ──────────────────────────────────────────────

export interface NerveBusAbilityGroup {
  dispatchAbilityCommand(input: AbilityCommandDispatchInput): Promise<AbilityDispatchResult>;
  requestAi(input: AiRequestDispatchInput): Promise<AiRequestDispatchResult>;
  dispatchHumanCommand(input: HumanCommandDispatchInput): Promise<HumanCommandDispatchResult>;
}

// ─── Factory Input ────────────────────────────────────────────────────────

export type CreateNerveBusAbilityGroupInput = {
  handlerPort: NerveBusHandlerPort;
};
