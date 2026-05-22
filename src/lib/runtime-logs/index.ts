// Runtime Log Spine — Public API
// Import only from here. Never import sub-files directly from external modules.

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
export { createRuntimeDebugBundle } from "./debug-bundle.js";
export {
	findRuntimeDebugBundleRound,
} from "./debug-bundle-index.js";
export {
	redactUrlForLog,
	redactRuntimeLogRecord,
} from "./redaction.js";
