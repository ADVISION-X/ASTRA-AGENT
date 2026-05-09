import {
	buildScreenshotArtifactStorageFailure,
	buildScreenshotRegionValidationFailure,
} from "./screenshot-execution-failure-builders.js";
import {
	resolveScreenshotCaptureAndImagePhaseFailure,
	resolveScreenshotCaptureRun,
	resolveScreenshotImageRun,
	resolveScreenshotOutputMetadata,
} from "./screenshot-execution-phase-helpers.js";

export const screenshotExecutionPhaseSupport = {
	buildScreenshotArtifactStorageFailure,
	buildScreenshotRegionValidationFailure,
	resolveScreenshotCaptureAndImagePhaseFailure,
	resolveScreenshotCaptureRun,
	resolveScreenshotImageRun,
	resolveScreenshotOutputMetadata,
};