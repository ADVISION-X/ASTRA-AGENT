import { createHash } from "node:crypto";

import type { BrowserController } from "../../lib/browser/browser-controller.js";
import {
  RuntimeFailureClass,
  createMissionTrace,
  createStageLogger,
  type RuntimeLogger,
  withRoundTrace,
} from "../../lib/runtime-logs/index.js";
import {
  FACEBOOK_LOGIN_BLOCKER_PATTERNS,
  FACEBOOK_RATE_LIMIT_PATTERNS,
  FACEBOOK_SECURITY_BLOCKER_PATTERNS,
} from "./facebook-product-video-mining.hints.js";
import { buildFacebookDomProbeScript } from "./facebook-product-video-mining.dom-probe-script.js";
import {
  FacebookProductVideoMiningSchemas,
  type FacebookProductVideoMiningContracts,
} from "./facebook-product-video-mining.schema.js";

type FacebookSelectorEvidence = FacebookProductVideoMiningContracts["FacebookSelectorEvidence"];
type FacebookVideoDomProbeResult = FacebookProductVideoMiningContracts["FacebookVideoDomProbeResult"];

type RawProbeCandidate = FacebookSelectorEvidence & {
  metricValue: string | null;
};

type RawFacebookProbe = {
  sourcePageUrl: string;
  pageTitle: string;
  bodyText: string;
  videoElementFacts: FacebookVideoDomProbeResult["videoElementFacts"];
  commentEntryCandidates: RawProbeCandidate[];
  moreMenuCandidates: RawProbeCandidate[];
  nextVideoCandidates: RawProbeCandidate[];
  likeCandidates: RawProbeCandidate[];
  commentCountCandidates: RawProbeCandidate[];
  shareCandidates: RawProbeCandidate[];
  notInterestedCandidates: RawProbeCandidate[];
};

const FACEBOOK_RUNTIME_LOG_OWNER = "facebook-product-video-mining" as const;

const redactUrl = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  if (URL.canParse(value)) {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  }
  return value.split("?")[0] ?? value;
};

const parseMetricText = (value: string | null): number | null => {
  if (!value) {
    return null;
  }
  const normalized = value.replace(/,/g, "").trim().toUpperCase();
  const matched = normalized.match(/(\d+(?:\.\d+)?)([KMB])?/u);
  if (!matched) {
    return null;
  }
  const numberValue = Number.parseFloat(matched[1] ?? "0");
  if (!Number.isFinite(numberValue)) {
    return null;
  }
  const suffix = matched[2] ?? "";
  const multiplier = suffix === "K" ? 1_000 : suffix === "M" ? 1_000_000 : suffix === "B" ? 1_000_000_000 : 1;
  return Math.round(numberValue * multiplier);
};

const buildStableUnknownId = (input: {
  sourcePageUrl: string;
  currentSrc: string | null;
  roundIndex: number;
}): string => createHash("sha256")
  .update(`${input.sourcePageUrl}|${redactUrl(input.currentSrc) ?? "unknown"}|${input.roundIndex}`)
  .digest("hex")
  .slice(0, 24);

const resolveFacebookVideoId = (input: {
  sourcePageUrl: string;
  currentSrc: string | null;
  roundIndex: number;
}): string => {
  const sourcePageUrl = new URL(input.sourcePageUrl);
  const directPathMatch = sourcePageUrl.pathname.match(/\/(?:reels|videos|watch)\/(\d+)/u);
  if (directPathMatch?.[1]) {
    return directPathMatch[1];
  }
  const watchId = sourcePageUrl.searchParams.get("v");
  if (watchId) {
    return watchId;
  }
  return `stable_unknown_${buildStableUnknownId(input)}`;
};

const bestCandidate = (candidates: readonly RawProbeCandidate[]): FacebookSelectorEvidence | null => {
  const candidate = candidates[0];
  if (!candidate) {
    return null;
  }
  return {
    selector: candidate.selector,
    confidence: candidate.confidence,
    reason: candidate.reason,
    matchedSignals: candidate.matchedSignals,
    visibleText: candidate.visibleText,
  };
};

const findMetric = (candidates: readonly RawProbeCandidate[]): number | null => {
  for (const candidate of candidates) {
    const metric = parseMetricText(candidate.metricValue ?? candidate.visibleText);
    if (metric !== null) {
      return metric;
    }
  }
  return null;
};

