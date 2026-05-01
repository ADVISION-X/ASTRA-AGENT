import { APPROVE_CANDIDATE_CHILD } from "./approve-candidate/implementation.js";
import { EMERGENCY_STOP_CHILD } from "./emergency-stop/implementation.js";
import { ISSUE_HUMAN_COMMAND_CHILD } from "./issue-human-command/implementation.js";
import { MARK_REVIEW_REQUIRED_CHILD } from "./mark-review-required/implementation.js";
import { PAUSE_MISSION_CHILD } from "./pause-mission/implementation.js";
import { REJECT_CANDIDATE_CHILD } from "./reject-candidate/implementation.js";
import { RESUME_MISSION_CHILD } from "./resume-mission/implementation.js";
import { STOP_MISSION_CHILD } from "./stop-mission/implementation.js";

export const COMMANDER_COMMAND_CHILDREN = [
  ISSUE_HUMAN_COMMAND_CHILD,
  PAUSE_MISSION_CHILD,
  RESUME_MISSION_CHILD,
  STOP_MISSION_CHILD,
  EMERGENCY_STOP_CHILD,
  APPROVE_CANDIDATE_CHILD,
  REJECT_CANDIDATE_CHILD,
  MARK_REVIEW_REQUIRED_CHILD,
] as const;