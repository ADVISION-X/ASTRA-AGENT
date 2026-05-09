import { runArtifactStorageGate } from "./artifact-storage-gate.js";
import { runCaptureRunner } from "./capture-runner.js";
import { executeScreenshotExecutionSuccess } from "./screenshot-execution-success.js";
import { runImageProcessingRunner } from "./image-processing-runner.js";
import { runRegionProofGate } from "./region-proof-gate.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";
import { burnEphemeralScreenshotFile } from "./screenshot-ephemeral-file-cleanup.js";

export const screenshotExecutionRuntimeSupport = {
	runArtifactStorageGate,
	runCaptureRunner,
	executeScreenshotExecutionSuccess,
	runImageProcessingRunner,
	runRegionProofGate,
	createScreenshotFailure,
	burnEphemeralScreenshotFile,
};