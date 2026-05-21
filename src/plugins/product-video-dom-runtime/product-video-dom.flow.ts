import type { BrowserController } from "../../lib/browser/browser-controller.js";
import {
  clickDomElementOnce,
  locateDomElementOnce,
  readDomSnapshotOnce,
  verifyDomStateOnce,
} from "../../capabilities/dom-automation/index.js";
import type { DomActionResult, DomSnapshot } from "../../capabilities/dom-automation/index.js";
import { extractProductVideoComments } from "./product-video-comment-extractor.js";
import { buildProductVideoEvidencePacket } from "./product-video-evidence-packet.js";
import type { ProductVideoDomMissionInput, ProductVideoDomTaskRecord } from "./product-video-dom.schema.js";
import {
  buildReceivedProductVideoTaskRecord,
  createProductVideoDomTaskId,
  saveProductVideoEvidencePacket,
  saveProductVideoTaskRecord,
  updateProductVideoTaskRecord,
} from "./product-video-task-storage.js";

const READ_INPUT = { maxTextLengthPerNode: 160 } as const;

type ProductVideoFlowResult = Pick<ProductVideoDomTaskRecord, "status" | "ok" | "reason" | "reachedStep" | "evidenceRefs" | "evidencePacketPath">;
type ProductVideoFlowInput = {
  browser: BrowserController;
  dataDir: string;
  taskId: string;
  mission: ProductVideoDomMissionInput;
};
type ProductVideoActionResult = {
  firstSnapshot: DomSnapshot;
  likeResult: DomActionResult;
  commentsButtonResult: DomActionResult;
  commentsSnapshot: DomSnapshot;
};

const evidenceRefsFrom = (...actions: readonly DomActionResult[]): string[] =>
  actions.flatMap((action) => [action.beforeEvidenceRef, action.afterEvidenceRef])
    .filter((value): value is string => Boolean(value));

const reviewResult = (reason: string, reachedStep: string): ProductVideoFlowResult => ({
  status: "review_required",
  ok: false,
  reason,
  reachedStep,
  evidenceRefs: [],
});

const assertPageReady = async (snapshot: DomSnapshot): Promise<ProductVideoFlowResult | null> => {
  const verification = verifyDomStateOnce({
    snapshot,
    expectedStates: ["login-required", "captcha-or-2fa-required"],
  });
  if (verification.status === "login_required") {
    return { status: "login_required", ok: false, reason: verification.reason, reachedStep: "page readiness", evidenceRefs: [verification.evidenceRef] };
  }
  if (verification.status === "captcha_or_2fa_required") {
    return { status: "captcha_or_2fa_required", ok: false, reason: verification.reason, reachedStep: "page readiness", evidenceRefs: [verification.evidenceRef] };
  }
  return null;
};

const clickRequiredButton = async (input: {
  browser: BrowserController;
  snapshot: DomSnapshot;
  hints: string[];
  expectedKind: string;
  reachedStep: string;
}): Promise<DomActionResult | ProductVideoFlowResult> => {
  try {
    const element = locateDomElementOnce({
      snapshot: input.snapshot,
      targetKind: "button",
      hints: input.hints,
    });
    const result = await clickDomElementOnce(input.browser, {
      elementRef: element,
      expectedKind: input.expectedKind,
      waitAfterMs: 50,
    });
    if (!result.ok) {
      return reviewResult(result.message, input.reachedStep);
    }
    return result;
  } catch (error) {
    return reviewResult(error instanceof Error ? error.message : String(error), input.reachedStep);
  }
};

const isFlowResult = (value: unknown): value is ProductVideoFlowResult =>
  typeof value === "object" && value !== null && "status" in value && "reachedStep" in value;

const openProductVideoPage = async (
  input: ProductVideoFlowInput,
): Promise<DomSnapshot | ProductVideoFlowResult> => {
  const openResult = await input.browser.open({
    url: input.mission.pageUrl,
    title: "Product video DOM mining",
  });
  if (!openResult.ok) {
    return { status: "failed", ok: false, reason: openResult.message, reachedStep: "open product video", evidenceRefs: [] };
  }
  const firstSnapshot = await readDomSnapshotOnce(input.browser, READ_INPUT);
  return await assertPageReady(firstSnapshot) ?? firstSnapshot;
};

