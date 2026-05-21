import type { RegisteredAtomicAbility } from "../../muscle-memory/catalog.js";

export const VIDEO_DOWNLOAD_CATALOG_ENTRIES: RegisteredAtomicAbility[] = [
  {
    actionCode: "DOWNLOAD_FACEBOOK_VIDEO_ONCE",
    type: "atomic",
    displayName: "Download Facebook Video Once",
    description: "Download one validated Facebook Reel or video MP4 from the current authorized page into a governed local media artifact.",
    abilityGroupId: "video-download",
    childCapabilityId: "download-facebook-video-once",
    inputSchemaRef: "video-download.download-facebook-video-once.input",
    outputSchemaRef: "video-download.download-facebook-video-once.output",
    allowedForAiActionPlan: false,
    allowedForUserRequirement: false,
    requiresGridSpecRef: false,
    requiresScreenshotRef: false,
    requiresGeometryProof: false,
    sensitiveOperation: false,
    inputContract: {
      requiredFields: ["sourcePageUrl", "missionId", "runId", "capabilityCallId"],
      optionalFields: ["preferredQuality", "maxBytes", "timeoutMs"],
      forbiddenFields: ["cookie", "session", "token", "password", "productDecision"],
    },
    successOutputRefs: ["videoArtifactRef", "videoDownloadProofRef"],
    failurePolicy: "review_required",
    forbiddenResponsibilities: [
      "judge product value",
      "read browser storage",
      "bypass login or DRM",
      "use third-party downloader services",
    ],
  },
];
