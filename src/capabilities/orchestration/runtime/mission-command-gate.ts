import type { MissionCommand, MissionControlCommand } from "../contract.js";
import {
  MissionCommandSchema,
  MissionControlCommandSchema,
} from "../schema.js";

export function parseMissionCommand(input: unknown): MissionCommand {
  return MissionCommandSchema.parse(input);
}

export function parseMissionControlCommand(input: unknown): MissionControlCommand {
  return MissionControlCommandSchema.parse(input);
}
