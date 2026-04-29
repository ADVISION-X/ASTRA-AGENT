import type { MissionCommand, MissionControlCommand, MissionReviewDecisionInput } from "../contract.js";
import {
  MissionCommandSchema,
  MissionControlCommandSchema,
  MissionReviewDecisionInputSchema,
} from "../schema.js";

export function parseMissionCommand(input: unknown): MissionCommand {
  return MissionCommandSchema.parse(input);
}

export function parseMissionControlCommand(input: unknown): MissionControlCommand {
  return MissionControlCommandSchema.parse(input);
}

export function parseMissionReviewDecision(input: unknown): MissionReviewDecisionInput {
  return MissionReviewDecisionInputSchema.parse(input);
}