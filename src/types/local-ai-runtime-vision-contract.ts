import type { LocalAiTaskRequest } from "./local-ai.js";
import type { VideoFrameSamplePointLabel } from "./multi-frame-evidence.js";
import { VisionProductPresencePayloadSchema } from "./vision-product-presence.js";

export type LocalAiVisionTaskRequest = LocalAiTaskRequest;
export type LocalAiVisionFrameSamplePointLabel = VideoFrameSamplePointLabel;
export const LocalAiVisionProductPresencePayloadSchema = VisionProductPresencePayloadSchema;