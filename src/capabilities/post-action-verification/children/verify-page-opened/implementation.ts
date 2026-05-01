import { POST_ACTION_VERIFICATION_ABILITY_GROUP_ID, type PostActionObservation } from "../../contract.js";
import { verifyNormalizedPostActionUrl } from "../../shared/post-action-url.js";
import type { PostActionVerificationChildCapability, PostActionVerificationRuntimeContext } from "../../runtime/post-action-verification-runtime-context.js";
import { VerifyPageOpenedOutputSchema } from "./schema.js";

function getObservationsByKind<K extends PostActionObservation["kind"]>(
  observations: PostActionObservation[],
  kind: K,
): Array<PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> }> {
  return observations.filter((observation): observation is PostActionObservation & { kind: K; payload: Extract<PostActionObservation["payload"], { kind: K }> } => observation.kind === kind && observation.payload.kind === kind);
}

function buildPageOpenedMissingObservationResult() {
  return VerifyPageOpenedOutputSchema.parse({
    observedOutcome: "page_state_missing",
    verificationDecision: "review_required",
    confidence: 0,
    failureReason: "missing_observation_support",
    reviewRequiredReason: "Page-open verification requires governed page-state evidence.",
    statusMessage: "Page-state evidence is missing for page-open verification.",
    dataQualityFlags: ["page_state_missing"],
    supportingEvidenceRefs: [],
    supportingObservationRefs: [],
    supportingSourceProofRefs: [],
    verifiedByEvidenceKinds: [],
    confidenceSource: "missing_page_state_observation",
  });
}

function buildPageOpenedBlankResult(pageStateObservation: ReturnType<typeof getObservationsByKind<"page_state">>[number]) {
  return VerifyPageOpenedOutputSchema.parse({
    observedOutcome: "about:blank",
    verificationDecision: "failed",
    confidence: 1,
    failureReason: "unexpected_state",
    reviewRequiredReason: null,
    statusMessage: "Opened page remained blank.",
    dataQualityFlags: ["about_blank"],
    supportingEvidenceRefs: [],
    supportingObservationRefs: [pageStateObservation.ref],
    supportingSourceProofRefs: [pageStateObservation.source.sourceProofRef],
    verifiedByEvidenceKinds: ["page_state"],
    confidenceSource: "page_state_current_url",
  });
}

function buildPageOpenedBlockedResult(pageStateObservation: ReturnType<typeof getObservationsByKind<"page_state">>[number], loginState: string) {
  return VerifyPageOpenedOutputSchema.parse({
    observedOutcome: loginState,
    verificationDecision: "failed",
    confidence: 1,
    failureReason: "policy_blocked",
    reviewRequiredReason: "Security or captcha wall intercepted the opened page.",
    statusMessage: "Page-open verification was blocked by a security wall.",
    dataQualityFlags: ["security_wall"],
    supportingEvidenceRefs: [],
    supportingObservationRefs: [pageStateObservation.ref],
    supportingSourceProofRefs: [pageStateObservation.source.sourceProofRef],
    verifiedByEvidenceKinds: ["page_state"],
    confidenceSource: "page_state_login_state",
  });
}

function buildPageOpenedReviewRequiredResult(pageStateObservation: ReturnType<typeof getObservationsByKind<"page_state">>[number], loginState: string) {
  return VerifyPageOpenedOutputSchema.parse({
    observedOutcome: loginState,
    verificationDecision: "review_required",
    confidence: 0.9,
    failureReason: "insufficient_evidence",
    reviewRequiredReason: "Login or safety review is required before the page can be considered opened.",
    statusMessage: "Page-open verification requires review because the platform is not feed-ready.",
    dataQualityFlags: ["login_required"],
    supportingEvidenceRefs: [],
    supportingObservationRefs: [pageStateObservation.ref],
    supportingSourceProofRefs: [pageStateObservation.source.sourceProofRef],
    verifiedByEvidenceKinds: ["page_state"],
    confidenceSource: "page_state_login_state",
  });
}

function buildPageOpenedUrlMismatchResult(pageStateObservation: ReturnType<typeof getObservationsByKind<"page_state">>[number], currentUrl: string, reason: "host_mismatch" | "prefix_mismatch") {
  return VerifyPageOpenedOutputSchema.parse({
    observedOutcome: currentUrl,
    verificationDecision: "failed",
    confidence: 0.94,
    failureReason: "unexpected_state",
    reviewRequiredReason: null,
    statusMessage: "Opened page URL did not match the expected domain or prefix.",
    dataQualityFlags: [reason === "host_mismatch" ? "wrong_domain" : "url_prefix_mismatch"],
    supportingEvidenceRefs: [],
    supportingObservationRefs: [pageStateObservation.ref],
    supportingSourceProofRefs: [pageStateObservation.source.sourceProofRef],
    verifiedByEvidenceKinds: ["page_state"],
    confidenceSource: "page_state_current_url",
  });
}

