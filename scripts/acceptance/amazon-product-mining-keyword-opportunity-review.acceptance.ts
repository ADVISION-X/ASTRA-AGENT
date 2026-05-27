import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { AiInputGatewayAbilityGroup } from "../../src/capabilities/ai-input-gateway/index.js";
import type { BrowserActionResult, BrowserController } from "../../src/lib/browser/browser-controller.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { runAmazonProductMiningFlow } from "../../src/plugins/amazon-product-mining/amazon-product-mining.flow.js";
import { createAmazonMiningStorage } from "../../src/plugins/amazon-product-mining/amazon-product-mining.storage.js";

const dataDir = mkdtempSync(path.join(os.tmpdir(), "amazon-mining-keyword-review-"));
const taskId = "amazon-keyword-review-acceptance";
const openedUrls: string[] = [];
const eventLog: string[] = [];

const productsByKeyword = {
  "keyword alpha": {
    asin: "B0ALPHA001",
    title: "Keyword Alpha Product",
    price: "$29.00",
    rating: "4.4 out of 5 stars",
    reviewCount: "212 ratings",
  },
  "keyword beta": {
    asin: "B0BETA0001",
    title: "Keyword Beta Product",
    price: "$64.00",
    rating: "4.0 out of 5 stars",
    reviewCount: "98 ratings",
  },
} as const;

const actionResult = (message: string): BrowserActionResult => ({
  browserActionId: `${message}-${Date.now()}`,
  ok: true,
  message,
  createdAt: new Date().toISOString(),
});

const createProviderProof = (inputHash: string, outputHash: string) => ({
  providerKind: "gpt-web-chat" as const,
  modelName: null,
  inputHash,
  outputHash,
  inputRefs: [],
  outputRefs: [],
  startedAt: new Date().toISOString(),
  endedAt: new Date().toISOString(),
  durationMs: 0,
  transport: "web-chat" as const,
  webChatUrl: null,
  sourcePageUrlBeforeFeed: null,
  restoredSourcePage: null,
  retryCount: 0,
  cooldownMs: 0,
  estimatedInputTokens: null,
  estimatedOutputTokens: null,
  tokenEstimateUnavailableReason: null,
});

const createAiGatewaySuccess = (input: { normalizedText: string; inputHash: string; outputHash: string }) => ({
  abilityGroupId: "ai-input-gateway" as const,
  childCapabilityId: "feed-gpt-web-chat-once" as const,
  providerKind: "gpt-web-chat" as const,
  status: "success" as const,
  normalizedText: input.normalizedText,
  rawOutputRef: null,
  rawOutputHash: null,
  parseStatus: "json_valid" as const,
  parsedJson: null,
  schemaValidationStatus: "not_applicable" as const,
  providerProof: createProviderProof(input.inputHash, input.outputHash),
  failureReason: null,
  reviewRequiredReason: null,
});

const createKeywordReviewGatewayResponse = () => createAiGatewaySuccess({
  normalizedText: JSON.stringify({
    decision: "PASS",
    demandSignal: "medium",
    reviewHealth: "medium",
    priceCeiling: "strong",
    competitionOpenness: "medium",
    improvementOpportunity: "strong",
    dataConfidence: "medium",
    evidenceRefs: ["evidence-index"],
    missingEvidence: [],
    riskPoints: [],
    humanNextStep: "enter_next_validation",
  }),
  inputHash: "review-input-hash",
  outputHash: "review-output-hash",
});

const createKeywordMiningGatewayResponse = () => createAiGatewaySuccess({
  normalizedText: JSON.stringify({
    keywords: [
      { keyword: "keyword alpha", reason: "alpha reason" },
      { keyword: "keyword beta", reason: "beta reason" },
    ],
  }),
  inputHash: "keyword-input-hash",
  outputHash: "keyword-output-hash",
});

const currentKeyword = (): keyof typeof productsByKeyword => {
  const currentUrl = openedUrls.at(-1) ?? "https://www.amazon.com/s?k=keyword+alpha";
  const parsed = new URL(currentUrl);
  const keyword = parsed.searchParams.get("k") ?? "keyword alpha";
  return decodeURIComponent(keyword).replace(/\+/g, " ") as keyof typeof productsByKeyword;
};

