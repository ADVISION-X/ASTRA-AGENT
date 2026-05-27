import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import {
  AMAZON_PRODUCT_MINING_DB_RELATIVE_PATH,
  AMAZON_PRODUCT_MINING_SCHEMA_SQL,
} from "./amazon-product-mining.storage-schema.js";
import {
  ensureAmazonMiningStorageColumns,
  rowToAiKeywordRun,
  rowToDetail,
  rowToKeyword,
  rowToKeywordOpportunityReview,
  rowToReview,
  rowToSearchItem,
  rowToTask,
} from "./amazon-product-mining.storage-support.js";
import type {
  AmazonKeywordRecord,
  AmazonKeywordOpportunityDecision,
  AmazonKeywordOpportunityReviewRecord,
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
  getAiKeywordRunsForTask(taskId: string): Array<{
    runId: string;
    taskId: string;
    promptText: string;
    rawResponse: string;
    parsedKeywords: string[];
    dedupedKeywords: string[];
    status: string;
    failureReason: string | null;
    createdAt: string;
  }>;
  saveKeywordOpportunityReview(review: AmazonKeywordOpportunityReviewRecord): AmazonKeywordOpportunityReviewRecord;
  getKeywordOpportunityReview(reviewId: string): AmazonKeywordOpportunityReviewRecord | null;
  listKeywordOpportunityReviews(input?: { taskId?: string; decision?: AmazonKeywordOpportunityDecision; }): AmazonKeywordOpportunityReviewRecord[];
  persistSearchResults(items: readonly AmazonSearchResultItem[]): void;
  getSearchResultsForKeyword(keywordId: string): AmazonSearchResultItem[];
  persistProductDetail(detail: AmazonProductDetail, linkedItemIds: readonly string[]): void;
  updateProductStatus(input: { detailId: string; status: AmazonProductStatus; failureReason?: string | null; }): void;
  getProductDetailsForTask(taskId: string): AmazonProductDetail[];
  getProductDetail(detailId: string): AmazonProductDetail | null;
  getSearchResultProductLinksForTask(taskId: string): Array<{ itemId: string; detailId: string }>;
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
  ensureAmazonMiningStorageColumns(db);
  return db;
};

