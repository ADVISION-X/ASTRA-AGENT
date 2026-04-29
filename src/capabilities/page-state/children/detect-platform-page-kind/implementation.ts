import { PAGE_STATE_ABILITY_GROUP_ID } from "../../contract.js";
import type { DetectPlatformPageKindChildCapability } from "./contract.js";
import { DetectPlatformPageKindChildInputSchema, DetectPlatformPageKindChildOutputSchema } from "./schema.js";

export function createDetectPlatformPageKindCapability(): DetectPlatformPageKindChildCapability {
  return {
    abilityGroupId: PAGE_STATE_ABILITY_GROUP_ID,
    childCapabilityId: "detect-platform-page-kind",
    async execute(input) {
      const request = DetectPlatformPageKindChildInputSchema.parse(input);
      const parsed = new URL(request.snapshot.currentUrl);
      const pathname = parsed.pathname.toLowerCase();
      const output = request.snapshot.currentUrl.includes("localhost") || request.snapshot.currentUrl.includes("127.0.0.1")
        ? {
            childCapabilityId: "detect-platform-page-kind" as const,
            pageStateType: "local_workbench" as const,
            stateSummary: "Current page resolves to the local workbench profile.",
            confidence: 0.98,
            reviewRequiredReason: null,
            dataQualityFlags: [],
            matchedObservationIds: [],
            supportingEvidenceRefs: [...request.sourceEvidenceRefs],
            supportingReasons: ["snapshot.currentUrl host is local workbench"],
          }
        : pathname.includes("/video/")
          ? {
              childCapabilityId: "detect-platform-page-kind" as const,
              pageStateType: "platform_video_page" as const,
              stateSummary: "URL path indicates a platform video page.",
              confidence: 0.9,
              reviewRequiredReason: null,
              dataQualityFlags: [],
              matchedObservationIds: [],
              supportingEvidenceRefs: [...request.sourceEvidenceRefs],
              supportingReasons: ["URL pathname contains /video/"],
            }
          : pathname === "/" || pathname === "/foryou" || pathname === "/following" || pathname.startsWith("/@")
            ? {
                childCapabilityId: "detect-platform-page-kind" as const,
                pageStateType: "platform_feed" as const,
                stateSummary: "URL path indicates a platform feed page.",
                confidence: 0.88,
                reviewRequiredReason: null,
                dataQualityFlags: [],
                matchedObservationIds: [],
                supportingEvidenceRefs: [...request.sourceEvidenceRefs],
                supportingReasons: ["URL pathname matches feed profile"],
              }
            : {
                childCapabilityId: "detect-platform-page-kind" as const,
                pageStateType: "platform_unknown" as const,
                stateSummary: "Platform page kind is unknown for the current URL.",
                confidence: 0.52,
                reviewRequiredReason: "Review required because the platform page kind could not be resolved.",
                dataQualityFlags: ["insufficient_signal"],
                matchedObservationIds: [],
                supportingEvidenceRefs: [...request.sourceEvidenceRefs],
                supportingReasons: ["URL pathname did not match a governed feed or video profile"],
              };

      return DetectPlatformPageKindChildOutputSchema.parse(output);
    },
  };
}