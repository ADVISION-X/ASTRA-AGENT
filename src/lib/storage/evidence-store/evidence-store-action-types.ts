import {
  ActionLogSchema as ExternalActionLogSchema,
  type ActionLog as ExternalActionLog,
} from "../../../types/platform-action.js";

const ActionLogSchema = ExternalActionLogSchema;
type ActionLog = ExternalActionLog;

export {
  ActionLogSchema,
};

export type {
  ActionLog,
};