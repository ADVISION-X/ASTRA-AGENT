import type Database from "better-sqlite3";
import { z } from "zod";

import type {
  AmazonHandoffStatus,
  AmazonKeywordRecord,
  AmazonKeywordOpportunityDecision,
  AmazonKeywordOpportunityHumanNextStep,
  AmazonKeywordOpportunityReviewRecord,
  AmazonKeywordOpportunityReviewStatus,
  AmazonKeywordOpportunityStrength,
  AmazonKeywordStatus,
  AmazonProductDetail,
  AmazonProductStatus,
  AmazonReviewRecord,
  AmazonSearchResultItem,
  AmazonTaskRecord,
  AmazonTaskStatus,
} from "./amazon-product-mining.schema.js";
import { AmazonFieldDisclosureMapSchema } from "./amazon-product-mining.field-disclosure-schema.js";

type AmazonFieldDisclosureMap = z.infer<typeof AmazonFieldDisclosureMapSchema>;

type StorageRow = Record<string, unknown>;

const parseStringArray = (value: unknown): string[] =>
  value ? (JSON.parse(value as string) as string[]) : [];

const parseFieldDisclosureMap = (value: unknown): AmazonFieldDisclosureMap =>
  value ? (JSON.parse(value as string) as AmazonFieldDisclosureMap) : {};

