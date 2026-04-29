import { COMMANDER_COMMAND_CHILD_IDS, COMMANDER_READ_CHILD_IDS } from "../schema.js";

export const COMMAND_CHILD_TO_TYPE = {
  "pause-mission": "pause-mission",
  "resume-mission": "resume-mission",
  "stop-mission": "stop-mission",
  "emergency-stop": "emergency-stop",
  "approve-candidate": "approve-candidate",
  "reject-candidate": "reject-candidate",
  "mark-review-required": "mark-review-required",
} as const;

export const COMMAND_TYPE_TO_PRIORITY = {
  "start-mission": "normal",
  "pause-mission": "normal",
  "resume-mission": "normal",
  "stop-mission": "normal",
  "emergency-stop": "emergency",
  "approve-candidate": "normal",
  "reject-candidate": "normal",
  "mark-review-required": "normal",
} as const;

export function isCommanderCommandChild(childCapabilityId: string): boolean {
  return (COMMANDER_COMMAND_CHILD_IDS as readonly string[]).includes(childCapabilityId);
}

export function isCommanderReadChild(childCapabilityId: string): boolean {
  return (COMMANDER_READ_CHILD_IDS as readonly string[]).includes(childCapabilityId);
}

export function isEmergencyStopChild(childCapabilityId: string): boolean {
  return childCapabilityId === "emergency-stop";
}