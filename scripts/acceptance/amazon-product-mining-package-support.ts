import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { writeAmazonHandoffRecord } from "../../src/plugins/amazon-product-mining/amazon-product-mining.handoff.js";
import { buildAmazonProductMiningPackage } from "../../src/plugins/amazon-product-mining/amazon-product-mining.package.js";
import { createAmazonPackageLayout } from "../../src/plugins/amazon-product-mining/amazon-product-mining.package-layout.js";
import { buildAmazonProductMiningReport } from "../../src/plugins/amazon-product-mining/amazon-product-mining.pdf.js";
import type { AmazonProductDetail } from "../../src/plugins/amazon-product-mining/amazon-product-mining.package-artifact-builders.js";
import { seedAmazonProductMiningPackageAcceptanceStorage } from "./amazon-product-mining-package-support-seed.js";

const taskId = "task-acceptance";
const keywordRunId = "ai-run-1";

type ProductIdentityFixture = Pick<AmazonProductDetail,
  | "detailId"
  | "taskId"
  | "asin"
  | "productUrl"
  | "title"
  | "brand"
  | "sellerOrStoreIfVisible"
>;

type ProductMediaFixture = Pick<AmazonProductDetail,
  | "mainImage"
  | "allVisibleImages"
  | "aPlusImageUrls"
  | "visibleVideoInfo"
>;

type ProductListingFixture = Pick<AmazonProductDetail,
  | "bulletPoints"
  | "aboutThisItem"
  | "productDescription"
  | "aPlusContentIfVisible"
  | "variationOptions"
  | "colorSizeStyleOptions"
>;

type ProductCommerceFixture = Pick<AmazonProductDetail,
  | "currentPrice"
  | "originalPriceDiscountCouponIfVisible"
  | "rating"
  | "reviewCount"
  | "starDistribution"
  | "productInformation"
  | "technicalDetails"
  | "additionalInformation"
  | "bestSellersRankIfVisible"
  | "categoryPathIfVisible"
  | "deliveryInformation"
  | "returnInformation"
  | "qaContentIfVisible"
  | "frequentlyBoughtTogetherIfVisible"
  | "customersAlsoBoughtIfVisible"
  | "compareWithSimilarItemsIfVisible"
  | "allOtherVisibleProductParameters"
>;

type ProductStatusFixture = Pick<AmazonProductDetail,
  | "fieldDisclosureMap"
  | "rawVisibleTextSnapshot"
  | "status"
  | "failureReason"
  | "createdAt"
  | "updatedAt"
>;

const createProductDetailFixture = (input: {
  identity: ProductIdentityFixture;
  media: ProductMediaFixture;
  listing: ProductListingFixture;
  commerce: ProductCommerceFixture;
  status: ProductStatusFixture;
}): AmazonProductDetail => ({
  ...input.identity,
  ...input.media,
  ...input.listing,
  ...input.commerce,
  ...input.status,
});

const buildSummitLiteProductDetail = (): AmazonProductDetail => createProductDetailFixture({
  identity: {
    detailId: "detail-1",
    taskId,
    asin: "B000000001",
    productUrl: "https://www.amazon.com/dp/B000000001",
    title: "SummitLite Backpacking Stove",
    brand: "SummitLite",
    sellerOrStoreIfVisible: "SummitLite Store",
  },
  media: {
    mainImage: "https://images.example.com/product-1-main.jpg",
    allVisibleImages: [
      "https://images.example.com/product-1-main.jpg",
      "https://images.example.com/product-1-side.jpg",
    ],
    aPlusImageUrls: ["https://images.example.com/product-1-aplus.jpg"],
    visibleVideoInfo: "360 product video",
  },
  listing: {
    bulletPoints: ["11,000 BTU", "Fits backpacking pot"],
    aboutThisItem: "Compact stove for backpacking.",
    productDescription: "Lightweight stove for solo trips.",
    aPlusContentIfVisible: "A+ module visible",
    variationOptions: "Blue, Orange",
    colorSizeStyleOptions: "Standard",
  },
  commerce: {
    currentPrice: "$29.99",
    originalPriceDiscountCouponIfVisible: "$39.99 / Save 10%",
    rating: "4.6",
    reviewCount: "1200",
    starDistribution: "5 star 78%",
    productInformation: "Weight: 73g",
    technicalDetails: "Material: Aluminum alloy",
    additionalInformation: "Made in Taiwan",
    bestSellersRankIfVisible: "#12 in Camping Stoves",
    categoryPathIfVisible: "Sports & Outdoors > Camping",
    deliveryInformation: "Ships in 24 hours",
    returnInformation: "30-day returns",
    qaContentIfVisible: "Q&A available",
    frequentlyBoughtTogetherIfVisible: "Fuel canister",
    customersAlsoBoughtIfVisible: "Titanium pot",
    compareWithSimilarItemsIfVisible: "Compared with 4 products",
    allOtherVisibleProductParameters: "Ignition: manual",
  },
  status: {
    fieldDisclosureMap: {
      title: { reason: "extracted", detail: null },
      currentPrice: { reason: "extracted", detail: null },
      rating: { reason: "extracted", detail: null },
      reviewCount: { reason: "extracted", detail: null },
      rawVisibleTextSnapshot: { reason: "extracted", detail: null },
    },
    rawVisibleTextSnapshot: "Full raw detail snapshot for SummitLite Backpacking Stove",
    status: "completed",
    failureReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  },
});

