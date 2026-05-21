import type { BrowserController } from "../../lib/browser/browser-controller.js";
import {
  FacebookProductVideoMiningSchemas,
  type FacebookProductVideoMiningContracts,
} from "./facebook-product-video-mining.schema.js";
import {
  buildClickCommentEntryScript,
  buildExpandNextScript,
  buildExtractCommentsScript,
} from "./facebook-product-video-mining.comment-scripts.js";

type FacebookCommentRecord = FacebookProductVideoMiningContracts["FacebookCommentRecord"];
type FacebookVideoDomProbeResult = FacebookProductVideoMiningContracts["FacebookVideoDomProbeResult"];

export type FacebookCommentCollectionResult = {
  status: "success" | "review_required" | "failed";
  comments: FacebookCommentRecord[];
  commentsComplete: boolean;
  stopReason: string | null;
  reason: string | null;
};

type RawCommentsResult = {
  status: "success" | "review_required" | "failed";
  reason: string | null;
  comments: Array<{
    commentId: string | null;
    authorDisplayText: string | null;
    commentText: string;
    likeCount: number | null;
    replyDepth: number;
    parentCommentId: string | null;
    sourceSignal: string;
  }>;
  expandableCount: number;
};

type RawActionResult = {
  status: "success" | "review_required" | "failed";
  reason: string | null;
  acted: boolean;
};

const commentKey = (comment: Pick<FacebookCommentRecord, "authorDisplayText" | "commentText" | "parentCommentId">): string =>
  `${comment.authorDisplayText ?? "anon"}|${comment.parentCommentId ?? "root"}|${comment.commentText}`;

const normalizeCommentText = (comment: RawCommentsResult["comments"][number]): string => {
  let text = comment.commentText.trim();
  const author = comment.authorDisplayText?.trim();
  if (author && text.startsWith(author)) {
    text = text.slice(author.length).trim();
  }
  return text;
};

const shouldKeepComment = (comment: RawCommentsResult["comments"][number]): boolean => {
  const text = normalizeCommentText(comment);
  return text.length > 0
    && !/^\d+\s*(秒|分钟|小时|天|周|月|年|s|m|h|d|w)$/iu.test(text)
    && !/^查看原文/u.test(text)
    && !/^see translation$/iu.test(text);
};

const buildCommentCollectionFailure = (
  status: FacebookCommentCollectionResult["status"],
  reason: string | null,
  comments: FacebookCommentRecord[],
): FacebookCommentCollectionResult => ({
  status,
  comments,
  commentsComplete: false,
  stopReason: reason,
  reason,
});

const appendExtractedComments = (
  deduped: Map<string, FacebookCommentRecord>,
  extracted: RawCommentsResult,
): boolean => {
  const beforeCount = deduped.size;
  extracted.comments.filter(shouldKeepComment).forEach((comment, index) => {
    const parsed = FacebookProductVideoMiningSchemas.FacebookCommentRecordSchema.parse({
      ...comment,
      commentText: normalizeCommentText(comment),
      ordinal: deduped.size + index,
      capturedAt: new Date().toISOString(),
    });
    deduped.set(commentKey(parsed), parsed);
  });
  return deduped.size === beforeCount;
};

const buildCompletedCommentResult = (
  deduped: Map<string, FacebookCommentRecord>,
): FacebookCommentCollectionResult => ({
  status: "success",
  comments: [...deduped.values()],
  commentsComplete: true,
  stopReason: "no_more_comments",
  reason: null,
});

const extractRawComments = (
  browser: BrowserController,
): Promise<RawCommentsResult> =>
  browser.evaluateActiveTab<RawCommentsResult>({
    description: "extract visible Facebook comments",
    script: buildExtractCommentsScript(),
  });

const waitForCommentSurfaceSignal = async (input: {
  browser: BrowserController;
  deadline: number;
}): Promise<FacebookCommentCollectionResult | null> => {
  while (Date.now() < input.deadline) {
    const extracted = await extractRawComments(input.browser);
    if (extracted.status !== "success") {
      return buildCommentCollectionFailure(extracted.status, extracted.reason, []);
    }
    if (extracted.comments.length > 0 || extracted.expandableCount > 0) {
      return null;
    }
    await input.browser.wait(300);
  }
  return null;
};