function buildPageOpenedSuccessResult(pageStateObservation: ReturnType<typeof getObservationsByKind<"page_state">>[number], currentUrl: string) {
  return VerifyPageOpenedOutputSchema.parse({
    observedOutcome: currentUrl,
    verificationDecision: "verified",
    confidence: 1,
    failureReason: null,
    reviewRequiredReason: null,
    statusMessage: "Opened page matched the expected platform target.",
    dataQualityFlags: [],
    supportingEvidenceRefs: [],
    supportingObservationRefs: [pageStateObservation.ref],
    supportingSourceProofRefs: [pageStateObservation.source.sourceProofRef],
    verifiedByEvidenceKinds: ["page_state"],
    confidenceSource: "page_state_current_url",
  });
}

function resolvePageOpenedObservation(input: {
  observations: PostActionObservation[];
}) {
  const pageStateObservation = getObservationsByKind(input.observations, "page_state")[0] ?? null;
  if (pageStateObservation === null) {
    return { ok: false as const, result: buildPageOpenedMissingObservationResult() };
  }

  return { ok: true as const, pageStateObservation };
}

function resolvePageOpenedLoginState(input: {
  pageStateObservation: ReturnType<typeof getObservationsByKind<"page_state">>[number];
}) {
  const currentUrl = input.pageStateObservation.payload.currentUrl;
  const loginState = input.pageStateObservation.payload.loginState;
  if (!currentUrl || currentUrl === "about:blank") {
    return { ok: false as const, result: buildPageOpenedBlankResult(input.pageStateObservation) };
  }

  if (loginState === "captcha" || loginState === "security_wall") {
    return { ok: false as const, result: buildPageOpenedBlockedResult(input.pageStateObservation, loginState) };
  }

  if (loginState === "login_required" || loginState === "review_required") {
    return { ok: false as const, result: buildPageOpenedReviewRequiredResult(input.pageStateObservation, loginState) };
  }

  return { ok: true as const, currentUrl };
}

function resolvePageOpenedResult(input: {
  observations: PostActionObservation[];
  expectedUrlHost: string | null;
  expectedUrlPrefix?: string | null;
}) {
  const observationResolution = resolvePageOpenedObservation({ observations: input.observations });
  if (!observationResolution.ok) {
    return observationResolution.result;
  }

  const loginResolution = resolvePageOpenedLoginState({ pageStateObservation: observationResolution.pageStateObservation });
  if (!loginResolution.ok) {
    return loginResolution.result;
  }

  const urlDecision = verifyNormalizedPostActionUrl({
    currentUrl: loginResolution.currentUrl,
    expectedUrlHost: input.expectedUrlHost,
    expectedUrlPrefix: input.expectedUrlPrefix ?? null,
  });

  if (urlDecision.reason === "host_mismatch" || urlDecision.reason === "prefix_mismatch") {
    return buildPageOpenedUrlMismatchResult(observationResolution.pageStateObservation, loginResolution.currentUrl, urlDecision.reason);
  }

  if (urlDecision.reason !== null) {
    return buildPageOpenedReviewRequiredResult(
      observationResolution.pageStateObservation,
      observationResolution.pageStateObservation.payload.loginState ?? "unknown",
    );
  }

  return buildPageOpenedSuccessResult(observationResolution.pageStateObservation, loginResolution.currentUrl);
}

async function executeVerifyPageOpened(input: {
  observations: PostActionObservation[];
  expectedUrlHost: string | null;
  expectedUrlPrefix?: string | null;
}) {
  return resolvePageOpenedResult(input);
}

export function createVerifyPageOpenedCapability(): PostActionVerificationChildCapability {
  return {
    abilityGroupId: POST_ACTION_VERIFICATION_ABILITY_GROUP_ID,
    childCapabilityId: "verify-page-opened" as const,
    async execute(input, context: PostActionVerificationRuntimeContext) {
      return VerifyPageOpenedOutputSchema.parse(await executeVerifyPageOpened({
        observations: context.evidenceReadPort.listObservations(input),
        expectedUrlHost: input.expectedOutcome.expectedUrlHost,
        expectedUrlPrefix: input.expectedOutcome.expectedUrlPrefix,
      }));
    },
  };
}