const buildTrailBurnProductDetail = (): AmazonProductDetail => createProductDetailFixture({
  identity: {
    detailId: "detail-2",
    taskId,
    asin: "B000000002",
    productUrl: "https://www.amazon.com/dp/B000000002",
    title: "TrailBurn Ultralight Stove",
    brand: "TrailBurn",
    sellerOrStoreIfVisible: "TrailBurn Store",
  },
  media: {
    mainImage: "https://images.example.com/product-2-main.jpg",
    allVisibleImages: ["https://images.example.com/product-2-main.jpg"],
    aPlusImageUrls: [],
    visibleVideoInfo: null,
  },
  listing: {
    bulletPoints: ["Piezo ignition"],
    aboutThisItem: "Stove for long-distance hikers.",
    productDescription: "Stable burner head.",
    aPlusContentIfVisible: null,
    variationOptions: null,
    colorSizeStyleOptions: null,
  },
  commerce: {
    currentPrice: "$35.99",
    originalPriceDiscountCouponIfVisible: null,
    rating: "4.4",
    reviewCount: "860",
    starDistribution: null,
    productInformation: "Weight: 89g",
    technicalDetails: "Fuel: isobutane",
    additionalInformation: null,
    bestSellersRankIfVisible: null,
    categoryPathIfVisible: null,
    deliveryInformation: "Ships in 48 hours",
    returnInformation: "30-day returns",
    qaContentIfVisible: null,
    frequentlyBoughtTogetherIfVisible: null,
    customersAlsoBoughtIfVisible: null,
    compareWithSimilarItemsIfVisible: null,
    allOtherVisibleProductParameters: null,
  },
  status: {
    fieldDisclosureMap: {
      title: { reason: "extracted", detail: null },
      currentPrice: { reason: "extracted", detail: null },
      rating: { reason: "extracted", detail: null },
      reviewCount: { reason: "extracted", detail: null },
      rawVisibleTextSnapshot: { reason: "extracted", detail: null },
      visibleVideoInfo: { reason: "not_present", detail: "No visible product video module is shown on the detail page." },
      aPlusContentIfVisible: { reason: "not_present", detail: "A+ content module is not visible on this product page." },
      aPlusImageUrls: { reason: "not_present", detail: "A+ image URLs are not visible on this product page." },
      variationOptions: { reason: "not_present", detail: "Variation module is not visible on this product page." },
      colorSizeStyleOptions: { reason: "not_present", detail: "Color/size/style picker is not visible on this product page." },
      starDistribution: { reason: "not_present", detail: "Star distribution is not visible on this product page." },
      additionalInformation: { reason: "not_present", detail: "Additional information table is not visible on this product page." },
      bestSellersRankIfVisible: { reason: "not_present", detail: "Best sellers rank is not visible on this product page." },
      categoryPathIfVisible: { reason: "not_present", detail: "Category breadcrumb is not visible on this product page." },
      qaContentIfVisible: { reason: "not_present", detail: "Q&A module is not visible on this product page." },
      frequentlyBoughtTogetherIfVisible: { reason: "not_present", detail: "Frequently bought together module is not visible on this product page." },
      customersAlsoBoughtIfVisible: { reason: "not_present", detail: "Customers also bought module is not visible on this product page." },
      compareWithSimilarItemsIfVisible: { reason: "not_present", detail: "Compare with similar items module is not visible on this product page." },
      allOtherVisibleProductParameters: { reason: "not_present", detail: "No additional visible product parameter block is present on this product page." },
    },
    rawVisibleTextSnapshot: "Full raw detail snapshot for TrailBurn Ultralight Stove",
    status: "completed",
    failureReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  },
});