const ensureTableColumns = (
  db: Database.Database,
  tableName: string,
  columns: ReadonlyArray<{ columnName: string; definition: string }>,
): void => {
  const existingColumns = new Set(
    (db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>).map((row) => row.name),
  );
  for (const column of columns) {
    if (existingColumns.has(column.columnName)) {
      continue;
    }
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${column.columnName} ${column.definition}`);
  }
};

export const ensureAmazonMiningStorageColumns = (db: Database.Database): void => {
  ensureTableColumns(db, "amazon_mining_search_results", [
    { columnName: "field_disclosure_json", definition: "TEXT" },
  ]);
  ensureTableColumns(db, "amazon_mining_product_details", [
    { columnName: "field_disclosure_json", definition: "TEXT" },
    { columnName: "a_plus_image_urls_json", definition: "TEXT" },
  ]);
  ensureTableColumns(db, "amazon_mining_reviews", [
    { columnName: "field_disclosure_json", definition: "TEXT" },
  ]);
  ensureTableColumns(db, "amazon_mining_keyword_opportunity_reviews", [
    { columnName: "status", definition: "TEXT NOT NULL DEFAULT 'failed'" },
    { columnName: "decision", definition: "TEXT" },
    { columnName: "demand_signal", definition: "TEXT" },
    { columnName: "review_health", definition: "TEXT" },
    { columnName: "price_ceiling", definition: "TEXT" },
    { columnName: "competition_openness", definition: "TEXT" },
    { columnName: "improvement_opportunity", definition: "TEXT" },
    { columnName: "data_confidence", definition: "TEXT" },
    { columnName: "human_next_step", definition: "TEXT" },
    { columnName: "evidence_refs_json", definition: "TEXT NOT NULL DEFAULT '[]'" },
    { columnName: "missing_evidence_json", definition: "TEXT NOT NULL DEFAULT '[]'" },
    { columnName: "risk_points_json", definition: "TEXT NOT NULL DEFAULT '[]'" },
    { columnName: "ai_prompt_text", definition: "TEXT NOT NULL DEFAULT ''" },
    { columnName: "ai_raw_response", definition: "TEXT NOT NULL DEFAULT ''" },
    { columnName: "ai_response_ref", definition: "TEXT" },
    { columnName: "package_ref", definition: "TEXT" },
    { columnName: "keyword_package_slice_ref", definition: "TEXT" },
    { columnName: "failure_reason", definition: "TEXT" },
    { columnName: "updated_at", definition: "TEXT" },
  ]);
};

export const rowToTask = (row: StorageRow): AmazonTaskRecord => ({
  taskId: row["task_id"] as string,
  amazonMarketplace: row["amazon_marketplace"] as AmazonTaskRecord["amazonMarketplace"],
  targetMarket: row["target_market"] as string,
  productDirection: row["product_direction"] as string,
  requestedKeywordCount: row["requested_keyword_count"] as number,
  languagePreference: row["language_preference"] as string,
  status: row["status"] as AmazonTaskStatus,
  failureReason: (row["failure_reason"] as string | null) ?? null,
  packageJsonPath: (row["package_json_path"] as string | null) ?? null,
  pdfReportPath: (row["pdf_report_path"] as string | null) ?? null,
  evidenceIndexPath: (row["evidence_index_path"] as string | null) ?? null,
  exceptionSummaryPath: (row["exception_summary_path"] as string | null) ?? null,
  handoffStatus: (row["handoff_status"] as AmazonHandoffStatus) ?? "not_started",
  createdAt: row["created_at"] as string,
  updatedAt: (row["updated_at"] as string | null) ?? null,
});

export const rowToKeyword = (row: StorageRow): AmazonKeywordRecord => ({
  keywordId: row["keyword_id"] as string,
  taskId: row["task_id"] as string,
  keyword: row["keyword"] as string,
  source: "ai_generated",
  aiRunId: (row["ai_run_id"] as string | null) ?? null,
  reason: (row["reason"] as string | null) ?? null,
  status: row["status"] as AmazonKeywordStatus,
  createdAt: row["created_at"] as string,
  updatedAt: (row["updated_at"] as string | null) ?? null,
});

export const rowToSearchItem = (row: StorageRow): AmazonSearchResultItem => ({
  itemId: row["item_id"] as string,
  keywordId: row["keyword_id"] as string,
  taskId: row["task_id"] as string,
  keyword: row["keyword"] as string,
  searchUrl: row["search_url"] as string,
  rankPosition: row["rank_position"] as number,
  isSponsored: (row["is_sponsored"] as number) === 1,
  title: (row["title"] as string | null) ?? null,
  productUrl: row["product_url"] as string,
  asinIfAvailable: (row["asin_if_available"] as string | null) ?? null,
  mainImageUrl: (row["main_image_url"] as string | null) ?? null,
  price: (row["price"] as string | null) ?? null,
  originalPriceOrDiscountIfVisible: (row["original_price_or_discount_if_visible"] as string | null) ?? null,
  rating: (row["rating"] as string | null) ?? null,
  reviewCount: (row["review_count"] as string | null) ?? null,
  primeOrFbaFlagIfVisible: (row["prime_or_fba_flag_if_visible"] as string | null) ?? null,
  couponTextIfVisible: (row["coupon_text_if_visible"] as string | null) ?? null,
  deliveryTextIfVisible: (row["delivery_text_if_visible"] as string | null) ?? null,
  rawVisibleTextSnapshot: (row["raw_visible_text_snapshot"] as string | null) ?? null,
  fieldDisclosureMap: parseFieldDisclosureMap(row["field_disclosure_json"]),
  createdAt: row["created_at"] as string,
});

const buildDetailIdentity = (row: StorageRow) => ({
  detailId: row["detail_id"] as string,
  taskId: row["task_id"] as string,
  asin: (row["asin"] as string | null) ?? null,
  productUrl: row["product_url"] as string,
  title: (row["title"] as string | null) ?? null,
  brand: (row["brand"] as string | null) ?? null,
  sellerOrStoreIfVisible: (row["seller_or_store_if_visible"] as string | null) ?? null,
  currentPrice: (row["current_price"] as string | null) ?? null,
  originalPriceDiscountCouponIfVisible: (row["original_price_discount_coupon_if_visible"] as string | null) ?? null,
});

const buildDetailContent = (row: StorageRow) => ({
  mainImage: (row["main_image"] as string | null) ?? null,
  allVisibleImages: parseStringArray(row["all_visible_images_json"]),
  visibleVideoInfo: (row["visible_video_info"] as string | null) ?? null,
  bulletPoints: parseStringArray(row["bullet_points_json"]),
  aboutThisItem: (row["about_this_item"] as string | null) ?? null,
  productDescription: (row["product_description"] as string | null) ?? null,
  aPlusContentIfVisible: (row["a_plus_content_if_visible"] as string | null) ?? null,
  aPlusImageUrls: parseStringArray(row["a_plus_image_urls_json"]),
  variationOptions: (row["variation_options"] as string | null) ?? null,
  colorSizeStyleOptions: (row["color_size_style_options"] as string | null) ?? null,
});

const buildDetailCommerce = (row: StorageRow) => ({
  productInformation: (row["product_information"] as string | null) ?? null,
  technicalDetails: (row["technical_details"] as string | null) ?? null,
  additionalInformation: (row["additional_information"] as string | null) ?? null,
  bestSellersRankIfVisible: (row["best_sellers_rank_if_visible"] as string | null) ?? null,
  categoryPathIfVisible: (row["category_path_if_visible"] as string | null) ?? null,
  rating: (row["rating"] as string | null) ?? null,
  reviewCount: (row["review_count"] as string | null) ?? null,
  starDistribution: (row["star_distribution"] as string | null) ?? null,
  qaContentIfVisible: (row["qa_content_if_visible"] as string | null) ?? null,
  frequentlyBoughtTogetherIfVisible: (row["frequently_bought_together_if_visible"] as string | null) ?? null,
  customersAlsoBoughtIfVisible: (row["customers_also_bought_if_visible"] as string | null) ?? null,
  compareWithSimilarItemsIfVisible: (row["compare_with_similar_items_if_visible"] as string | null) ?? null,
  deliveryInformation: (row["delivery_information"] as string | null) ?? null,
  returnInformation: (row["return_information"] as string | null) ?? null,
  allOtherVisibleProductParameters: (row["all_other_visible_product_parameters"] as string | null) ?? null,
});

const buildDetailStatus = (row: StorageRow) => ({
  rawVisibleTextSnapshot: (row["raw_visible_text_snapshot"] as string | null) ?? null,
  fieldDisclosureMap: parseFieldDisclosureMap(row["field_disclosure_json"]),
  status: row["status"] as AmazonProductStatus,
  failureReason: (row["failure_reason"] as string | null) ?? null,
  createdAt: row["created_at"] as string,
  updatedAt: (row["updated_at"] as string | null) ?? null,
});

export const rowToDetail = (row: StorageRow): AmazonProductDetail => ({
  ...buildDetailIdentity(row),
  ...buildDetailContent(row),
  ...buildDetailCommerce(row),
  ...buildDetailStatus(row),
});

export const rowToReview = (row: StorageRow): AmazonReviewRecord => ({
  reviewId: row["review_id"] as string,
  detailId: row["detail_id"] as string,
  taskId: row["task_id"] as string,
  asin: (row["asin"] as string | null) ?? null,
  pageIndex: row["page_index"] as number,
  reviewIdIfAvailable: (row["review_id_if_available"] as string | null) ?? null,
  reviewerName: (row["reviewer_name"] as string | null) ?? null,
  rating: (row["rating"] as string | null) ?? null,
  reviewTitle: (row["review_title"] as string | null) ?? null,
  reviewBody: (row["review_body"] as string | null) ?? null,
  reviewDate: (row["review_date"] as string | null) ?? null,
  verifiedPurchase: row["verified_purchase"] === null ? null : (row["verified_purchase"] as number) === 1,
  variant: (row["variant"] as string | null) ?? null,
  helpfulCountIfVisible: (row["helpful_count_if_visible"] as string | null) ?? null,
  reviewImagesIfVisible: parseStringArray(row["review_images_if_visible_json"]),
  reviewVideosIfVisible: parseStringArray(row["review_videos_if_visible_json"]),
  reviewLanguage: (row["review_language"] as string | null) ?? null,
  reviewRegionIfVisible: (row["review_region_if_visible"] as string | null) ?? null,
  rawReviewTextSnapshot: (row["raw_review_text_snapshot"] as string | null) ?? null,
  fieldDisclosureMap: parseFieldDisclosureMap(row["field_disclosure_json"]),
  createdAt: row["created_at"] as string,
});

export const rowToAiKeywordRun = (row: StorageRow) => ({
  runId: row["run_id"] as string,
  taskId: row["task_id"] as string,
  promptText: row["prompt_text"] as string,
  rawResponse: row["raw_response"] as string,
  parsedKeywords: parseStringArray(row["parsed_keywords_json"]),
  dedupedKeywords: parseStringArray(row["deduped_keywords_json"]),
  status: row["status"] as string,
  failureReason: (row["failure_reason"] as string | null) ?? null,
  createdAt: row["created_at"] as string,
});

export const rowToKeywordOpportunityReview = (row: StorageRow): AmazonKeywordOpportunityReviewRecord => ({
  reviewId: row["review_id"] as string,
  taskId: row["task_id"] as string,
  keywordId: row["keyword_id"] as string,
  keyword: row["keyword"] as string,
  status: row["status"] as AmazonKeywordOpportunityReviewStatus,
  decision: (row["decision"] as AmazonKeywordOpportunityDecision | null) ?? null,
  demandSignal: (row["demand_signal"] as AmazonKeywordOpportunityStrength | null) ?? null,
  reviewHealth: (row["review_health"] as AmazonKeywordOpportunityStrength | null) ?? null,
  priceCeiling: (row["price_ceiling"] as AmazonKeywordOpportunityStrength | null) ?? null,
  competitionOpenness: (row["competition_openness"] as AmazonKeywordOpportunityStrength | null) ?? null,
  improvementOpportunity: (row["improvement_opportunity"] as AmazonKeywordOpportunityStrength | null) ?? null,
  dataConfidence: (row["data_confidence"] as AmazonKeywordOpportunityStrength | null) ?? null,
  evidenceRefs: parseStringArray(row["evidence_refs_json"]),
  missingEvidence: parseStringArray(row["missing_evidence_json"]),
  riskPoints: parseStringArray(row["risk_points_json"]),
  humanNextStep: (row["human_next_step"] as AmazonKeywordOpportunityHumanNextStep | null) ?? null,
  aiPromptText: (row["ai_prompt_text"] as string | null) ?? "",
  aiRawResponse: (row["ai_raw_response"] as string | null) ?? "",
  aiResponseRef: (row["ai_response_ref"] as string | null) ?? null,
  packageRef: (row["package_ref"] as string | null) ?? null,
  keywordPackageSliceRef: (row["keyword_package_slice_ref"] as string | null) ?? null,
  failureReason: (row["failure_reason"] as string | null) ?? null,
  createdAt: row["created_at"] as string,
  updatedAt: (row["updated_at"] as string | null) ?? null,
});
