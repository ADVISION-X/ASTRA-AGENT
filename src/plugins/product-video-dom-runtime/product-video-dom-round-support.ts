import { randomUUID } from "node:crypto";

import {
  clickDomElementOnce,
  locateDomElementOnce,
  readDomSnapshotOnce,
  verifyDomStateOnce,
  type DomActionResult,
  type DomSnapshot,
} from "../../capabilities/dom-automation/index.js";
import type {
  ProductVideoEvidenceRecord,
  ProductVideoJudgeOutput,
} from "./product-video-dom.schema.js";
import { advanceToNextProductVideo } from "./product-video-next-action.js";
import { appendProductVideoEvidenceRecord } from "./product-video-store.js";
import {
  buildProductVideoEvidenceRecord,
  saveProductVideoRawDomSnapshot,
} from "./product-video-evidence-packet.js";
import { extractProductVideoCommentDetails } from "./product-video-comment-extractor.js";
import { extractProductVideoVisitId } from "./product-video-dom-extractor.js";
import {
  PRODUCT_VIDEO_COMMENT_BUTTON_HINTS,
  type ProductVideoDomRoundInput,
  type ProductVideoDomRoundRuntimeResult,
} from "./product-video-dom-round-contract.js";

const READ_INPUT = { maxTextLengthPerNode: 160 } as const;
const MAX_ADVANCE_FAILURES = 5;

export const readCurrentProductVideoSnapshot = async (
  browser: ProductVideoDomRoundInput["browser"],
): Promise<DomSnapshot> => readDomSnapshotOnce(browser, READ_INPUT);

export const ensureProductVideoMissionPageLoaded = async (
  input: ProductVideoDomRoundInput,
): Promise<void> => {
  const session = input.browser.getSessionState();
  const shouldOpen = input.roundIndex === 0
    || !session.open
    || !session.currentUrl
    || session.currentUrl === "about:blank";
  if (!shouldOpen) {
    return;
  }
  const opened = await input.browser.open({
    url: input.productVideoPageUrl,
    title: "DOM Product Video",
  });
  if (!opened.ok) {
    throw new Error(`browser_control_lost: ${opened.message}`);
  }
};

export const checkProductVideoPageReadiness = (
  snapshot: DomSnapshot,
): ProductVideoDomRoundRuntimeResult["roundResult"] | null => {
  const verification = verifyDomStateOnce({
    snapshot,
    expectedStates: ["login-required", "captcha-or-2fa-required"],
  });
  if (verification.status === "login_required" || verification.status === "captcha_or_2fa_required") {
    return { status: "review_required", reason: verification.reason };
  }
  return null;
};

const actionEvidenceRefs = (action: DomActionResult): string[] => [
  action.beforeEvidenceRef,
  action.afterEvidenceRef,
].filter((value): value is string => Boolean(value));

const collectScreenshot = async (browser: ProductVideoDomRoundInput["browser"]): Promise<{
  screenshotStatus: "success" | "failed";
  screenshotRef: string | null;
  screenshotPath: string | null;
}> => {
  try {
    const capture = await browser.screenshotRegion({
      regionLabel: "product-video-dom-candidate",
      captureProfile: "observation_lightweight",
    });
    return {
      screenshotStatus: "success",
      screenshotRef: capture.browserActionId,
      screenshotPath: capture.sourceFilePath,
    };
  } catch {
    return {
      screenshotStatus: "failed",
      screenshotRef: null,
      screenshotPath: null,
    };
  }
};

const collectCommentEvidence = async (input: {
  browser: ProductVideoDomRoundInput["browser"];
  snapshot: DomSnapshot;
  shouldCollectComments: boolean;
}): Promise<{
  commentFetchStatus: ProductVideoEvidenceRecord["commentFetchStatus"];
  commentDetails: ProductVideoEvidenceRecord["commentDetails"];
  evidenceRefs: string[];
}> => {
  if (!input.shouldCollectComments) {
    return { commentFetchStatus: "not_requested", commentDetails: [], evidenceRefs: [] };
  }
  try {
    const commentsButton = locateDomElementOnce({
      snapshot: input.snapshot,
      targetKind: "button",
      hints: PRODUCT_VIDEO_COMMENT_BUTTON_HINTS,
    });
    const action = await clickDomElementOnce(input.browser, {
      elementRef: commentsButton,
      expectedKind: "product video comments button",
      waitAfterMs: 150,
    });
    if (!action.ok) {
      return { commentFetchStatus: "failed", commentDetails: [], evidenceRefs: actionEvidenceRefs(action) };
    }
    const commentsSnapshot = await readCurrentProductVideoSnapshot(input.browser);
    const commentDetails = extractProductVideoCommentDetails(commentsSnapshot);
    return {
      commentFetchStatus: commentDetails.length > 0 ? "success" : "partial",
      commentDetails,
      evidenceRefs: actionEvidenceRefs(action),
    };
  } catch {
    return { commentFetchStatus: "failed", commentDetails: [], evidenceRefs: [] };
  }
};

const buildRecordEvidenceRefs = (input: {
  screenshotRef: string | null;
  rawDomEvidenceRef: string;
  commentEvidenceRefs: string[];
}): string[] => [
  ...input.commentEvidenceRefs,
  ...(input.screenshotRef ? [input.screenshotRef] : []),
  input.rawDomEvidenceRef,
];

