import {
  StructuredActionLogSchema as ExternalStructuredActionLogSchema,
  StructuredRuntimeEventSchema as ExternalStructuredRuntimeEventSchema,
  type StructuredActionLog as ExternalStructuredActionLog,
  type StructuredRuntimeEvent as ExternalStructuredRuntimeEvent,
} from "../../../types/structured-log.js";

const StructuredActionLogSchema = ExternalStructuredActionLogSchema;
const StructuredRuntimeEventSchema = ExternalStructuredRuntimeEventSchema;

type StructuredActionLog = ExternalStructuredActionLog;
type StructuredRuntimeEvent = ExternalStructuredRuntimeEvent;

export {
  StructuredActionLogSchema,
  StructuredRuntimeEventSchema,
};

export type {
  StructuredActionLog,
  StructuredRuntimeEvent,
};