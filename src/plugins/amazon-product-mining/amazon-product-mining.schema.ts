import { z } from "zod";

import {
  AmazonFieldDisclosureMapSchema,
  AmazonFieldDisclosureReasonSchema,
  AmazonFieldDisclosureSchema,
} from "./amazon-product-mining.field-disclosure-schema.js";

const AmazonMarketplaceSchema = z.enum([
  "amazon.com",
  "amazon.co.uk",
  "amazon.de",
  "amazon.co.jp",
  "amazon.fr",
  "amazon.it",
  "amazon.es",
  "amazon.ca",
  "amazon.com.au",
  "amazon.com.br",
  "amazon.com.mx",
  "amazon.nl",
  "amazon.se",
  "amazon.pl",
  "amazon.ae",
  "amazon.sg",
  "amazon.com.tr",
]);

const AmazonTaskStatusSchema = z.enum([
  "created",
  "keyword_generating",
  "keyword_ready",
  "mining",
  "packaging",
  "package_completed",
  "failed",
  "manual_required",
  "paused",
  "terminated",
]);

const AmazonKeywordStatusSchema = z.enum([
  "pending",
  "searching",
  "search_completed",
  "completed",
  "completed_with_errors",
  "failed",
  "manual_required",
]);

const AmazonProductStatusSchema = z.enum([
  "pending_detail",
  "detail_extracting",
  "detail_completed",
  "review_extracting",
  "completed",
  "completed_with_errors",
  "failed",
  "manual_required",
]);

const AmazonHandoffStatusSchema = z.enum([
  "not_started",
  "ready",
  "handoff_completed",
  "failed",
]);

const AmazonKeywordOpportunityDecisionSchema = z.enum([
  "PASS",
  "WATCH",
  "REJECT",
  "INSUFFICIENT_DATA",
]);

const AmazonKeywordOpportunityStrengthSchema = z.enum([
  "strong",
  "medium",
  "weak",
  "insufficient",
]);

const AmazonKeywordOpportunityHumanNextStepSchema = z.enum([
  "enter_next_validation",
  "mine_related_keywords",
  "reject",
  "rerun_or_collect_more_data",
]);

const AmazonKeywordOpportunityReviewStatusSchema = z.enum([
  "completed",
  "failed",
]);

const AmazonKeywordProviderKindSchema = z.enum([
  "gemini-api",
  "gemini-web-chat",
  "gpt-web-chat",
]);

const AmazonKeywordHistoryPolicySchema = z.enum([
  "new_keywords_only",
  "refresh_historical_keywords",
]);

const AmazonKeywordHistoryRelationSchema = z.enum([
  "new_keyword",
  "historical_refresh",
]);

const AmazonMiningInputSchema = z.object({
  taskId: z.string().min(1).optional(),
  amazonMarketplace: AmazonMarketplaceSchema,
  targetMarket: z.string().min(1),
  productDirection: z.string().min(1),
  requestedKeywordCount: z.number().int().positive().default(10),
  languagePreference: z.string().min(1).default("en"),
  providerKind: AmazonKeywordProviderKindSchema,
  keywordHistoryPolicy: AmazonKeywordHistoryPolicySchema.default("new_keywords_only"),
}).strict();

const AmazonKeywordRecordSchema = z.object({
  keywordId: z.string().min(1),
  taskId: z.string().min(1),
  keyword: z.string().min(1),
  source: z.literal("ai_generated"),
  aiRunId: z.string().min(1).nullable(),
  reason: z.string().nullable().default(null),
  keywordHistoryRelation: AmazonKeywordHistoryRelationSchema.default("new_keyword"),
  status: AmazonKeywordStatusSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1).nullable().default(null),
}).strict();

const AmazonSearchResultItemSchema = z.object({
  itemId: z.string().min(1),
  keywordId: z.string().min(1),
  taskId: z.string().min(1),
  keyword: z.string().min(1),
  searchUrl: z.string().min(1),
  rankPosition: z.number().int().nonnegative(),
  isSponsored: z.boolean(),
  title: z.string().nullable().default(null),
  productUrl: z.string().min(1),
  asinIfAvailable: z.string().nullable().default(null),
  mainImageUrl: z.string().nullable().default(null),
  price: z.string().nullable().default(null),
  originalPriceOrDiscountIfVisible: z.string().nullable().default(null),
  rating: z.string().nullable().default(null),
  reviewCount: z.string().nullable().default(null),
  primeOrFbaFlagIfVisible: z.string().nullable().default(null),
  couponTextIfVisible: z.string().nullable().default(null),
  deliveryTextIfVisible: z.string().nullable().default(null),
  rawVisibleTextSnapshot: z.string().nullable().default(null),
  fieldDisclosureMap: AmazonFieldDisclosureMapSchema,
  createdAt: z.string().min(1),
}).strict();

const amazonProductDetailIdentityShape = {
  detailId: z.string().min(1),
  taskId: z.string().min(1),
  asin: z.string().nullable().default(null),
  productUrl: z.string().min(1),
  title: z.string().nullable().default(null),
  brand: z.string().nullable().default(null),
  sellerOrStoreIfVisible: z.string().nullable().default(null),
  currentPrice: z.string().nullable().default(null),
  originalPriceDiscountCouponIfVisible: z.string().nullable().default(null),
};

