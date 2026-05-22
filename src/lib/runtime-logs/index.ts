// Runtime Log Spine — Public API
// Import only from here. Never import sub-files directly from external modules.

export { RuntimeLogEventType } from "./event-types.js";
export type { TraceContext } from "./trace.js";
export { createRuntimeLogger, setDefaultRuntimeLogger } from "./logger.js";
export type { RuntimeLogger } from "./logger.js";
export { RuntimeFailureClass } from "./failure-classes.js";
export type { RuntimeRecoveryPolicy } from "./failure-classes.js";
export {
	createMissionTrace,
	withRoundTrace,
	createChildTrace,
} from "./trace-context.js";
export type { RuntimeTraceContext } from "./trace-context.js";
export { createRuntimeEvent } from "./event-factory.js";
export { createStageLogger } from "./stage-logger.js";
export type {
	RuntimeStageLogger,
	RuntimeStageHandle,
} from "./stage-logger.js";
export {
	createRuntimeDebugBundle,
	appendRuntimeEventToDebugBundle,
} from "./debug-bundle.js";
export {
	loadRuntimeDebugBundleIndex,
	findRuntimeDebugBundleRound,
} from "./debug-bundle-index.js";
export {
	redactUrlForLog,
	redactRuntimeLogEvent,
	redactRuntimeLogPayload,
	redactRuntimeLogRecord,
} from "./redaction.js";
