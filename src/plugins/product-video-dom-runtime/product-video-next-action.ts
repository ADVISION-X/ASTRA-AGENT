import type { BrowserController } from "../../lib/browser/browser-controller.js";
import {
  clickDomElementOnce,
  locateDomElementOnce,
  readDomSnapshotOnce,
  type DomSnapshot,
} from "../../capabilities/dom-automation/index.js";
import {
  extractProductVideoVisitId,
  extractSnapshotSignature,
} from "./product-video-dom-extractor.js";
import {
  appendProductVideoNavigationEntry,
} from "./product-video-store.js";
import type { ProductVideoNavigationEntry } from "./product-video-dom.schema.js";

const READ_INPUT = { maxTextLengthPerNode: 160 } as const;
const NEXT_BUTTON_HINTS = ["next", "next video", "下一条", "下一个视频", "下一个", "reel next"];
const ADVANCE_POLL_ATTEMPTS = 8;
const ADVANCE_POLL_WAIT_MS = 350;

type AdvanceAction = "click_next" | "scroll_next" | "keyboard_next" | "skip_no_change";

export type ProductVideoAdvanceResult = {
  ok: boolean;
  action: AdvanceAction;
  reason: string;
  afterSnapshot: DomSnapshot | null;
  browseEntry: ProductVideoNavigationEntry;
};

const createLedgerEntry = (input: {
  missionId: string;
  roundId: string;
  beforeSnapshot: DomSnapshot;
  afterSnapshot: DomSnapshot | null;
  action: AdvanceAction;
  status: "success" | "failed";
  reason: string;
}): ProductVideoNavigationEntry => ({
  missionId: input.missionId,
  roundId: input.roundId,
  pageUrlBefore: input.beforeSnapshot.url,
  pageUrlAfter: input.afterSnapshot?.url ?? null,
  videoVisitIdBefore: extractProductVideoVisitId(input.beforeSnapshot),
  videoVisitIdAfter: input.afterSnapshot ? extractProductVideoVisitId(input.afterSnapshot) : null,
  action: input.action,
  status: input.status,
  reason: input.reason,
  createdAt: new Date().toISOString(),
});

const hasVideoChanged = (
  beforeSnapshot: DomSnapshot,
  afterSnapshot: DomSnapshot,
): boolean => {
  const beforeVisitId = extractProductVideoVisitId(beforeSnapshot);
  const afterVisitId = extractProductVideoVisitId(afterSnapshot);
  if (beforeVisitId && afterVisitId && beforeVisitId !== afterVisitId) {
    return true;
  }
  if (beforeSnapshot.url !== afterSnapshot.url) {
    return true;
  }
  return extractSnapshotSignature(beforeSnapshot) !== extractSnapshotSignature(afterSnapshot);
};

const waitForAdvance = async (input: {
  browser: BrowserController;
  beforeSnapshot: DomSnapshot;
}): Promise<DomSnapshot | null> => {
  for (let attempt = 0; attempt < ADVANCE_POLL_ATTEMPTS; attempt += 1) {
    await input.browser.wait(ADVANCE_POLL_WAIT_MS);
    const snapshot = await readDomSnapshotOnce(input.browser, READ_INPUT);
    if (hasVideoChanged(input.beforeSnapshot, snapshot)) {
      return snapshot;
    }
  }
  return null;
};

const tryClickNext = async (input: {
  browser: BrowserController;
  beforeSnapshot: DomSnapshot;
}): Promise<boolean> => {
  try {
    const nextButton = locateDomElementOnce({
      snapshot: input.beforeSnapshot,
      targetKind: "button",
      hints: NEXT_BUTTON_HINTS,
    });
    const clicked = await clickDomElementOnce(input.browser, {
      elementRef: nextButton,
      expectedKind: "product video next button",
      waitAfterMs: 100,
    });
    return clicked.ok;
  } catch {
    return false;
  }
};