const handleAiDecision = (mission: ProductVideoDomMissionInput): ProductVideoFlowResult | null => {
  if (mission.aiDecision === "review_required") {
    return reviewResult("AI decision requested human review.", "ai decision");
  }
  if (mission.aiDecision === "not_product_seed") {
    return {
      status: "not_product_seed",
      ok: true,
      reason: "AI decision says this is not a product-seeding video.",
      reachedStep: "ai decision",
      evidenceRefs: [],
    };
  }
  return null;
};

const performProductVideoActions = async (
  input: ProductVideoFlowInput,
  firstSnapshot: DomSnapshot,
): Promise<ProductVideoActionResult | ProductVideoFlowResult> => {
  const likeResult = await clickRequiredButton({
    browser: input.browser,
    snapshot: firstSnapshot,
    hints: input.mission.targetHints.likeButton,
    expectedKind: "product video like button",
    reachedStep: "like product video",
  });
  if (isFlowResult(likeResult)) return likeResult;

  const afterLikeSnapshot = await readDomSnapshotOnce(input.browser, READ_INPUT);
  const commentsButtonResult = await clickRequiredButton({
    browser: input.browser,
    snapshot: afterLikeSnapshot,
    hints: input.mission.targetHints.commentsButton,
    expectedKind: "product video comments button",
    reachedStep: "open comments",
  });
  if (isFlowResult(commentsButtonResult)) return commentsButtonResult;

  return {
    firstSnapshot,
    likeResult,
    commentsButtonResult,
    commentsSnapshot: await readDomSnapshotOnce(input.browser, READ_INPUT),
  };
};

const persistCommentsAndAdvance = async (
  input: ProductVideoFlowInput,
  action: ProductVideoActionResult,
): Promise<ProductVideoFlowResult> => {
  const comments = extractProductVideoComments(action.commentsSnapshot);
  const packet = buildProductVideoEvidencePacket({
    mission: input.mission,
    snapshot: action.commentsSnapshot,
    comments,
    liked: true,
    evidenceRefs: evidenceRefsFrom(action.likeResult, action.commentsButtonResult),
  });
  const packetPath = saveProductVideoEvidencePacket({ dataDir: input.dataDir, taskId: input.taskId, packet });
  const nextButtonResult = await clickRequiredButton({
    browser: input.browser,
    snapshot: action.commentsSnapshot,
    hints: input.mission.targetHints.nextVideoButton,
    expectedKind: "next product video button",
    reachedStep: "advance next video",
  });
  if (isFlowResult(nextButtonResult)) {
    return { ...nextButtonResult, evidencePacketPath: packetPath, evidenceRefs: packet.evidenceRefs };
  }
  return {
    status: "advanced_to_next_video",
    ok: true,
    reason: "Product-seeding video was liked, comments were recorded, and the runtime advanced to the next video.",
    reachedStep: "next video opened",
    evidencePacketPath: packetPath,
    evidenceRefs: evidenceRefsFrom(action.likeResult, action.commentsButtonResult, nextButtonResult),
  };
};

export const runProductVideoDomMining = async (input: ProductVideoFlowInput): Promise<ProductVideoFlowResult> => {
  const aiDecisionResult = handleAiDecision(input.mission);
  if (aiDecisionResult) return aiDecisionResult;
  const pageReadiness = await openProductVideoPage(input);
  if (isFlowResult(pageReadiness)) return pageReadiness;
  const action = await performProductVideoActions(input, pageReadiness);
  return isFlowResult(action) ? action : persistCommentsAndAdvance(input, action);
};

export const startProductVideoDomTask = async (input: {
  browser: BrowserController;
  dataDir: string;
  mission: ProductVideoDomMissionInput;
}): Promise<ProductVideoDomTaskRecord> => {
  const taskId = createProductVideoDomTaskId();
  const received = buildReceivedProductVideoTaskRecord({ taskId, mission: input.mission });
  saveProductVideoTaskRecord(input.dataDir, received);
  const running = updateProductVideoTaskRecord(received, {
    status: "running",
    ok: false,
    reason: "Product video DOM mining started.",
    reachedStep: "running",
  });
  saveProductVideoTaskRecord(input.dataDir, running);
  const result = await runProductVideoDomMining({ ...input, taskId });
  const completed = updateProductVideoTaskRecord(running, result);
  saveProductVideoTaskRecord(input.dataDir, completed);
  return completed;
};