type AcceptancePackageResult = Awaited<ReturnType<typeof buildAmazonProductMiningPackage>>;

const buildAcceptanceReport = (input: {
  dataDir: string;
  packageResult: AcceptancePackageResult;
}) => {
  const report = buildAmazonProductMiningReport({
    taskId,
    dataDir: input.dataDir,
    packageJsonPath: input.packageResult.packageJsonPath,
    productCount: input.packageResult.productCount,
    reviewCount: input.packageResult.reviewCount,
    keywordCount: input.packageResult.keywordCount,
    productDirection: "portable camping stove",
    amazonMarketplace: "amazon.com",
    targetMarket: "US",
  });
  if (!report.ok) {
    throw new Error(report.reason);
  }
  return report;
};

const writeAcceptanceHandoff = (input: {
  dataDir: string;
  packageResult: AcceptancePackageResult;
  reportPath: string;
}) => writeAmazonHandoffRecord({
  dataDir: input.dataDir,
  taskId,
  packageJsonPath: input.packageResult.packageJsonPath,
  reportPath: input.reportPath,
  evidenceIndexPath: input.packageResult.evidenceIndexPath,
  exceptionSummaryPath: input.packageResult.exceptionSummaryPath,
  productCount: input.packageResult.productCount,
  reviewCount: input.packageResult.reviewCount,
  keywordCount: input.packageResult.keywordCount,
  amazonMarketplace: "amazon.com",
  targetMarket: "US",
  productDirection: "portable camping stove",
  requestedKeywordCount: 2,
  languagePreference: "en",
  packageIntegrityStatus: input.packageResult.integrityStatus,
  manualRequiredReasons: [],
});

const markAcceptancePackageCompleted = (input: {
  storage: ReturnType<typeof seedAmazonProductMiningPackageAcceptanceStorage>;
  packageResult: AcceptancePackageResult;
  reportPath: string;
}): void => {
  input.storage.updateTaskStatus({
    taskId,
    status: "package_completed",
    failureReason: null,
    packageJsonPath: input.packageResult.packageJsonPath,
    pdfReportPath: input.reportPath,
    evidenceIndexPath: input.packageResult.evidenceIndexPath,
    exceptionSummaryPath: input.packageResult.exceptionSummaryPath,
    handoffStatus: "ready",
  });
};

export const buildAmazonProductMiningPackageAcceptanceFixture = async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "amazon-mining-package-"));
  const storage = seedAmazonProductMiningPackageAcceptanceStorage({
    dataDir,
    taskId,
    keywordRunId,
    products: [buildSummitLiteProductDetail(), buildTrailBurnProductDetail()],
  });
  const initialPackage = await buildAmazonProductMiningPackage({ taskId, dataDir, storage, reviewMaxPages: 2 });
  const layout = createAmazonPackageLayout({ dataDir, taskId });
  const initialReport = buildAcceptanceReport({ dataDir, packageResult: initialPackage });
  let handoff = writeAcceptanceHandoff({ dataDir, packageResult: initialPackage, reportPath: initialReport.pdfReportPath });
  let finalPackage = await buildAmazonProductMiningPackage({ taskId, dataDir, storage, reviewMaxPages: 2 });
  if (finalPackage.integrityStatus === "pass") {
    markAcceptancePackageCompleted({ storage, packageResult: finalPackage, reportPath: initialReport.pdfReportPath });
    handoff = writeAcceptanceHandoff({ dataDir, packageResult: finalPackage, reportPath: initialReport.pdfReportPath });
    finalPackage = await buildAmazonProductMiningPackage({ taskId, dataDir, storage, reviewMaxPages: 2 });
  }
  return {
    dataDir,
    taskId,
    keywordRunId,
    layout,
    initialPackage,
    initialReport,
    handoff,
    finalPackage,
  };
};
