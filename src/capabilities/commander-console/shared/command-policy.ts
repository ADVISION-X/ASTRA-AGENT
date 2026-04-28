export const COMMANDER_COMMAND_TYPES = [
  "start-mission",
  "pause-mission",
  "resume-mission",
  "stop-mission",
  "emergency-stop",
  "approve-candidate",
  "reject-candidate",
  "mark-review-required",
] as const;

export type CommanderCommandType = typeof COMMANDER_COMMAND_TYPES[number];

export function isMissionCommandType(commandType: CommanderCommandType): boolean {
  return commandType === "start-mission"
    || commandType === "pause-mission"
    || commandType === "resume-mission"
    || commandType === "stop-mission"
    || commandType === "emergency-stop";
}

export function isReviewCommandType(commandType: CommanderCommandType): boolean {
  return commandType === "approve-candidate"
    || commandType === "reject-candidate"
    || commandType === "mark-review-required";
}