const currentAsin = (): string => {
  const currentUrl = openedUrls.at(-1) ?? "https://www.amazon.com/dp/B0ALPHA001";
  if (currentUrl.includes("B0BETA0001")) {
    return "B0BETA0001";
  }
  return "B0ALPHA001";
};

const browser = {
  getHealth: () => ({ ok: true, detail: "amazon keyword review acceptance browser" }),
  getSessionState: () => ({
    open: true,
    browserMode: "fixture" as const,
    browserProfileRef: "acceptance",
    browserExecutablePath: null,
    profileStatus: "profile_ready" as const,
    currentUrl: openedUrls.at(-1) ?? "about:blank",
    currentTitle: "Amazon keyword review acceptance",
    browserExecutable: null,
    profileDirectory: "acceptance",
    profileProvisioning: "managed_default" as const,
    profileVerificationStatus: "default_unverified" as const,
    profileVerificationReason: null,
    loginState: "unknown" as const,
    lastLoginCheckAt: null,
    loginRequiredReason: null,
    reviewRequiredReason: null,
  }),
  getGeometrySnapshot: async () => ({
    windowX: 0,
    windowY: 0,
    viewportWidth: 1200,
    viewportHeight: 900,
    screenshotWidth: 1200,
    screenshotHeight: 900,
    scaleFactor: 1,
    currentUrl: openedUrls.at(-1) ?? "about:blank",
    pageTitle: "Amazon keyword review acceptance",
    visibleContentBounds: { x: 0, y: 0, width: 1200, height: 900 },
    capturedAt: new Date().toISOString(),
  }),
  open: async ({ url }) => {
    openedUrls.push(url);
    if (url.includes("/s?k=")) {
      const keyword = decodeURIComponent(new URL(url).searchParams.get("k") ?? "");
      eventLog.push(`search:${keyword.replace(/\+/g, " ")}`);
    }
    return actionResult("opened");
  },
  scroll: async () => actionResult("scrolled"),
  click: async () => actionResult("clicked"),
  clickLocatedDomElement: async () => actionResult("clicked-dom"),
  textInput: async () => actionResult("text-input"),
  screenshotRegion: async () => ({
    ...actionResult("screenshot"),
    pageUrl: openedUrls.at(-1) ?? "about:blank",
    pageTitle: "Amazon keyword review acceptance",
    regionLabel: "acceptance",
    regionType: "viewport",
    width: 1200,
    height: 900,
    viewportWidth: 1200,
    viewportHeight: 900,
    sourceFilePath: "/tmp/keyword-review-acceptance.png",
  }),
  evaluateActiveTab: async <T,>({ description }: Parameters<BrowserController["evaluateActiveTab"]>[0]): Promise<T> => {
    let result: unknown;
    if (description.includes("search results")) {
      const keyword = currentKeyword();
      const product = productsByKeyword[keyword];
      result = {
        items: [{
          asin: product.asin,
          title: product.title,
          productUrl: `https://www.amazon.com/dp/${product.asin}`,
          price: product.price,
          rating: product.rating,
          reviewCount: product.reviewCount,
          mainImageUrl: `https://images.example/${product.asin}.jpg`,
          isSponsored: false,
          rankPosition: 1,
          primeOrFba: "Prime",
          couponText: null,
        }],
        rawText: `${product.title} ${product.price} ${product.reviewCount}`,
      };
    } else if (description.includes("product detail")) {
      const asin = currentAsin();
      result = {
        asin,
        title: `Detail ${asin}`,
        brand: "Acceptance Brand",
        sellerOrStore: "Acceptance Store",
        currentPrice: asin === "B0ALPHA001" ? "$29.00" : "$64.00",
        origOrCoupon: null,
        mainImage: `https://images.example/${asin}.jpg`,
        allVisibleImages: [`https://images.example/${asin}.jpg`],
        bulletPoints: ["Acceptance bullet 1", "Acceptance bullet 2"],
        aboutThisItem: "Acceptance about this item",
        productDescription: `Description ${asin}`,
        technicalDetails: `Tech ${asin}`,
        bestSellersRankIfVisible: asin === "B0ALPHA001" ? "#21 in Storage" : "#7 in Kitchen",
        rating: asin === "B0ALPHA001" ? "4.4 out of 5 stars" : "4.0 out of 5 stars",
        reviewCount: asin === "B0ALPHA001" ? "212 ratings" : "98 ratings",
        deliveryInfo: "Ships in 2 days",
        variationOptions: null,
        colorOpts: null,
        rawText: `detail ${asin}`,
      };
    } else {
      const asin = currentAsin();
      result = {
        reviews: [{
          reviewIdNative: `${asin}-review-1`,
          title: `Review ${asin}`,
          body: `Body ${asin}`,
          rating: asin === "B0ALPHA001" ? "5.0 out of 5 stars" : "3.0 out of 5 stars",
          reviewDate: "Reviewed on May 20, 2026",
          verifiedPurchase: true,
          helpfulCount: "3 people found this helpful",
          reviewerName: `Reviewer ${asin}`,
          variant: null,
          rawSnap: `Raw ${asin}`,
        }],
        hasNextPage: false,
      };
    }
    return result as T;
  },
  setFileInputFiles: async () => actionResult("files-set"),
  wait: async () => actionResult("waited"),
  closeActiveTab: async () => actionResult("closed-tab"),
  close: async () => actionResult("closed"),
} satisfies BrowserController;

