import { EmergencyStopInputSchema } from "./emergency-stop/schema.js";
import { IssueHumanCommandInputSchema } from "./issue-human-command/schema.js";
import { MarkReviewRequiredInputSchema } from "./mark-review-required/schema.js";
import { PauseMissionInputSchema } from "./pause-mission/schema.js";
import { ResumeMissionInputSchema } from "./resume-mission/schema.js";
import { StopMissionInputSchema } from "./stop-mission/schema.js";

const COMMANDER_COMMAND_CHILD_INPUT_SCHEMAS = {
  "issue-human-command": IssueHumanCommandInputSchema,
  "pause-mission": PauseMissionInputSchema,
  "resume-mission": ResumeMissionInputSchema,
  "stop-mission": StopMissionInputSchema,
  "emergency-stop": EmergencyStopInputSchema,
  "mark-review-required": MarkReviewRequiredInputSchema,
} as const;

export { COMMANDER_COMMAND_CHILD_INPUT_SCHEMAS };