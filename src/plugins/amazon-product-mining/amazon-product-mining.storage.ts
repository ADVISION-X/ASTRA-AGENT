import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import {
  AMAZON_PRODUCT_MINING_DB_RELATIVE_PATH,
  AMAZON_PRODUCT_MINING_SCHEMA_SQL,
} from "./amazon-product-mining.storage-schema.js";
import type {
  AmazonKeywordRecord,
  AmazonKeywordStatus,
  AmazonProductDetail,
  AmazonProductStatus,
  AmazonReviewRecord,
  AmazonSearchResultItem,
  AmazonTaskRecord,
  AmazonTaskStatus,
  AmazonHandoffStatus,
} from "./amazon-product-mining.schema.js";

export type AmazonMiningStorage = {
  dbPath: string;
  createTask(task: AmazonTaskRecord): AmazonTaskRecord;
  updateTaskStatus(input: {
    taskId: string;
    status: AmazonTaskStatus;
    failureReason?: string | null;
    packageJsonPath?: string | null;
    pdfReportPath?: string | null;
    evidenceIndexPath?: string | null;
    exceptionSummaryPath?: string | null;
    handoffStatus?: AmazonHandoffStatus;
  }): AmazonTaskRecord | null;
  getTask(taskId: string): AmazonTaskRecord | null;
  getLatestTask(): AmazonTaskRecord | null;
  saveKeywords(keywords: readonly AmazonKeywordRecord[]): void;
  updateKeywordStatus(input: { keywordId: string; status: AmazonKeywordStatus; }): void;
  getKeywordsForTask(taskId: string): AmazonKeywordRecord[];
  getAllMinedKeywordsForDedup(): string[];
  saveAiKeywordRun(run: {
    runId: string;
    taskId: string;
    promptText: string;
    rawResponse: string;
    parsedKeywords: string[];
    dedupedKeywords: string[];
    status: string;
    failureReason?: string | null;
  }): void;
  persistSearchResults(items: readonly AmazonSearchResultItem[]): void;
  getSearchResultsForKeyword(keywordId: string): AmazonSearchResultItem[];
  persistProductDetail(detail: AmazonProductDetail, linkedItemIds: readonly string[]): void;
  updateProductStatus(input: { detailId: string; status: AmazonProductStatus; failureReason?: string | null; }): void;
  getProductDetailsForTask(taskId: string): AmazonProductDetail[];
  getProductDetail(detailId: string): AmazonProductDetail | null;
  persistReviews(reviews: readonly AmazonReviewRecord[]): void;
  getReviewsForProduct(detailId: string): AmazonReviewRecord[];
  persistException(input: { exceptionId: string; taskId: string; scope: string; scopeId?: string; exceptionKind: string; message: string; }): void;
  getExceptionsForTask(taskId: string): Array<{ exceptionId: string; scope: string; scopeId: string | null; exceptionKind: string; message: string; createdAt: string; }>;
  close(): void;
};

const resolveDbPath = (dataDir: string): string =>
  path.join(dataDir, AMAZON_PRODUCT_MINING_DB_RELATIVE_PATH);

export const createAmazonMiningDatabase = (dataDir: string): Database.Database => {
  const dbPath = resolveDbPath(dataDir);
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  for (const sql of AMAZON_PRODUCT_MINING_SCHEMA_SQL) {
    db.exec(sql);
  }
  return db;
};