const openFacebookCommentSurface = async (input: {
  browser: BrowserController;
  probe: FacebookVideoDomProbeResult;
  deadline: number;
}): Promise<FacebookCommentCollectionResult | null> => {
  const entryResult = await input.browser.evaluateActiveTab<RawActionResult>({
    description: "open current Facebook comment surface",
    script: buildClickCommentEntryScript(input.probe.commentEntryElementRef?.selector ?? null),
  });
  if (entryResult.status !== "success") {
    return buildCommentCollectionFailure(entryResult.status, entryResult.reason, []);
  }
  return waitForCommentSurfaceSignal({
    browser: input.browser,
    deadline: Math.min(input.deadline, Date.now() + 5_000),
  });
};

const waitForCommentExpansionEffect = async (input: {
  browser: BrowserController;
  deadline: number;
  previousCommentCount: number;
  previousExpandableCount: number;
}): Promise<FacebookCommentCollectionResult | null> => {
  while (Date.now() < input.deadline) {
    const extracted = await extractRawComments(input.browser);
    if (extracted.status !== "success") {
      return buildCommentCollectionFailure(extracted.status, extracted.reason, []);
    }
    if (
      extracted.comments.length > input.previousCommentCount
      || extracted.expandableCount !== input.previousExpandableCount
      || extracted.expandableCount === 0
    ) {
      return null;
    }
    await input.browser.wait(300);
  }
  return null;
};

const extractFacebookCommentRound = async (input: {
  browser: BrowserController;
  deduped: Map<string, FacebookCommentRecord>;
  stableRounds: number;
  deadline: number;
}): Promise<{ result: FacebookCommentCollectionResult | null; stableRounds: number }> => {
  const extracted = await extractRawComments(input.browser);
  if (extracted.status !== "success") {
    return {
      result: buildCommentCollectionFailure(extracted.status, extracted.reason, [...input.deduped.values()]),
      stableRounds: input.stableRounds,
    };
  }
  const nextStableRounds = appendExtractedComments(input.deduped, extracted)
    ? input.stableRounds + 1
    : 0;
  if (nextStableRounds >= 2 && extracted.expandableCount === 0) {
    return { result: buildCompletedCommentResult(input.deduped), stableRounds: nextStableRounds };
  }
  await input.browser.evaluateActiveTab<RawActionResult>({
    description: "expand more Facebook comments",
    script: buildExpandNextScript(),
  });
  const expansionFailure = await waitForCommentExpansionEffect({
    browser: input.browser,
    deadline: Math.min(input.deadline, Date.now() + 5_000),
    previousCommentCount: extracted.comments.length,
    previousExpandableCount: extracted.expandableCount,
  });
  if (expansionFailure) {
    return { result: expansionFailure, stableRounds: nextStableRounds };
  }
  return { result: null, stableRounds: nextStableRounds };
};

export const collectAllLoadableComments = async (input: {
  browser: BrowserController;
  probe: FacebookVideoDomProbeResult;
  maxCommentScrolls: number;
  maxCommentWaitMs: number;
}): Promise<FacebookCommentCollectionResult> => {
  const deadline = Date.now() + input.maxCommentWaitMs;
  const openFailure = await openFacebookCommentSurface({ browser: input.browser, probe: input.probe, deadline });
  if (openFailure) {
    return openFailure;
  }
  const deduped = new Map<string, FacebookCommentRecord>();
  let stableRounds = 0;
  for (let round = 0; round < input.maxCommentScrolls && Date.now() < deadline; round += 1) {
    const iteration = await extractFacebookCommentRound({ browser: input.browser, deduped, stableRounds, deadline });
    if (iteration.result) {
      return iteration.result;
    }
    stableRounds = iteration.stableRounds;
  }
  return {
    status: "success",
    comments: [...deduped.values()],
    commentsComplete: false,
    stopReason: Date.now() >= deadline ? "max_wait_reached" : "max_scroll_reached",
    reason: null,
  };
};