const detectBlocker = (bodyText: string): {
  probeStatus: FacebookVideoDomProbeResult["status"];
  blocker: string;
} | null => {
  if (FACEBOOK_LOGIN_BLOCKER_PATTERNS.some((pattern) => pattern.test(bodyText))) {
    return { probeStatus: "login_required", blocker: "facebook_login_required" };
  }
  if (FACEBOOK_SECURITY_BLOCKER_PATTERNS.some((pattern) => pattern.test(bodyText))) {
    return { probeStatus: "captcha_or_2fa_required", blocker: "facebook_security_verification_required" };
  }
  if (FACEBOOK_RATE_LIMIT_PATTERNS.some((pattern) => pattern.test(bodyText))) {
    return { probeStatus: "review_required", blocker: "facebook_rate_limited" };
  }
  return null;
};

const normalizeVideoFact = (
  fact: FacebookVideoDomProbeResult["videoElementFacts"][number],
) => ({
  ...fact,
  src: redactUrl(fact.src),
  currentSrc: redactUrl(fact.currentSrc),
});

const buildRawDomSignalsSummary = (
  raw: RawFacebookProbe,
  blocker: ReturnType<typeof detectBlocker>,
) => ({
  matchedTexts: [
    ...raw.commentEntryCandidates,
    ...raw.moreMenuCandidates,
    ...raw.likeCandidates,
  ].map((candidate) => candidate.visibleText).filter((value): value is string => Boolean(value)).slice(0, 12),
  blockerReasons: blocker ? [blocker.blocker] : [],
  candidateCounts: [
    { kind: "video", count: raw.videoElementFacts.length },
    { kind: "commentEntry", count: raw.commentEntryCandidates.length },
    { kind: "moreMenu", count: raw.moreMenuCandidates.length },
    { kind: "nextVideo", count: raw.nextVideoCandidates.length },
  ],
});

const createFacebookRoundTrace = (input: {
  missionId: string;
  runId: string;
  roundId: string;
}) => withRoundTrace({
  context: createMissionTrace({
    missionId: input.missionId,
    runId: input.runId,
    owner: FACEBOOK_RUNTIME_LOG_OWNER,
  }),
  roundId: input.roundId,
});

const buildFacebookDomProbeResult = (input: {
  raw: RawFacebookProbe;
  blocker: ReturnType<typeof detectBlocker>;
  roundIndex: number;
}): FacebookVideoDomProbeResult => {
  const primaryVideoFact = input.raw.videoElementFacts[0] ?? null;
  const facebookVideoId = resolveFacebookVideoId({
    sourcePageUrl: input.raw.sourcePageUrl,
    currentSrc: primaryVideoFact?.currentSrc ?? null,
    roundIndex: input.roundIndex,
  });
  return FacebookProductVideoMiningSchemas.FacebookVideoDomProbeResultSchema.parse({
    status: input.blocker?.probeStatus ?? (input.raw.videoElementFacts.length > 0 ? "success" : "review_required"),
    sourcePageUrl: input.raw.sourcePageUrl,
    pageTitle: input.raw.pageTitle || "Facebook",
    facebookVideoId,
    videoElementFacts: input.raw.videoElementFacts.map(normalizeVideoFact),
    primaryVideoFact: primaryVideoFact ? normalizeVideoFact(primaryVideoFact) : null,
    likeCount: findMetric(input.raw.likeCandidates),
    commentCountDisplayed: findMetric(input.raw.commentCountCandidates),
    shareCountDisplayed: findMetric(input.raw.shareCandidates),
    authorText: null,
    captionText: null,
    commentEntryElementRef: bestCandidate(input.raw.commentEntryCandidates),
    moreMenuElementRef: bestCandidate(input.raw.moreMenuCandidates),
    notInterestedElementRef: bestCandidate(input.raw.notInterestedCandidates),
    nextVideoElementRef: bestCandidate(input.raw.nextVideoCandidates),
    likeCountElementRef: bestCandidate(input.raw.likeCandidates),
    commentCountElementRef: bestCandidate(input.raw.commentCountCandidates),
    rawDomSignalsSummary: buildRawDomSignalsSummary(input.raw, input.blocker),
    blocker: input.blocker?.blocker ?? (input.raw.videoElementFacts.length > 0 ? null : "facebook_video_not_detected"),
    capturedAt: new Date().toISOString(),
  });
};

const buildProbeHashes = (input: {
  raw: RawFacebookProbe;
  result: FacebookVideoDomProbeResult;
}): {
  currentSrcHash: string;
  textHash: string;
  domSignatureHash: string;
  confidence: number;
} => ({
  currentSrcHash: createHash("sha256")
    .update(input.result.primaryVideoFact?.currentSrc ?? "")
    .digest("hex")
    .slice(0, 24),
  textHash: createHash("sha256")
    .update(input.raw.bodyText)
    .digest("hex")
    .slice(0, 24),
  domSignatureHash: createHash("sha256")
    .update(JSON.stringify({
      title: input.result.pageTitle,
      blocker: input.result.blocker,
      candidateCounts: input.result.rawDomSignalsSummary.candidateCounts,
      videoCount: input.result.videoElementFacts.length,
    }))
    .digest("hex")
    .slice(0, 24),
  confidence: input.result.commentEntryElementRef?.confidence ?? input.result.moreMenuElementRef?.confidence ?? 0,
});

