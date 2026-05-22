import Database from "better-sqlite3";

import {
  FacebookProductVideoMiningSchemas,
  type FacebookProductVideoMiningContracts,
} from "./facebook-product-video-mining.schema.js";

type FacebookProductVideoMiningRunStatus = FacebookProductVideoMiningContracts["FacebookProductVideoMiningRunStatus"];
type FacebookProductVideoMiningSelectionExport = FacebookProductVideoMiningContracts["FacebookProductVideoMiningSelectionExport"];
type FacebookProductVideoMiningSelectionExportItem = FacebookProductVideoMiningContracts["FacebookProductVideoMiningSelectionExportItem"];

type SelectionExportRow = {
  id: string;
  runId: string;
  sourcePageUrl: string;
  facebookVideoId: string | null;
  pageTitle: string | null;
  authorText: string | null;
  captionText: string | null;
  likeCount: number | null;
  commentCountDisplayed: number | null;
  commentsLoadedCount: number;
  aiConfidence: number | null;
  aiReason: string | null;
  videoArtifactRef: string | null;
  videoFilePath: string | null;
  videoSha256: string | null;
  createdAt: string;
  parsedJson: string | null;
};

const SAVED_SELECTION_ROWS_SQL = `
  SELECT
    c.id,
    c.run_id AS runId,
    c.source_page_url AS sourcePageUrl,
    c.facebook_video_id AS facebookVideoId,
    c.page_title AS pageTitle,
    c.author_text AS authorText,
    c.caption_text AS captionText,
    c.like_count AS likeCount,
    c.comment_count_displayed AS commentCountDisplayed,
    c.comments_loaded_count AS commentsLoadedCount,
    c.ai_confidence AS aiConfidence,
    c.ai_reason AS aiReason,
    c.video_artifact_ref AS videoArtifactRef,
    c.video_file_path AS videoFilePath,
    c.video_sha256 AS videoSha256,
    c.created_at AS createdAt,
    j.parsed_json AS parsedJson
  FROM facebook_product_video_candidates c
  LEFT JOIN facebook_product_video_ai_judgments j ON j.candidate_id = c.id
  WHERE c.run_id = ?
    AND c.status = 'saved'
    AND c.ai_selected_option_id = 'PRODUCT_SEEDING'
  ORDER BY c.created_at ASC, c.round_index ASC
`;

const parseJudgmentJson = (value: string | null): Record<string, unknown> => {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String).filter((item) => item.trim().length > 0) : [];

const toSelectionExportItem = (
  row: SelectionExportRow,
  index: number,
): FacebookProductVideoMiningSelectionExportItem => {
  const parsed = parseJudgmentJson(row.parsedJson);
  return FacebookProductVideoMiningSchemas.FacebookProductVideoMiningSelectionExportItemSchema.parse({
    candidateId: row.id,
    runId: row.runId,
    rank: index + 1,
    sourcePageUrl: row.sourcePageUrl,
    facebookVideoId: row.facebookVideoId,
    pageTitle: row.pageTitle,
    authorText: row.authorText,
    captionText: row.captionText,
    likeCount: row.likeCount,
    commentCountDisplayed: row.commentCountDisplayed,
    commentsLoadedCount: row.commentsLoadedCount,
    aiConfidence: row.aiConfidence,
    aiReason: row.aiReason,
    visibleProduct: typeof parsed.visibleProduct === "string" ? parsed.visibleProduct : null,
    productCategory: typeof parsed.productCategory === "string" ? parsed.productCategory : null,
    sellingIntentSignals: stringArray(parsed.sellingIntentSignals),
    evidenceFromVideo: stringArray(parsed.evidenceFromVideo),
    videoArtifactRef: row.videoArtifactRef,
    videoFilePath: row.videoFilePath,
    videoSha256: row.videoSha256,
    createdAt: row.createdAt,
  });
};

export const createFacebookMiningSelectionExportStore = (db: Database.Database) => {
  const listSavedRows = db.prepare(SAVED_SELECTION_ROWS_SQL);
  return {
    listSavedSelectionRecords(runId: string): FacebookProductVideoMiningSelectionExportItem[] {
      return (listSavedRows.all(runId) as SelectionExportRow[]).map(toSelectionExportItem);
    },
    buildSelectionExport(run: FacebookProductVideoMiningRunStatus): FacebookProductVideoMiningSelectionExport {
      const records = (listSavedRows.all(run.runId) as SelectionExportRow[]).map(toSelectionExportItem);
      return FacebookProductVideoMiningSchemas.FacebookProductVideoMiningSelectionExportSchema.parse({
        exportKind: "facebook-product-video-mining.selection.v1",
        exportedAt: new Date().toISOString(),
        run,
        savedProductCount: records.length,
        targetProductCount: run.targetProductCount,
        records,
      });
    },
  };
};
