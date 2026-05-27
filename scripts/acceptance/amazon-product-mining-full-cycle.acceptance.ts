import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { AiInputGatewayAbilityGroup } from "../../src/capabilities/ai-input-gateway/index.js";
import type { BrowserActionResult, BrowserController } from "../../src/lib/browser/browser-controller.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { runAmazonProductMiningFlow } from "../../src/plugins/amazon-product-mining/amazon-product-mining.flow.js";

const dataDir = mkdtempSync(path.join(os.tmpdir(), "amazon-mining-full-cycle-"));
const taskId = "amazon-full-cycle-acceptance";
const openedUrls: string[] = [];

const actionResult = (message: string): BrowserActionResult => ({
  browserActionId: `${message}-${Date.now()}`,
  ok: true,
  message,
  createdAt: new Date().toISOString(),
});

const browser = {
  getHealth: () => ({ ok: true, detail: "amazon full-cycle acceptance browser" }),
  getSessionState: () => ({
    open: true,
    browserMode: "fixture" as const,
    browserProfileRef: "acceptance",
    browserExecutablePath: null,
    profileStatus: "profile_ready" as const,
    currentUrl: openedUrls.at(-1) ?? "about:blank",
    currentTitle: "Amazon acceptance",
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
    pageTitle: "Amazon acceptance",
    visibleContentBounds: { x: 0, y: 0, width: 1200, height: 900 },
    capturedAt: new Date().toISOString(),
  }),
  open: async ({ url }) => {
    openedUrls.push(url);
    return actionResult("opened");
  },
  scroll: async () => actionResult("scrolled"),
  click: async () => actionResult("clicked"),
  clickLocatedDomElement: async () => actionResult("clicked-dom"),
  textInput: async () => actionResult("text-input"),
  screenshotRegion: async () => ({
    ...actionResult("screenshot"),
    pageUrl: openedUrls.at(-1) ?? "about:blank",
    pageTitle: "Amazon acceptance",
    regionLabel: "acceptance",
    regionType: "viewport",
    width: 1200,
    height: 900,
    viewportWidth: 1200,
    viewportHeight: 900,
    sourceFilePath: "/tmp/acceptance.png",
  }),
  evaluateActiveTab: async <T,>({ description }: Parameters<BrowserController["evaluateActiveTab"]>[0]): Promise<T> => {
    let result: unknown;
    if (description.includes("search results")) {
      result = {
        items: [{
          asin: "B0AEACCEPT1",
          title: "Foldable Storage Box UAE",
          productUrl: "https://www.amazon.ae/dp/B0AEACCEPT1",
          price: "AED 39.00",
          rating: "4.6 out of 5 stars",
          reviewCount: "88 ratings",
          mainImageUrl: "https://images.example/box.jpg",
          isSponsored: false,
          rankPosition: 1,
          primeOrFba: "Prime",
          couponText: null,
        }],
        rawText: "Foldable Storage Box UAE AED 39.00 Prime",
      };
    } else if (description.includes("product detail")) {
      result = {
        asin: "B0AEACCEPT1",
        title: "Foldable Storage Box UAE",
        brand: "CN Supply",
        sellerOrStore: "CN Supply Store",
        currentPrice: "AED 39.00",
        origOrCoupon: null,
        mainImage: "https://images.example/box.jpg",
        allVisibleImages: ["https://images.example/box.jpg"],
        bulletPoints: ["Foldable", "Lightweight", "Suitable for UAE apartments"],
        aboutThisItem: "Foldable home organizer.",
        productDescription: "A compact storage box for UAE homes.",
        technicalDetails: "Material: PP plastic",
        bestSellersRankIfVisible: "#12 in Storage Boxes",
        rating: "4.6 out of 5 stars",
        reviewCount: "88 ratings",
        deliveryInfo: "FREE delivery in UAE",
        variationOptions: null,
        colorOpts: null,
        rawText: "Foldable Storage Box UAE CN Supply AED 39.00",
      };
    } else {
      result = {
      reviews: [{
        reviewIdNative: "R-AE-1",
        title: "Useful organizer",
        body: "Good size for small apartments.",
        rating: "5.0 out of 5 stars",
        reviewDate: "Reviewed in the United Arab Emirates on May 1, 2026",
        verifiedPurchase: true,
        helpfulCount: "2 people found this helpful",
        reviewerName: "UAE Customer",
        variant: null,
        rawSnap: "Useful organizer Good size for small apartments.",
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
  listChildCapabilityIds: () => ["feed-gemini-api-once"],
  async execute() {
    return {
      abilityGroupId: "ai-input-gateway",
      childCapabilityId: "feed-gemini-api-once",
      providerKind: "gemini-api",
      status: "success",
      normalizedText: JSON.stringify({ keywords: [{ keyword: "foldable storage box uae", reason: "portable China supply item" }] }),
      rawOutputRef: null,
      rawOutputHash: null,
      parseStatus: "json_valid",
      parsedJson: null,
      schemaValidationStatus: "not_applicable",
      providerProof: {
        providerKind: "gemini-api",
        modelName: null,
        inputHash: "input-hash",
        outputHash: "output-hash",
        inputRefs: [],
        outputRefs: [],
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: 0,
        transport: "api",
        webChatUrl: null,
        sourcePageUrlBeforeFeed: null,
        restoredSourcePage: null,
        retryCount: 0,
        cooldownMs: 0,
        estimatedInputTokens: null,
        estimatedOutputTokens: null,
        tokenEstimateUnavailableReason: null,
      },
      failureReason: null,
      reviewRequiredReason: null,
    };
  },
};

try {
  const result = await runAmazonProductMiningFlow({
    taskId,
    dataDir,
    browser,
    aiInputGateway,
    runtimeLogger: createRuntimeLogger({ terminalEnabled: false }),
    miningInput: {
      amazonMarketplace: "amazon.ae",
      targetMarket: "United Arab Emirates / 阿联酋",
      productDirection: "适合以中国为供应产地，拿到阿联酋销售的产品",
      requestedKeywordCount: 1,
      languagePreference: "zh-CN",
    },
    reviewMaxPages: 2,
  });

  assert.equal(result.status, "package_completed");
  assert.equal(path.basename(result.packageJsonPath ?? ""), "amazon-product-mining-package.json");
  assert.equal(path.basename(result.pdfReportPath ?? ""), "amazon-product-mining-report.pdf");
  assert.equal(path.basename(result.evidenceIndexPath ?? ""), "amazon-product-mining-evidence-index.json");
  assert.equal(path.basename(result.exceptionSummaryPath ?? ""), "amazon-product-mining-exception-summary.json");
  assert.ok(openedUrls.some((url) => url.startsWith("https://www.amazon.ae/s?k=")), "Search must open amazon.ae");
  assert.ok(openedUrls.includes("https://www.amazon.ae/dp/B0AEACCEPT1"), "Detail page must open the ASIN URL");
  assert.ok(openedUrls.includes("https://www.amazon.ae/product-reviews/B0AEACCEPT1"), "Review page must open for the ASIN");

  const dataPackage = JSON.parse(readFileSync(result.packageJsonPath!, "utf8")) as {
    products: Array<{ asin: string | null; reviews: unknown[] }>;
  };
  assert.equal(dataPackage.products[0]?.asin, "B0AEACCEPT1");
  assert.equal(dataPackage.products[0]?.reviews.length, 1);
  assert.equal(readFileSync(result.pdfReportPath!).subarray(0, 5).toString("utf8"), "%PDF-");

  process.stdout.write("[ACCEPTANCE-PASS] amazon-product-mining-full-cycle\n");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