const amazonProductDetailContentShape = {
  mainImage: z.string().nullable().default(null),
  allVisibleImages: z.array(z.string()).default([]),
  visibleVideoInfo: z.string().nullable().default(null),
  bulletPoints: z.array(z.string()).default([]),
  aboutThisItem: z.string().nullable().default(null),
  productDescription: z.string().nullable().default(null),
  aPlusContentIfVisible: z.string().nullable().default(null),
  aPlusImageUrls: z.array(z.string()).default([]),
  variationOptions: z.string().nullable().default(null),
  colorSizeStyleOptions: z.string().nullable().default(null),
};

const amazonProductDetailCommerceShape = {
  productInformation: z.string().nullable().default(null),
  technicalDetails: z.string().nullable().default(null),
  additionalInformation: z.string().nullable().default(null),
  bestSellersRankIfVisible: z.string().nullable().default(null),
  categoryPathIfVisible: z.string().nullable().default(null),
  rating: z.string().nullable().default(null),
  reviewCount: z.string().nullable().default(null),
  boughtInPastMonthIfVisible: z.string().nullable().default(null),
  starDistribution: z.string().nullable().default(null),
  qaContentIfVisible: z.string().nullable().default(null),
  frequentlyBoughtTogetherIfVisible: z.string().nullable().default(null),
  customersAlsoBoughtIfVisible: z.string().nullable().default(null),
  compareWithSimilarItemsIfVisible: z.string().nullable().default(null),
  deliveryInformation: z.string().nullable().default(null),
  returnInformation: z.string().nullable().default(null),
  allOtherVisibleProductParameters: z.string().nullable().default(null),
};

const amazonProductDetailStatusShape = {
  rawVisibleTextSnapshot: z.string().nullable().default(null),
  fieldDisclosureMap: AmazonFieldDisclosureMapSchema,
  status: AmazonProductStatusSchema,
  failureReason: z.string().nullable().default(null),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1).nullable().default(null),
};

const AmazonProductDetailSchema = z.object({
  ...amazonProductDetailIdentityShape,
  ...amazonProductDetailContentShape,
  ...amazonProductDetailCommerceShape,
  ...amazonProductDetailStatusShape,
}).strict();

const AmazonReviewRecordSchema = z.object({
  reviewId: z.string().min(1),
  detailId: z.string().min(1),
  taskId: z.string().min(1),
  asin: z.string().nullable().default(null),
  pageIndex: z.number().int().nonnegative(),
  reviewIdIfAvailable: z.string().nullable().default(null),
  reviewerName: z.string().nullable().default(null),
  rating: z.string().nullable().default(null),
  reviewTitle: z.string().nullable().default(null),
  reviewBody: z.string().nullable().default(null),
  reviewDate: z.string().nullable().default(null),
  verifiedPurchase: z.boolean().nullable().default(null),
  variant: z.string().nullable().default(null),
  helpfulCountIfVisible: z.string().nullable().default(null),
  reviewImagesIfVisible: z.array(z.string()).default([]),
  reviewVideosIfVisible: z.array(z.string()).default([]),
  reviewLanguage: z.string().nullable().default(null),
  reviewRegionIfVisible: z.string().nullable().default(null),
  rawReviewTextSnapshot: z.string().nullable().default(null),
  fieldDisclosureMap: AmazonFieldDisclosureMapSchema,
  createdAt: z.string().min(1),
}).strict();

const AmazonTaskRecordSchema = z.object({
  taskId: z.string().min(1),
  amazonMarketplace: AmazonMarketplaceSchema,
  targetMarket: z.string().min(1),
  productDirection: z.string().min(1),
  requestedKeywordCount: z.number().int().positive(),
  languagePreference: z.string().min(1),
  providerKind: AmazonKeywordProviderKindSchema.default("gpt-web-chat"),
  keywordHistoryPolicy: AmazonKeywordHistoryPolicySchema.default("new_keywords_only"),
  status: AmazonTaskStatusSchema,
  failureReason: z.string().nullable().default(null),
  packageJsonPath: z.string().nullable().default(null),
  pdfReportPath: z.string().nullable().default(null),
  evidenceIndexPath: z.string().nullable().default(null),
  exceptionSummaryPath: z.string().nullable().default(null),
  handoffStatus: AmazonHandoffStatusSchema.default("not_started"),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1).nullable().default(null),
}).strict();

const AmazonKeywordOpportunityVerdictSchema = z.object({
  decision: AmazonKeywordOpportunityDecisionSchema,
  demandSignal: AmazonKeywordOpportunityStrengthSchema,
  reviewHealth: AmazonKeywordOpportunityStrengthSchema,
  priceCeiling: AmazonKeywordOpportunityStrengthSchema,
  competitionOpenness: AmazonKeywordOpportunityStrengthSchema,
  improvementOpportunity: AmazonKeywordOpportunityStrengthSchema,
  dataConfidence: AmazonKeywordOpportunityStrengthSchema,
  evidenceRefs: z.array(z.string().min(1)).default([]),
  missingEvidence: z.array(z.string().min(1)).default([]),
  riskPoints: z.array(z.string().min(1)).default([]),
  humanNextStep: AmazonKeywordOpportunityHumanNextStepSchema,
}).strict();