const failProbeStages = ({
  identifyStage,
  domProbeStage,
  result,
  roundId,
  currentSrcHash,
  textHash,
  domSignatureHash,
  confidence,
}: {
  identifyStage: ReturnType<ReturnType<typeof createStageLogger>["start"]>;
  domProbeStage: ReturnType<ReturnType<typeof createStageLogger>["start"]>;
  result: FacebookVideoDomProbeResult;
  roundId: string;
  currentSrcHash: string;
  textHash: string;
  domSignatureHash: string;
  confidence: number;
}): void => {
  const reason = result.blocker ?? result.status;
  identifyStage.fail({
    reason,
    failureClass: RuntimeFailureClass.DOM_PROBE_FAILURE,
    retryable: false,
    terminal: false,
    recoveryPolicy: "review_required",
    hashes: { currentSrcHash, textHash },
    metrics: { confidence },
    payload: {
      recoveryTrail: "facebook-dom-probe-recovery-trail",
      action: "identify_facebook_video",
      beforeHash: "dom-probe-before",
      afterHash: "dom-probe-after",
    },
  });
  domProbeStage.fail({
    reason,
    failureClass: RuntimeFailureClass.DOM_PROBE_FAILURE,
    retryable: false,
    terminal: false,
    recoveryPolicy: "review_required",
    refs: { domSnapshotRef: `dom-snapshot:${roundId}` },
    hashes: { domSignatureHash },
    metrics: {
      likeCount: result.likeCount ?? 0,
      commentCountDisplayed: result.commentCountDisplayed ?? 0,
    },
    payload: {
      recoveryTrail: "facebook-dom-probe-recovery-trail",
      action: "probe_facebook_dom",
      beforeHash: "dom-probe-before",
      afterHash: "dom-probe-after",
    },
  });
};

const completeProbeStages = ({
  identifyStage,
  domProbeStage,
  result,
  roundId,
  currentSrcHash,
  textHash,
  domSignatureHash,
  confidence,
}: {
  identifyStage: ReturnType<ReturnType<typeof createStageLogger>["start"]>;
  domProbeStage: ReturnType<ReturnType<typeof createStageLogger>["start"]>;
  result: FacebookVideoDomProbeResult;
  roundId: string;
  currentSrcHash: string;
  textHash: string;
  domSignatureHash: string;
  confidence: number;
}): void => {
  identifyStage.complete({
    durationMs: 0,
    hashes: { currentSrcHash, textHash },
    metrics: { confidence },
  });
  domProbeStage.complete({
    durationMs: 0,
    refs: { domSnapshotRef: `dom-snapshot:${roundId}` },
    hashes: { domSignatureHash },
    metrics: {
      likeCount: result.likeCount ?? 0,
      commentCountDisplayed: result.commentCountDisplayed ?? 0,
    },
  });
};

export const probeCurrentFacebookVideo = async (input: {
  browser: BrowserController;
  runtimeLogger: RuntimeLogger;
  missionId: string;
  runId: string;
  roundId: string;
  roundIndex: number;
}): Promise<FacebookVideoDomProbeResult> => {
  const traceContext = createFacebookRoundTrace(input);
  const stageLogger = createStageLogger({ logger: input.runtimeLogger });
  const identifyStage = stageLogger.start({
    context: traceContext,
    stageName: "FACEBOOK_IDENTIFY_VIDEO",
    modeVisibility: ["DEBUG", "TRACE"],
  });
  const domProbeStage = stageLogger.start({
    context: traceContext,
    stageName: "FACEBOOK_DOM_PROBE",
    modeVisibility: ["DEBUG", "TRACE"],
    refs: { domSnapshotRef: `dom-snapshot:${input.roundId}` },
  });
  const raw = await input.browser.evaluateActiveTab<RawFacebookProbe>({
    description: "probe current Facebook video DOM state",
    script: buildFacebookDomProbeScript(),
  });
  const blocker = detectBlocker(raw.bodyText);
  const result = buildFacebookDomProbeResult({
    raw,
    blocker,
    roundIndex: input.roundIndex,
  });
  const hashes = buildProbeHashes({ raw, result });
  if (result.status !== "success") {
    failProbeStages({ identifyStage, domProbeStage, result, roundId: input.roundId, ...hashes });
    return result;
  }
  completeProbeStages({ identifyStage, domProbeStage, result, roundId: input.roundId, ...hashes });
  return result;
};