const rowToTask = (row: Record<string, unknown>): AmazonTaskRecord => ({
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

const rowToKeyword = (row: Record<string, unknown>): AmazonKeywordRecord => ({
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

const rowToSearchItem = (row: Record<string, unknown>): AmazonSearchResultItem => ({
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
  createdAt: row["created_at"] as string,
});

const rowToDetail = (row: Record<string, unknown>): AmazonProductDetail => ({
  detailId: row["detail_id"] as string,
  taskId: row["task_id"] as string,
  asin: (row["asin"] as string | null) ?? null,
  productUrl: row["product_url"] as string,
  title: (row["title"] as string | null) ?? null,
  brand: (row["brand"] as string | null) ?? null,
  sellerOrStoreIfVisible: (row["seller_or_store_if_visible"] as string | null) ?? null,
  currentPrice: (row["current_price"] as string | null) ?? null,
  originalPriceDiscountCouponIfVisible: (row["original_price_discount_coupon_if_visible"] as string | null) ?? null,
  mainImage: (row["main_image"] as string | null) ?? null,
  allVisibleImages: row["all_visible_images_json"] ? (JSON.parse(row["all_visible_images_json"] as string) as string[]) : [],
  visibleVideoInfo: (row["visible_video_info"] as string | null) ?? null,
  bulletPoints: row["bullet_points_json"] ? (JSON.parse(row["bullet_points_json"] as string) as string[]) : [],
  aboutThisItem: (row["about_this_item"] as string | null) ?? null,
  productDescription: (row["product_description"] as string | null) ?? null,
  aPlusContentIfVisible: (row["a_plus_content_if_visible"] as string | null) ?? null,
  variationOptions: (row["variation_options"] as string | null) ?? null,
  colorSizeStyleOptions: (row["color_size_style_options"] as string | null) ?? null,
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
  rawVisibleTextSnapshot: (row["raw_visible_text_snapshot"] as string | null) ?? null,
  status: row["status"] as AmazonProductStatus,
  failureReason: (row["failure_reason"] as string | null) ?? null,
  createdAt: row["created_at"] as string,
  updatedAt: (row["updated_at"] as string | null) ?? null,
});

const rowToReview = (row: Record<string, unknown>): AmazonReviewRecord => ({
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
  reviewImagesIfVisible: row["review_images_if_visible_json"] ? (JSON.parse(row["review_images_if_visible_json"] as string) as string[]) : [],
  reviewVideosIfVisible: row["review_videos_if_visible_json"] ? (JSON.parse(row["review_videos_if_visible_json"] as string) as string[]) : [],
  reviewLanguage: (row["review_language"] as string | null) ?? null,
  reviewRegionIfVisible: (row["review_region_if_visible"] as string | null) ?? null,
  rawReviewTextSnapshot: (row["raw_review_text_snapshot"] as string | null) ?? null,
  createdAt: row["created_at"] as string,
});

export const createAmazonMiningStorage = (dataDir: string): AmazonMiningStorage => {
  const db = createAmazonMiningDatabase(dataDir);
  const dbPath = resolveDbPath(dataDir);

  return {
    dbPath,

    createTask(task) {
      db.prepare(`INSERT INTO amazon_mining_tasks (
        task_id, amazon_marketplace, target_market, product_direction, requested_keyword_count,
        language_preference, status, handoff_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        task.taskId, task.amazonMarketplace, task.targetMarket, task.productDirection,
        task.requestedKeywordCount, task.languagePreference, task.status,
        task.handoffStatus, task.createdAt,
      );
      return this.getTask(task.taskId)!;
    },

    updateTaskStatus({ taskId, status, failureReason, packageJsonPath, pdfReportPath, evidenceIndexPath, exceptionSummaryPath, handoffStatus }) {
      db.prepare(`UPDATE amazon_mining_tasks SET status=?, failure_reason=?, package_json_path=?,
        pdf_report_path=?, evidence_index_path=?, exception_summary_path=?,
        handoff_status=COALESCE(?, handoff_status), updated_at=? WHERE task_id=?`).run(
        status, failureReason ?? null, packageJsonPath ?? null, pdfReportPath ?? null,
        evidenceIndexPath ?? null, exceptionSummaryPath ?? null,
        handoffStatus ?? null, new Date().toISOString(), taskId,
      );
      return this.getTask(taskId);
    },

    getTask(taskId) {
      const row = db.prepare("SELECT * FROM amazon_mining_tasks WHERE task_id=?").get(taskId);
      return row ? rowToTask(row as Record<string, unknown>) : null;
    },

    getLatestTask() {
      const row = db.prepare("SELECT * FROM amazon_mining_tasks ORDER BY created_at DESC LIMIT 1").get();
      return row ? rowToTask(row as Record<string, unknown>) : null;
    },

    saveKeywords(keywords) {
      const stmt = db.prepare(`INSERT OR IGNORE INTO amazon_mining_keywords (
        keyword_id, task_id, keyword, source, ai_run_id, reason, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const kw of keywords) {
        stmt.run(kw.keywordId, kw.taskId, kw.keyword, kw.source, kw.aiRunId, kw.reason, kw.status, kw.createdAt);
      }
    },

    updateKeywordStatus({ keywordId, status }) {
      db.prepare("UPDATE amazon_mining_keywords SET status=?, updated_at=? WHERE keyword_id=?")
        .run(status, new Date().toISOString(), keywordId);
    },

    getKeywordsForTask(taskId) {
      const rows = db.prepare("SELECT * FROM amazon_mining_keywords WHERE task_id=? ORDER BY created_at ASC").all(taskId);
      return rows.map((r) => rowToKeyword(r as Record<string, unknown>));
    },

    getAllMinedKeywordsForDedup() {
      const rows = db.prepare("SELECT DISTINCT keyword FROM amazon_mining_keywords").all() as Array<{ keyword: string }>;
      return rows.map((r) => r.keyword);
    },

    saveAiKeywordRun({ runId, taskId, promptText, rawResponse, parsedKeywords, dedupedKeywords, status, failureReason }) {
      db.prepare(`INSERT INTO amazon_mining_ai_keyword_runs (
        run_id, task_id, prompt_text, raw_response, parsed_keywords_json,
        deduped_keywords_json, status, failure_reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        runId, taskId, promptText, rawResponse,
        JSON.stringify(parsedKeywords), JSON.stringify(dedupedKeywords),
        status, failureReason ?? null, new Date().toISOString(),
      );
    },

    persistSearchResults(items) {
      const stmt = db.prepare(`INSERT OR IGNORE INTO amazon_mining_search_results (
        item_id, keyword_id, task_id, keyword, search_url, rank_position, is_sponsored,
        title, product_url, asin_if_available, main_image_url, price,
        original_price_or_discount_if_visible, rating, review_count,
        prime_or_fba_flag_if_visible, coupon_text_if_visible, delivery_text_if_visible,
        raw_visible_text_snapshot, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const item of items) {
        stmt.run(
          item.itemId, item.keywordId, item.taskId, item.keyword, item.searchUrl,
          item.rankPosition, item.isSponsored ? 1 : 0, item.title, item.productUrl,
          item.asinIfAvailable, item.mainImageUrl, item.price,
          item.originalPriceOrDiscountIfVisible, item.rating, item.reviewCount,
          item.primeOrFbaFlagIfVisible, item.couponTextIfVisible, item.deliveryTextIfVisible,
          item.rawVisibleTextSnapshot, item.createdAt,
        );
      }
    },

    getSearchResultsForKeyword(keywordId) {
      const rows = db.prepare("SELECT * FROM amazon_mining_search_results WHERE keyword_id=? ORDER BY rank_position ASC").all(keywordId);
      return rows.map((r) => rowToSearchItem(r as Record<string, unknown>));
    },

    persistProductDetail(detail, linkedItemIds) {
      db.prepare(`INSERT OR REPLACE INTO amazon_mining_product_details (
        detail_id, task_id, asin, product_url, title, brand, seller_or_store_if_visible,
        current_price, original_price_discount_coupon_if_visible, main_image,
        all_visible_images_json, visible_video_info, bullet_points_json, about_this_item,
        product_description, a_plus_content_if_visible, variation_options,
        color_size_style_options, product_information, technical_details,
        additional_information, best_sellers_rank_if_visible, category_path_if_visible,
        rating, review_count, star_distribution, qa_content_if_visible,
        frequently_bought_together_if_visible, customers_also_bought_if_visible,
        compare_with_similar_items_if_visible, delivery_information, return_information,
        all_other_visible_product_parameters, raw_visible_text_snapshot, status,
        failure_reason, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        detail.detailId, detail.taskId, detail.asin, detail.productUrl, detail.title,
        detail.brand, detail.sellerOrStoreIfVisible, detail.currentPrice,
        detail.originalPriceDiscountCouponIfVisible, detail.mainImage,
        JSON.stringify(detail.allVisibleImages), detail.visibleVideoInfo,
        JSON.stringify(detail.bulletPoints), detail.aboutThisItem, detail.productDescription,
        detail.aPlusContentIfVisible, detail.variationOptions, detail.colorSizeStyleOptions,
        detail.productInformation, detail.technicalDetails, detail.additionalInformation,
        detail.bestSellersRankIfVisible, detail.categoryPathIfVisible, detail.rating,
        detail.reviewCount, detail.starDistribution, detail.qaContentIfVisible,
        detail.frequentlyBoughtTogetherIfVisible, detail.customersAlsoBoughtIfVisible,
        detail.compareWithSimilarItemsIfVisible, detail.deliveryInformation,
        detail.returnInformation, detail.allOtherVisibleProductParameters,
        detail.rawVisibleTextSnapshot, detail.status, detail.failureReason,
        detail.createdAt, detail.updatedAt,
      );
      const linkStmt = db.prepare(`INSERT OR IGNORE INTO amazon_mining_search_result_product_link (item_id, detail_id) VALUES (?, ?)`);
      for (const itemId of linkedItemIds) {
        linkStmt.run(itemId, detail.detailId);
      }
    },

    updateProductStatus({ detailId, status, failureReason }) {
      db.prepare("UPDATE amazon_mining_product_details SET status=?, failure_reason=?, updated_at=? WHERE detail_id=?")
        .run(status, failureReason ?? null, new Date().toISOString(), detailId);
    },

    getProductDetailsForTask(taskId) {
      const rows = db.prepare("SELECT * FROM amazon_mining_product_details WHERE task_id=? ORDER BY created_at ASC").all(taskId);
      return rows.map((r) => rowToDetail(r as Record<string, unknown>));
    },

    getProductDetail(detailId) {
      const row = db.prepare("SELECT * FROM amazon_mining_product_details WHERE detail_id=?").get(detailId);
      return row ? rowToDetail(row as Record<string, unknown>) : null;
    },

    persistReviews(reviews) {
      const stmt = db.prepare(`INSERT OR IGNORE INTO amazon_mining_reviews (
        review_id, detail_id, task_id, asin, page_index, review_id_if_available,
        reviewer_name, rating, review_title, review_body, review_date, verified_purchase,
        variant, helpful_count_if_visible, review_images_if_visible_json,
        review_videos_if_visible_json, review_language, review_region_if_visible,
        raw_review_text_snapshot, created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      for (const r of reviews) {
        stmt.run(
          r.reviewId, r.detailId, r.taskId, r.asin, r.pageIndex,
          r.reviewIdIfAvailable, r.reviewerName, r.rating, r.reviewTitle,
          r.reviewBody, r.reviewDate,
          r.verifiedPurchase === null ? null : (r.verifiedPurchase ? 1 : 0),
          r.variant, r.helpfulCountIfVisible,
          JSON.stringify(r.reviewImagesIfVisible), JSON.stringify(r.reviewVideosIfVisible),
          r.reviewLanguage, r.reviewRegionIfVisible, r.rawReviewTextSnapshot, r.createdAt,
        );
      }
    },

    getReviewsForProduct(detailId) {
      const rows = db.prepare("SELECT * FROM amazon_mining_reviews WHERE detail_id=? ORDER BY page_index ASC, created_at ASC").all(detailId);
      return rows.map((r) => rowToReview(r as Record<string, unknown>));
    },

    persistException({ exceptionId, taskId, scope, scopeId, exceptionKind, message }) {
      db.prepare(`INSERT OR IGNORE INTO amazon_mining_exception_records (
        exception_id, task_id, scope, scope_id, exception_kind, message, created_at
      ) VALUES (?,?,?,?,?,?,?)`).run(
        exceptionId, taskId, scope, scopeId ?? null, exceptionKind, message, new Date().toISOString(),
      );
    },

    getExceptionsForTask(taskId) {
      const rows = db.prepare("SELECT * FROM amazon_mining_exception_records WHERE task_id=? ORDER BY created_at ASC").all(taskId) as Array<Record<string, unknown>>;
      return rows.map((r) => ({
        exceptionId: r["exception_id"] as string,
        scope: r["scope"] as string,
        scopeId: (r["scope_id"] as string | null) ?? null,
        exceptionKind: r["exception_kind"] as string,
        message: r["message"] as string,
        createdAt: r["created_at"] as string,
      }));
    },

    close() {
      db.close();
    },
  };
};