const AmazonKeywordOpportunityReviewRecordSchema = z.object({
  reviewId: z.string().min(1),
  taskId: z.string().min(1),
  keywordId: z.string().min(1),
  keyword: z.string().min(1),
  status: AmazonKeywordOpportunityReviewStatusSchema,
  decision: AmazonKeywordOpportunityDecisionSchema.nullable().default(null),
  demandSignal: AmazonKeywordOpportunityStrengthSchema.nullable().default(null),
  reviewHealth: AmazonKeywordOpportunityStrengthSchema.nullable().default(null),
  priceCeiling: AmazonKeywordOpportunityStrengthSchema.nullable().default(null),
  competitionOpenness: AmazonKeywordOpportunityStrengthSchema.nullable().default(null),
  improvementOpportunity: AmazonKeywordOpportunityStrengthSchema.nullable().default(null),
  dataConfidence: AmazonKeywordOpportunityStrengthSchema.nullable().default(null),
  evidenceRefs: z.array(z.string().min(1)).default([]),
  missingEvidence: z.array(z.string().min(1)).default([]),
  riskPoints: z.array(z.string().min(1)).default([]),
  humanNextStep: AmazonKeywordOpportunityHumanNextStepSchema.nullable().default(null),
  aiPromptText: z.string().default(""),
  aiRawResponse: z.string().default(""),
  aiResponseRef: z.string().nullable().default(null),
  packageRef: z.string().nullable().default(null),
  keywordPackageSliceRef: z.string().nullable().default(null),
  failureReason: z.string().nullable().default(null),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1).nullable().default(null),
}).strict();

export const AmazonMiningSchemas = {
  AmazonMiningInputSchema,
  AmazonMarketplaceSchema,
  AmazonTaskStatusSchema,
  AmazonKeywordStatusSchema,
  AmazonProductStatusSchema,
  AmazonFieldDisclosureReasonSchema,
  AmazonFieldDisclosureSchema,
  AmazonFieldDisclosureMapSchema,
  AmazonHandoffStatusSchema,
  AmazonKeywordOpportunityDecisionSchema,
  AmazonKeywordOpportunityStrengthSchema,
  AmazonKeywordOpportunityHumanNextStepSchema,
  AmazonKeywordOpportunityReviewStatusSchema,
  AmazonKeywordProviderKindSchema,
  AmazonKeywordHistoryPolicySchema,
  AmazonKeywordHistoryRelationSchema,
  AmazonKeywordRecordSchema,
  AmazonSearchResultItemSchema,
  AmazonProductDetailSchema,
  AmazonReviewRecordSchema,
  AmazonTaskRecordSchema,
  AmazonKeywordOpportunityVerdictSchema,
  AmazonKeywordOpportunityReviewRecordSchema,
} as const;

export type AmazonMiningInput = z.infer<typeof AmazonMiningInputSchema>;
export type AmazonTaskRecord = z.infer<typeof AmazonTaskRecordSchema>;
export type AmazonKeywordRecord = z.infer<typeof AmazonKeywordRecordSchema>;
export type AmazonSearchResultItem = z.infer<typeof AmazonSearchResultItemSchema>;
export type AmazonProductDetail = z.infer<typeof AmazonProductDetailSchema>;
export type AmazonReviewRecord = z.infer<typeof AmazonReviewRecordSchema>;
export type AmazonTaskStatus = z.infer<typeof AmazonTaskStatusSchema>;
export type AmazonKeywordStatus = z.infer<typeof AmazonKeywordStatusSchema>;
export type AmazonProductStatus = z.infer<typeof AmazonProductStatusSchema>;
export type AmazonHandoffStatus = z.infer<typeof AmazonHandoffStatusSchema>;
export type AmazonKeywordOpportunityDecision = z.infer<typeof AmazonKeywordOpportunityDecisionSchema>;
export type AmazonKeywordOpportunityStrength = z.infer<typeof AmazonKeywordOpportunityStrengthSchema>;
export type AmazonKeywordOpportunityHumanNextStep = z.infer<typeof AmazonKeywordOpportunityHumanNextStepSchema>;
export type AmazonKeywordOpportunityReviewStatus = z.infer<typeof AmazonKeywordOpportunityReviewStatusSchema>;
export type AmazonKeywordOpportunityVerdict = z.infer<typeof AmazonKeywordOpportunityVerdictSchema>;
export type AmazonKeywordOpportunityReviewRecord = z.infer<typeof AmazonKeywordOpportunityReviewRecordSchema>;
export type AmazonKeywordProviderKind = z.infer<typeof AmazonKeywordProviderKindSchema>;
export type AmazonKeywordHistoryPolicy = z.infer<typeof AmazonKeywordHistoryPolicySchema>;
export type AmazonKeywordHistoryRelation = z.infer<typeof AmazonKeywordHistoryRelationSchema>;