const createTaskOperations = (
  db: Database.Database,
): Pick<AmazonMiningStorage, "createTask" | "updateTaskStatus" | "getTask" | "getLatestTask"> => {
  const getTask = (taskId: string): AmazonTaskRecord | null => {
    const row = db.prepare("SELECT * FROM amazon_mining_tasks WHERE task_id=?").get(taskId);
    return row ? rowToTask(row as Record<string, unknown>) : null;
  };

  return {
    createTask(task) {
      db.prepare(`INSERT INTO amazon_mining_tasks (
        task_id, amazon_marketplace, target_market, product_direction, requested_keyword_count,
        language_preference, status, handoff_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        task.taskId, task.amazonMarketplace, task.targetMarket, task.productDirection,
        task.requestedKeywordCount, task.languagePreference, task.status,
        task.handoffStatus, task.createdAt,
      );
      return getTask(task.taskId)!;
    },

    updateTaskStatus({ taskId, status, failureReason, packageJsonPath, pdfReportPath, evidenceIndexPath, exceptionSummaryPath, handoffStatus }) {
      db.prepare(`UPDATE amazon_mining_tasks SET status=?, failure_reason=?, package_json_path=?,
        pdf_report_path=?, evidence_index_path=?, exception_summary_path=?,
        handoff_status=COALESCE(?, handoff_status), updated_at=? WHERE task_id=?`).run(
        status, failureReason ?? null, packageJsonPath ?? null, pdfReportPath ?? null,
        evidenceIndexPath ?? null, exceptionSummaryPath ?? null,
        handoffStatus ?? null, new Date().toISOString(), taskId,
      );
      return getTask(taskId);
    },

    getTask,

    getLatestTask() {
      const row = db.prepare("SELECT * FROM amazon_mining_tasks ORDER BY created_at DESC LIMIT 1").get();
      return row ? rowToTask(row as Record<string, unknown>) : null;
    },
  };
};

const createKeywordOperations = (
  db: Database.Database,
): Pick<AmazonMiningStorage, "saveKeywords" | "updateKeywordStatus" | "getKeywordsForTask" | "getAllMinedKeywordsForDedup" | "saveAiKeywordRun" | "getAiKeywordRunsForTask"> => ({
  saveKeywords(keywords) {
    const stmt = db.prepare(`INSERT OR IGNORE INTO amazon_mining_keywords (
      keyword_id, task_id, keyword, source, ai_run_id, reason, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const keyword of keywords) {
      stmt.run(keyword.keywordId, keyword.taskId, keyword.keyword, keyword.source, keyword.aiRunId, keyword.reason, keyword.status, keyword.createdAt);
    }
  },

  updateKeywordStatus({ keywordId, status }) {
    db.prepare("UPDATE amazon_mining_keywords SET status=?, updated_at=? WHERE keyword_id=?")
      .run(status, new Date().toISOString(), keywordId);
  },

  getKeywordsForTask(taskId) {
    const rows = db.prepare("SELECT * FROM amazon_mining_keywords WHERE task_id=? ORDER BY created_at ASC").all(taskId);
    return rows.map((row) => rowToKeyword(row as Record<string, unknown>));
  },

  getAllMinedKeywordsForDedup() {
    const rows = db.prepare("SELECT DISTINCT keyword FROM amazon_mining_keywords").all() as Array<{ keyword: string }>;
    return rows.map((row) => row.keyword);
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

  getAiKeywordRunsForTask(taskId) {
    const rows = db.prepare("SELECT * FROM amazon_mining_ai_keyword_runs WHERE task_id=? ORDER BY created_at ASC").all(taskId);
    return rows.map((row) => rowToAiKeywordRun(row as Record<string, unknown>));
  },
});

const createSearchOperations = (
  db: Database.Database,
): Pick<AmazonMiningStorage, "persistSearchResults" | "getSearchResultsForKeyword"> => ({
  persistSearchResults(items) {
    const stmt = db.prepare(`INSERT OR IGNORE INTO amazon_mining_search_results (
      item_id, keyword_id, task_id, keyword, search_url, rank_position, is_sponsored,
      title, product_url, asin_if_available, main_image_url, price,
      original_price_or_discount_if_visible, rating, review_count,
      prime_or_fba_flag_if_visible, coupon_text_if_visible, delivery_text_if_visible,
      raw_visible_text_snapshot, field_disclosure_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const item of items) {
      stmt.run(
        item.itemId, item.keywordId, item.taskId, item.keyword, item.searchUrl,
        item.rankPosition, item.isSponsored ? 1 : 0, item.title, item.productUrl,
        item.asinIfAvailable, item.mainImageUrl, item.price,
        item.originalPriceOrDiscountIfVisible, item.rating, item.reviewCount,
        item.primeOrFbaFlagIfVisible, item.couponTextIfVisible, item.deliveryTextIfVisible,
        item.rawVisibleTextSnapshot, JSON.stringify(item.fieldDisclosureMap), item.createdAt,
      );
    }
  },

  getSearchResultsForKeyword(keywordId) {
    const rows = db.prepare("SELECT * FROM amazon_mining_search_results WHERE keyword_id=? ORDER BY rank_position ASC").all(keywordId);
    return rows.map((row) => rowToSearchItem(row as Record<string, unknown>));
  },
});

const createKeywordReviewOperations = (
  db: Database.Database,
): Pick<AmazonMiningStorage, "saveKeywordOpportunityReview" | "getKeywordOpportunityReview" | "listKeywordOpportunityReviews"> => ({
  saveKeywordOpportunityReview(review) {
    db.prepare(`INSERT INTO amazon_mining_keyword_opportunity_reviews (
      review_id, task_id, keyword_id, keyword, status, decision, demand_signal,
      review_health, price_ceiling, competition_openness, improvement_opportunity,
      data_confidence, human_next_step, evidence_refs_json, missing_evidence_json,
      risk_points_json, ai_prompt_text, ai_raw_response, ai_response_ref, package_ref,
      keyword_package_slice_ref, failure_reason, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(review_id) DO UPDATE SET
      status=excluded.status,
      decision=excluded.decision,
      demand_signal=excluded.demand_signal,
      review_health=excluded.review_health,
      price_ceiling=excluded.price_ceiling,
      competition_openness=excluded.competition_openness,
      improvement_opportunity=excluded.improvement_opportunity,
      data_confidence=excluded.data_confidence,
      human_next_step=excluded.human_next_step,
      evidence_refs_json=excluded.evidence_refs_json,
      missing_evidence_json=excluded.missing_evidence_json,
      risk_points_json=excluded.risk_points_json,
      ai_prompt_text=excluded.ai_prompt_text,
      ai_raw_response=excluded.ai_raw_response,
      ai_response_ref=excluded.ai_response_ref,
      package_ref=excluded.package_ref,
      keyword_package_slice_ref=excluded.keyword_package_slice_ref,
      failure_reason=excluded.failure_reason,
      updated_at=excluded.updated_at`).run(
      review.reviewId,
      review.taskId,
      review.keywordId,
      review.keyword,
      review.status,
      review.decision,
      review.demandSignal,
      review.reviewHealth,
      review.priceCeiling,
      review.competitionOpenness,
      review.improvementOpportunity,
      review.dataConfidence,
      review.humanNextStep,
      JSON.stringify(review.evidenceRefs),
      JSON.stringify(review.missingEvidence),
      JSON.stringify(review.riskPoints),
      review.aiPromptText,
      review.aiRawResponse,
      review.aiResponseRef,
      review.packageRef,
      review.keywordPackageSliceRef,
      review.failureReason,
      review.createdAt,
      review.updatedAt,
    );
    return this.getKeywordOpportunityReview(review.reviewId)!;
  },

  getKeywordOpportunityReview(reviewId) {
    const row = db.prepare("SELECT * FROM amazon_mining_keyword_opportunity_reviews WHERE review_id=?").get(reviewId);
    return row ? rowToKeywordOpportunityReview(row as Record<string, unknown>) : null;
  },

  listKeywordOpportunityReviews(input) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (input?.taskId) {
      conditions.push("task_id=?");
      values.push(input.taskId);
    }
    if (input?.decision) {
      conditions.push("decision=?");
      values.push(input.decision);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = db.prepare(`
      SELECT * FROM amazon_mining_keyword_opportunity_reviews
      ${whereClause}
      ORDER BY created_at DESC, review_id DESC
    `).all(...values) as Array<Record<string, unknown>>;
    return rows.map((row) => rowToKeywordOpportunityReview(row));
  },
});

const createProductOperations = (
  db: Database.Database,
): Pick<AmazonMiningStorage, "persistProductDetail" | "updateProductStatus" | "getProductDetailsForTask" | "getProductDetail"> => ({
  persistProductDetail(detail, linkedItemIds) {
    db.prepare(`INSERT OR REPLACE INTO amazon_mining_product_details (
      detail_id, task_id, asin, product_url, title, brand, seller_or_store_if_visible,
      current_price, original_price_discount_coupon_if_visible, main_image,
      all_visible_images_json, visible_video_info, bullet_points_json, about_this_item,
      product_description, a_plus_content_if_visible, a_plus_image_urls_json, variation_options,
      color_size_style_options, product_information, technical_details,
      additional_information, best_sellers_rank_if_visible, category_path_if_visible,
      rating, review_count, star_distribution, qa_content_if_visible,
      frequently_bought_together_if_visible, customers_also_bought_if_visible,
      compare_with_similar_items_if_visible, delivery_information, return_information,
      all_other_visible_product_parameters, raw_visible_text_snapshot, field_disclosure_json, status,
      failure_reason, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      detail.detailId, detail.taskId, detail.asin, detail.productUrl, detail.title,
      detail.brand, detail.sellerOrStoreIfVisible, detail.currentPrice,
      detail.originalPriceDiscountCouponIfVisible, detail.mainImage,
      JSON.stringify(detail.allVisibleImages), detail.visibleVideoInfo,
      JSON.stringify(detail.bulletPoints), detail.aboutThisItem, detail.productDescription,
      detail.aPlusContentIfVisible, JSON.stringify(detail.aPlusImageUrls),
      detail.variationOptions, detail.colorSizeStyleOptions,
      detail.productInformation, detail.technicalDetails, detail.additionalInformation,
      detail.bestSellersRankIfVisible, detail.categoryPathIfVisible, detail.rating,
      detail.reviewCount, detail.starDistribution, detail.qaContentIfVisible,
      detail.frequentlyBoughtTogetherIfVisible, detail.customersAlsoBoughtIfVisible,
      detail.compareWithSimilarItemsIfVisible, detail.deliveryInformation,
      detail.returnInformation, detail.allOtherVisibleProductParameters,
      detail.rawVisibleTextSnapshot, JSON.stringify(detail.fieldDisclosureMap), detail.status, detail.failureReason,
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
    return rows.map((row) => rowToDetail(row as Record<string, unknown>));
  },

  getProductDetail(detailId) {
    const row = db.prepare("SELECT * FROM amazon_mining_product_details WHERE detail_id=?").get(detailId);
    return row ? rowToDetail(row as Record<string, unknown>) : null;
  },
});

const createReviewOperations = (
  db: Database.Database,
): Pick<AmazonMiningStorage, "persistReviews" | "getReviewsForProduct"> => ({
  persistReviews(reviews) {
    const stmt = db.prepare(`INSERT OR IGNORE INTO amazon_mining_reviews (
      review_id, detail_id, task_id, asin, page_index, review_id_if_available,
      reviewer_name, rating, review_title, review_body, review_date, verified_purchase,
      variant, helpful_count_if_visible, review_images_if_visible_json,
      review_videos_if_visible_json, review_language, review_region_if_visible,
      raw_review_text_snapshot, field_disclosure_json, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const review of reviews) {
      stmt.run(
        review.reviewId, review.detailId, review.taskId, review.asin, review.pageIndex,
        review.reviewIdIfAvailable, review.reviewerName, review.rating, review.reviewTitle,
        review.reviewBody, review.reviewDate,
        review.verifiedPurchase === null ? null : (review.verifiedPurchase ? 1 : 0),
        review.variant, review.helpfulCountIfVisible,
        JSON.stringify(review.reviewImagesIfVisible), JSON.stringify(review.reviewVideosIfVisible),
        review.reviewLanguage, review.reviewRegionIfVisible, review.rawReviewTextSnapshot,
        JSON.stringify(review.fieldDisclosureMap), review.createdAt,
      );
    }
  },

  getReviewsForProduct(detailId) {
    const rows = db.prepare("SELECT * FROM amazon_mining_reviews WHERE detail_id=? ORDER BY page_index ASC, created_at ASC").all(detailId);
    return rows.map((row) => rowToReview(row as Record<string, unknown>));
  },
});

const createTraceabilityOperations = (
  db: Database.Database,
): Pick<AmazonMiningStorage, "getSearchResultProductLinksForTask"> => ({
  getSearchResultProductLinksForTask(taskId) {
    const rows = db.prepare(`
      SELECT link.item_id, link.detail_id
      FROM amazon_mining_search_result_product_link AS link
      INNER JOIN amazon_mining_search_results AS search_result
        ON search_result.item_id = link.item_id
      WHERE search_result.task_id = ?
      ORDER BY link.item_id ASC, link.detail_id ASC
    `).all(taskId) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      itemId: row["item_id"] as string,
      detailId: row["detail_id"] as string,
    }));
  },
});

const createExceptionOperations = (
  db: Database.Database,
): Pick<AmazonMiningStorage, "persistException" | "getExceptionsForTask"> => ({
  persistException({ exceptionId, taskId, scope, scopeId, exceptionKind, message }) {
    db.prepare(`INSERT OR IGNORE INTO amazon_mining_exception_records (
      exception_id, task_id, scope, scope_id, exception_kind, message, created_at
    ) VALUES (?,?,?,?,?,?,?)`).run(
      exceptionId, taskId, scope, scopeId ?? null, exceptionKind, message, new Date().toISOString(),
    );
  },

  getExceptionsForTask(taskId) {
    const rows = db.prepare("SELECT * FROM amazon_mining_exception_records WHERE task_id=? ORDER BY created_at ASC").all(taskId) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      exceptionId: row["exception_id"] as string,
      scope: row["scope"] as string,
      scopeId: (row["scope_id"] as string | null) ?? null,
      exceptionKind: row["exception_kind"] as string,
      message: row["message"] as string,
      createdAt: row["created_at"] as string,
    }));
  },
});

export const createAmazonMiningStorage = (dataDir: string): AmazonMiningStorage => {
  const db = createAmazonMiningDatabase(dataDir);
  const dbPath = resolveDbPath(dataDir);

  return {
    dbPath,
    ...createTaskOperations(db),
    ...createKeywordOperations(db),
    ...createKeywordReviewOperations(db),
    ...createSearchOperations(db),
    ...createProductOperations(db),
    ...createTraceabilityOperations(db),
    ...createReviewOperations(db),
    ...createExceptionOperations(db),
    close() {
      db.close();
    },
  };
};