const aiInputGateway: AiInputGatewayAbilityGroup = {
  abilityGroupId: "ai-input-gateway",
  listChildCapabilityIds: () => ["feed-gpt-web-chat-once"],
  async execute(input) {
    const promptContractId = (input as { promptContractId?: string }).promptContractId;
    if (promptContractId === "amazon-product-mining-keyword-opportunity-review-v1") {
      const reviewInput = input as {
        inputRefs?: Array<{ id?: string; kind?: string; summary?: string; filePath?: string }>;
        maxInputChars?: number;
      };
      assert.equal(reviewInput.maxInputChars, 300_000);
      assert.equal(Array.isArray(reviewInput.inputRefs), true);
      assert.equal(reviewInput.inputRefs?.length, 1);
      assert.equal(reviewInput.inputRefs?.[0]?.kind, "amazon-product-mining-keyword-evidence-slice");
      assert.equal(typeof reviewInput.inputRefs?.[0]?.summary, "string");
      assert.equal(reviewInput.inputRefs?.[0]?.filePath, undefined);
      eventLog.push(`review:${String((input as { roundId?: string }).roundId ?? "missing")}`);
      return createKeywordReviewGatewayResponse();
    }
    return createKeywordMiningGatewayResponse();
  },
};

try {
  const result = await runAmazonProductMiningFlow({
    taskId,
    dataDir,
    browser,
    aiInputGateway,
    runtimeLogger: createRuntimeLogger({ terminalEnabled: false }),
    providerKind: "gpt-web-chat",
    miningInput: {
      amazonMarketplace: "amazon.com",
      targetMarket: "US",
      productDirection: "home and kitchen",
      requestedKeywordCount: 2,
      languagePreference: "en",
      providerKind: "gpt-web-chat",
    },
    reviewMaxPages: 1,
  });

  assert.equal(result.status, "package_completed");
  const storage = createAmazonMiningStorage(dataDir);
  try {
    const keywordReviews = storage.listKeywordOpportunityReviews({ taskId });
    assert.equal(keywordReviews.length, 2);
    assert.equal(keywordReviews.every((review) => review.status === "completed"), true);
    assert.equal(new Set(keywordReviews.map((review) => review.keyword)).size, 2);
    assert.equal(keywordReviews.every((review) => existsSync(review.packageRef ?? "")), true);
    assert.equal(keywordReviews.every((review) => existsSync(review.aiResponseRef ?? "")), true);
  } finally {
    storage.close();
  }

  const firstSearchIndex = eventLog.indexOf("search:keyword alpha");
  const firstReviewIndex = eventLog.findIndex((entry) => entry.startsWith("review:"));
  const secondSearchIndex = eventLog.indexOf("search:keyword beta");
  assert.equal(firstSearchIndex >= 0, true);
  assert.equal(firstReviewIndex > firstSearchIndex, true);
  assert.equal(secondSearchIndex > firstReviewIndex, true);

  process.stdout.write("[ACCEPTANCE-PASS] amazon-product-mining-keyword-opportunity-review\n");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
