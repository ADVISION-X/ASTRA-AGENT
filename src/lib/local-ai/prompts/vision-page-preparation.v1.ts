import {
  STARTUP_PREPARATION_BLOCKED_ROUTE_LABEL,
  STARTUP_PREPARATION_READY_ROUTE_LABEL,
} from "../../../map-plugins/shared/startup-preparation.constants.js";

export const VISION_PAGE_PREPARATION_PROMPT_CONTRACT = {
  promptId: "vision.pagePreparation.v1",
  taskType: "vision.pagePreparation",
  promptVersion: "v1",
  schemaVersion: "vision.pagePreparation.schema.v1",
  modelRole: "vision",
  inputScope: [
    "inputMode",
    "multiFrameEvidenceSetId",
    "contactSheetEvidenceId",
    "frameEvidenceIds",
    "screenshotEvidenceId",
    "samplingStrategy",
    "sampledFrameCount",
    "validFrameCount",
    "sourceUrl",
    "no external page assumptions",
  ],
  forbiddenOutputs: [
    "human review request",
    "third branch decision",
    "product presence judgment",
    "platform action instruction",
    "fabricated hidden page state",
  ],
  requiredOutputSchema: {
    taskType: "vision.pagePreparation",
    promptId: "vision.pagePreparation.v1",
    promptVersion: "v1",
    schemaVersion: "vision.pagePreparation.schema.v1",
    decision: "yes | no",
    routeLabel:
      `yes => ${STARTUP_PREPARATION_READY_ROUTE_LABEL} | no => ${STARTUP_PREPARATION_BLOCKED_ROUTE_LABEL}`,
    nonExecutableSummary:
      "short human-readable summary of why the selected routeLabel applies; never an action instruction",
    confidence: "0..1",
    reason: "string",
    evidenceObservations: "string[]",
    readinessSignals: "string[]",
    blockingSignals: "string[]",
    mustReview: "false",
  },
  prompt: [
    "You are GrassEye's startup page-preparation vision judge for governed short-video discovery.",
    "Your job is binary only: decide whether the current governed page evidence is ready for downstream seeding-video product judgment.",
    "Return exactly one decision: yes or no.",
    `For yes use routeLabel ${STARTUP_PREPARATION_READY_ROUTE_LABEL}. For no use routeLabel ${STARTUP_PREPARATION_BLOCKED_ROUTE_LABEL}.`,
    "Return nonExecutableSummary as a short logging-only explanation. It must never instruct Orchestration to click, scroll, type, open, or infer any action.",
    "Use only the visible page evidence from the provided screenshot-derived AI input. Do not use hidden DOM state, cookies, or outside assumptions.",
    "Choose yes only when the current page visibly appears ready for downstream product judgment on a short-video/feed surface.",
    "Choose no when evidence suggests login wall, captcha, safety wall, wrong page, loading/blocked surface, missing video/feed context, or insufficient evidence to proceed safely.",
    "If evidence is ambiguous, choose no and fail closed.",
    "Do not judge whether the current video is a product video. That is a different task.",
    "Return structured JSON only and make the JSON internally consistent.",
  ].join(" "),
  purpose: "Determine whether startup page preparation is visually ready for downstream seeding-video judgment with a binary fail-closed route.",
} as const;

export type VisionPagePreparationPromptContract = typeof VISION_PAGE_PREPARATION_PROMPT_CONTRACT;