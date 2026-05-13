/**
 * Commander Console Registry
 *
 * Maps childCapabilityId → execute function.
 * Exactly 7 children. Read-model children are not registered here.
 */

import type { CommanderChildContext } from "./children.js";
import {
  executeIssueHumanCommand,
  executePauseMission,
  executeResumeMission,
  executeStopMission,
  executeEmergencyStop,
  executeMarkReviewRequired,
  executeShowMissionStatus,
} from "./children.js";
import type { CommanderChildCapabilityId, CommanderConsoleResult } from "./schema.js";
import { COMMANDER_CHILD_CAPABILITY_IDS } from "./schema.js";

type ChildExecuteFn = (
  rawInput: Record<string, unknown>,
  operatorRef: string,
  context: CommanderChildContext,
) => Promise<CommanderConsoleResult>;

type CommanderRegistry = Map<CommanderChildCapabilityId, ChildExecuteFn>;

export const createCommanderRegistry = (): CommanderRegistry =>
  new Map<CommanderChildCapabilityId, ChildExecuteFn>([
    ["issue-human-command", executeIssueHumanCommand],
    ["pause-mission", executePauseMission],
    ["resume-mission", executeResumeMission],
    ["stop-mission", executeStopMission],
    ["emergency-stop", executeEmergencyStop],
    ["mark-review-required", executeMarkReviewRequired],
    ["show-mission-status", executeShowMissionStatus],
  ]);

export const listCommanderChildren = (): readonly CommanderChildCapabilityId[] =>
  COMMANDER_CHILD_CAPABILITY_IDS;
