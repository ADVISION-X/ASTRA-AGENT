import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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
  listChildCapabilityIds: () => ["feed-gpt-web-chat-once"],
  async execute(input) {
    assert.equal((input as { providerKind?: unknown }).providerKind, "gpt-web-chat", "Full cycle must use the selected GPT web chat provider");
    const promptContractId = (input as { promptContractId?: string }).promptContractId;
    if (promptContractId === "amazon-product-mining-keyword-opportunity-review-v1") {
      const reviewInput = input as {
        inputRefs?: Array<{ id?: string; kind?: string; summary?: string; filePath?: string }>;
        maxInputChars?: number;
      };
      assert.equal(reviewInput.maxInputChars, 900_000);
      assert.equal(reviewInput.inputRefs?.length, 1);
      assert.equal(reviewInput.inputRefs?.[0]?.kind, "amazon-product-mining-keyword-evidence-slice");
      assert.equal(typeof reviewInput.inputRefs?.[0]?.id, "string");
      assert.equal(reviewInput.inputRefs?.[0]?.filePath, undefined);
    }
    const normalizedText = promptContractId === "amazon-product-mining-keyword-opportunity-review-v1"
      ? JSON.stringify({
          decision: "PASS",
          demandSignal: "strong",
          reviewHealth: "medium",
          priceCeiling: "medium",
          competitionOpenness: "medium",
          improvementOpportunity: "strong",
          dataConfidence: "medium",
          evidenceRefs: ["keyword-search-evidence"],
          missingEvidence: [],
          riskPoints: ["single keyword acceptance fixture"],
          humanNextStep: "enter_next_validation",
        })
      : JSON.stringify({ keywords: [{ keyword: "foldable storage box uae", reason: "portable China supply item" }] });
    return {
      abilityGroupId: "ai-input-gateway",
      childCapabilityId: "feed-gpt-web-chat-once",
      providerKind: "gpt-web-chat",
      status: "success",
      normalizedText,
      rawOutputRef: null,
      rawOutputHash: null,
      parseStatus: "json_valid",
      parsedJson: null,
      schemaValidationStatus: "not_applicable",
      providerProof: {
        providerKind: "gpt-web-chat",
        modelName: null,
        inputHash: "input-hash",
        outputHash: "output-hash",
        inputRefs: [],
        outputRefs: [],
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: 0,
        transport: "web-chat",
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
    providerKind: "gpt-web-chat",
    miningInput: {
      amazonMarketplace: "amazon.ae",
      targetMarket: "United Arab Emirates / 阿联酋",
      productDirection: "适合以中国为供应产地，拿到阿联酋销售的产品",
      requestedKeywordCount: 1,
      languagePreference: "zh-CN",
      providerKind: "gpt-web-chat",
    },
    reviewMaxPages: 2,
  });

  assert.equal(result.status, "package_completed");
  assert.equal(path.basename(result.packageJsonPath ?? ""), "amazon-product-mining-package.json");
  assert.equal(path.basename(result.pdfReportPath ?? ""), "Amazon-Product-Mining-Master-Evidence-Report.pdf");
  assert.equal(path.basename(result.evidenceIndexPath ?? ""), "evidence-index.json");
  assert.equal(path.basename(result.exceptionSummaryPath ?? ""), "exception-summary.json");
  const handoffRecordPath = path.join(path.dirname(result.packageJsonPath ?? ""), "05-ai-handoff", "handoff-record.json");
  assert.ok(existsSync(handoffRecordPath), "Success flow must persist a handoff record file");
  assert.ok(openedUrls.some((url) => url.startsWith("https://www.amazon.ae/s?k=")), "Search must open amazon.ae");
  assert.ok(openedUrls.includes("https://www.amazon.ae/dp/B0AEACCEPT1"), "Detail page must open the ASIN URL");
  assert.ok(openedUrls.includes("https://www.amazon.ae/product-reviews/B0AEACCEPT1"), "Review page must open for the ASIN");

  const dataPackage = JSON.parse(readFileSync(result.packageJsonPath!, "utf8")) as {
    task: { productDetailRankLimit: number | null };
    products: Array<{ asin: string | null; reviews: { jsonlRef: string | null; summaryRef: string | null } }>;
    reviewsIndex: Array<{ detailId: string }>;
  };
  const evidenceIndex = JSON.parse(readFileSync(result.evidenceIndexPath!, "utf8")) as {
    artifacts: Array<{ artifactId: string; fileRef: string }>;
  };
  assert.equal(dataPackage.task.productDetailRankLimit, 30);
  assert.equal(dataPackage.products[0]?.asin, "B0AEACCEPT1");
  assert.equal(Boolean(dataPackage.products[0]?.reviews.jsonlRef), true);
  assert.equal(Boolean(dataPackage.products[0]?.reviews.summaryRef), true);
  assert.equal(dataPackage.reviewsIndex.length, 1);
  assert.ok(evidenceIndex.artifacts.some((artifact) => artifact.artifactId === "handoff-record" && artifact.fileRef === "05-ai-handoff/handoff-record.json"));
  assert.equal(readFileSync(result.pdfReportPath!).subarray(0, 5).toString("utf8"), "%PDF-");

  const failureDataDir = mkdtempSync(path.join(os.tmpdir(), "amazon-mining-all-failed-"));
  const searchFailureBrowser = {
    ...browser,
    evaluateActiveTab: async <T,>({ description }: Parameters<BrowserController["evaluateActiveTab"]>[0]): Promise<T> => {
      if (description.includes("search results")) return null as T;
      return browser.evaluateActiveTab<T>({ script: "", description });
    },
  } satisfies BrowserController;
  try {
    const failureResult = await runAmazonProductMiningFlow({
      taskId: "amazon-all-keywords-failed-acceptance",
      dataDir: failureDataDir,
      browser: searchFailureBrowser,
      aiInputGateway,
      runtimeLogger: createRuntimeLogger({ terminalEnabled: false }),
      providerKind: "gpt-web-chat",
      miningInput: {
        amazonMarketplace: "amazon.ae",
        targetMarket: "United Arab Emirates / 阿联酋",
        productDirection: "适合以中国为供应产地，拿到阿联酋销售的产品",
        requestedKeywordCount: 1,
        languagePreference: "zh-CN",
        providerKind: "gpt-web-chat",
      },
      reviewMaxPages: 1,
    });
    assert.equal(failureResult.status, "failed");
    assert.match(failureResult.failureReason ?? "", /all_keywords_failed/);
    assert.equal(failureResult.handoffStatus, "failed");
    assert.ok(failureResult.packageJsonPath, "Failure data package must still be written");
    const failureHandoffRecordPath = path.join(path.dirname(failureResult.packageJsonPath!), "05-ai-handoff", "handoff-record.json");
    assert.ok(existsSync(failureHandoffRecordPath), "Failure flow must still persist a handoff record file");
    const failurePackage = JSON.parse(readFileSync(failureResult.packageJsonPath!, "utf8")) as {
      task: { status: string };
      exceptions: unknown[];
      completeness: { summary: { failedCount: number } };
    };
    const failureEvidenceIndex = JSON.parse(readFileSync(failureResult.evidenceIndexPath!, "utf8")) as {
      artifacts: Array<{ artifactId: string; fileRef: string }>;
    };
    assert.equal(failurePackage.task.status, "failed");
    assert.equal(failurePackage.exceptions.length, 1);
    assert.equal(failurePackage.completeness.summary.failedCount, 3);
    assert.ok(failureEvidenceIndex.artifacts.some((artifact) => artifact.artifactId === "handoff-record" && artifact.fileRef === "05-ai-handoff/handoff-record.json"));
  } finally {
    rmSync(failureDataDir, { recursive: true, force: true });
  }

  process.stdout.write("[ACCEPTANCE-PASS] amazon-product-mining-full-cycle\n");
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
