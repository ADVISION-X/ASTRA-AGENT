// Runtime Log Spine — Public API
// Core runtime contract only. Acceptance-specific contracts live in dedicated files.

export { RuntimeLogEventType } from "./event-types.js";
export type { TraceContext } from "./trace.js";
export { createRuntimeLogger, setDefaultRuntimeLogger } from "./logger.js";
export type { RuntimeLogger } from "./logger.js";
export { RuntimeFailureClass } from "./failure-classes.js";
export {
	createMissionTrace,
	withRoundTrace,
} from "./trace-context.js";
export type { RuntimeTraceContext } from "./trace-context.js";
export { createStageLogger } from "./stage-logger.js";