const collectRecordArtifacts = async (input: {
  roundInput: ProductVideoDomRoundInput;
  snapshot: DomSnapshot;
  aiJudge: ProductVideoJudgeOutput;
}) => {
  const screenshot = await collectScreenshot(input.roundInput.browser);
  const commentEvidence = await collectCommentEvidence({
    browser: input.roundInput.browser,
    snapshot: input.snapshot,
    shouldCollectComments: input.aiJudge.shouldCollectComments,
  });
  return {
    screenshot,
    commentEvidence,
    rawDomEvidenceRef: saveProductVideoRawDomSnapshot({
      dataDir: input.roundInput.dataDir,
      missionId: input.roundInput.missionId,
      roundId: input.roundInput.roundId,
      snapshot: input.snapshot,
    }),
  };
};

const buildStoredEvidenceRecord = (input: {
  roundInput: ProductVideoDomRoundInput;
  snapshot: DomSnapshot;
  aiJudge: ProductVideoJudgeOutput;
  artifacts: Awaited<ReturnType<typeof collectRecordArtifacts>>;
}): ProductVideoEvidenceRecord => buildProductVideoEvidenceRecord({
  id: randomUUID(),
  missionId: input.roundInput.missionId,
  runId: input.roundInput.runId,
  roundId: input.roundInput.roundId,
  platformId: input.roundInput.platformId,
  snapshot: input.snapshot,
  screenshotStatus: input.artifacts.screenshot.screenshotStatus,
  screenshotRef: input.artifacts.screenshot.screenshotRef,
  screenshotPath: input.artifacts.screenshot.screenshotPath,
  commentFetchStatus: input.artifacts.commentEvidence.commentFetchStatus,
  commentDetails: input.artifacts.commentEvidence.commentDetails,
  aiJudge: input.aiJudge,
  rawDomEvidenceRef: input.artifacts.rawDomEvidenceRef,
  evidenceRefs: buildRecordEvidenceRefs({
    screenshotRef: input.artifacts.screenshot.screenshotRef,
    rawDomEvidenceRef: input.artifacts.rawDomEvidenceRef,
    commentEvidenceRefs: input.artifacts.commentEvidence.evidenceRefs,
  }),
});

export const saveProductVideoEvidenceRecord = async (input: {
  roundInput: ProductVideoDomRoundInput;
  snapshot: DomSnapshot;
  aiJudge: ProductVideoJudgeOutput;
}): Promise<ProductVideoEvidenceRecord> => {
  const artifacts = await collectRecordArtifacts(input);
  return appendProductVideoEvidenceRecord({
    dataDir: input.roundInput.dataDir,
    record: buildStoredEvidenceRecord({ ...input, artifacts }),
  });
};

const buildAdvanceSuccessResult = (input: {
  savedRecord: ProductVideoEvidenceRecord | null;
  reason: string;
  afterSnapshot: DomSnapshot;
}): ProductVideoDomRoundRuntimeResult => ({
  roundResult: {
    status: "continue",
    reason: input.reason,
    videoVisitId: extractProductVideoVisitId(input.afterSnapshot),
  },
  savedRecord: input.savedRecord,
  advanceFailureCount: 0,
});

const buildAdvanceFailureResult = (input: {
  roundInput: ProductVideoDomRoundInput;
  beforeSnapshot: DomSnapshot;
  savedRecord: ProductVideoEvidenceRecord | null;
  reason: string;
  advanceReason: string;
}): ProductVideoDomRoundRuntimeResult => {
  const nextFailureCount = input.roundInput.consecutiveAdvanceFailures + 1;
  if (nextFailureCount >= MAX_ADVANCE_FAILURES) {
    return {
      roundResult: {
        status: "review_required",
        reason: `Consecutive next-video failures reached ${nextFailureCount}. Last reason: ${input.advanceReason}`,
      },
      savedRecord: input.savedRecord,
      advanceFailureCount: nextFailureCount,
    };
  }
  return {
    roundResult: {
      status: "continue",
      reason: `${input.reason}; retry_next_video: ${input.advanceReason}`,
      videoVisitId: extractProductVideoVisitId(input.beforeSnapshot),
    },
    savedRecord: input.savedRecord,
    advanceFailureCount: nextFailureCount,
  };
};

export const buildProductVideoContinueResult = async (input: {
  roundInput: ProductVideoDomRoundInput;
  beforeSnapshot: DomSnapshot;
  savedRecord: ProductVideoEvidenceRecord | null;
  reason: string;
}): Promise<ProductVideoDomRoundRuntimeResult> => {
  const advance = await advanceToNextProductVideo({
    browser: input.roundInput.browser,
    dataDir: input.roundInput.dataDir,
    missionId: input.roundInput.missionId,
    roundId: input.roundInput.roundId,
    beforeSnapshot: input.beforeSnapshot,
    failureReasonIfNoChange: "next_video_no_change",
  });
  return advance.ok && advance.afterSnapshot
    ? buildAdvanceSuccessResult({
        savedRecord: input.savedRecord,
        reason: input.reason,
        afterSnapshot: advance.afterSnapshot,
      })
    : buildAdvanceFailureResult({
        ...input,
        advanceReason: advance.reason,
      });
};