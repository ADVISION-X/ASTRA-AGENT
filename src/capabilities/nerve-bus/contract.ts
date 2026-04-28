import type {
  AiRequestEnvelope,
  AiResponseEnvelope,
  AbilityTargetId,
  CommandEnvelope,
  HumanCommandEnvelope,
  HumanCommandResultEnvelope,
  ResultEnvelope,
} from "./shared/envelope.js";
import type { AbilityTransportResult, AiTransportResult, HumanCommandTransportResult } from "./shared/bus-result.js";

export const NERVE_BUS_ABILITY_GROUP_ID = "nerve-bus";

export type NerveBusAbilityGroupId = typeof NERVE_BUS_ABILITY_GROUP_ID;
export type NerveBusChannelId =
  | "commander-to-governed"
  | "governed-to-commander"
  | "orchestration-to-ability"
  | "ability-to-orchestration"
  | "orchestration-to-ai"
  | "ai-to-orchestration";

export type AbilityCommandHandler = (
  envelope: CommandEnvelope,
) => Promise<ResultEnvelope>;

export type AiRequestHandler = (
  envelope: AiRequestEnvelope,
) => Promise<AiResponseEnvelope>;

export type HumanCommandHandler = (
  envelope: HumanCommandEnvelope,
) => Promise<HumanCommandResultEnvelope>;

export type AbilityCommandHandlers = Partial<Record<AbilityTargetId, AbilityCommandHandler>>;

export interface NerveBusAbilityGroup {
  listChannelIds(): NerveBusChannelId[];
  dispatchHumanCommand(envelope: HumanCommandEnvelope): Promise<HumanCommandTransportResult>;
  dispatchAbilityCommand(envelope: CommandEnvelope): Promise<AbilityTransportResult>;
  requestAi(envelope: AiRequestEnvelope): Promise<AiTransportResult>;
}