const tryScrollNext = async (browser: BrowserController): Promise<boolean> => {
  const geometry = await browser.getGeometrySnapshot();
  const result = await browser.scroll({
    targetLabel: "product video next scroll",
    deltaX: 0,
    deltaY: Math.max(420, Math.round(geometry.viewportHeight * 0.86)),
    coordinateSpace: "browserViewport",
    anchorPoint: {
      x: Math.round(geometry.viewportWidth / 2),
      y: Math.round(geometry.viewportHeight * 0.8),
    },
  });
  return result.ok;
};

const persistBrowseEntry = (
  dataDir: string,
  entry: ProductVideoNavigationEntry,
): ProductVideoNavigationEntry => appendProductVideoNavigationEntry({ dataDir, entry });

const buildAdvanceFailureResult = (input: {
  dataDir: string;
  missionId: string;
  roundId: string;
  beforeSnapshot: DomSnapshot;
  reason: string;
}): ProductVideoAdvanceResult => {
  const browseEntry = persistBrowseEntry(input.dataDir, createLedgerEntry({
    missionId: input.missionId,
    roundId: input.roundId,
    beforeSnapshot: input.beforeSnapshot,
    afterSnapshot: null,
    action: "skip_no_change",
    status: "failed",
    reason: input.reason,
  }));
  return {
    ok: false,
    action: "skip_no_change",
    reason: input.reason,
    afterSnapshot: null,
    browseEntry,
  };
};

const buildAdvanceSuccessResult = (input: {
  dataDir: string;
  missionId: string;
  roundId: string;
  beforeSnapshot: DomSnapshot;
  afterSnapshot: DomSnapshot;
  action: AdvanceAction;
}): ProductVideoAdvanceResult => {
  const browseEntry = persistBrowseEntry(input.dataDir, createLedgerEntry({
    missionId: input.missionId,
    roundId: input.roundId,
    beforeSnapshot: input.beforeSnapshot,
    afterSnapshot: input.afterSnapshot,
    action: input.action,
    status: "success",
    reason: "Advanced to next video.",
  }));
  return {
    ok: true,
    action: input.action,
    reason: "Advanced to next video.",
    afterSnapshot: input.afterSnapshot,
    browseEntry,
  };
};

const attemptAdvanceAction = async (input: {
  browser: BrowserController;
  beforeSnapshot: DomSnapshot;
}): Promise<AdvanceAction | null> => {
  if (await tryClickNext(input)) {
    return "click_next";
  }
  return await tryScrollNext(input.browser) ? "scroll_next" : null;
};

const waitForAdvanceResult = async (input: {
  browser: BrowserController;
  dataDir: string;
  missionId: string;
  roundId: string;
  beforeSnapshot: DomSnapshot;
  action: AdvanceAction;
  failureReasonIfNoChange: string;
}): Promise<ProductVideoAdvanceResult> => {
  const afterSnapshot = await waitForAdvance({
    browser: input.browser,
    beforeSnapshot: input.beforeSnapshot,
  });
  return afterSnapshot
    ? buildAdvanceSuccessResult({
        dataDir: input.dataDir,
        missionId: input.missionId,
        roundId: input.roundId,
        beforeSnapshot: input.beforeSnapshot,
        afterSnapshot,
        action: input.action,
      })
    : buildAdvanceFailureResult({
        dataDir: input.dataDir,
        missionId: input.missionId,
        roundId: input.roundId,
        beforeSnapshot: input.beforeSnapshot,
        reason: input.failureReasonIfNoChange,
      });
};

export const advanceToNextProductVideo = async (input: {
  browser: BrowserController;
  dataDir: string;
  missionId: string;
  roundId: string;
  beforeSnapshot: DomSnapshot;
  failureReasonIfNoChange: string;
}): Promise<ProductVideoAdvanceResult> => {
  const action = await attemptAdvanceAction({
    browser: input.browser,
    beforeSnapshot: input.beforeSnapshot,
  });
  if (!action) {
    return buildAdvanceFailureResult({
      dataDir: input.dataDir,
      missionId: input.missionId,
      roundId: input.roundId,
      beforeSnapshot: input.beforeSnapshot,
      reason: input.failureReasonIfNoChange,
    });
  }
  return waitForAdvanceResult({ ...input, action });
};