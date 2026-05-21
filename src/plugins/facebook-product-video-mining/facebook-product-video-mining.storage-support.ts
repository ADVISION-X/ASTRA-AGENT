import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import {
  FacebookProductVideoMiningSchemas,
  type FacebookProductVideoMiningContracts,
} from "./facebook-product-video-mining.schema.js";
import {
  FACEBOOK_PRODUCT_VIDEO_MINING_DB_RELATIVE_PATH,
  FACEBOOK_PRODUCT_VIDEO_MINING_SCHEMA_SQL,
} from "./facebook-product-video-mining.storage-schema.js";

type FacebookProductVideoCandidateRecord = FacebookProductVideoMiningContracts["FacebookProductVideoCandidateRecord"];
type FacebookProductVideoMiningRunStatus = FacebookProductVideoMiningContracts["FacebookProductVideoMiningRunStatus"];

export type CandidateRow = {
  id: string;
  mission_id: string;
  run_id: string;
  round_id: string | null;
  round_index: number;
  source_page_url: string;
  facebook_video_id: string | null;
  page_title: string | null;
  author_text: string | null;
  caption_text: string | null;
  like_count: number | null;
  comment_count_displayed: number | null;
  comments_loaded_count: number;
  comments_complete: number;
  comment_stop_reason: string | null;
  ai_selected_option_id: string | null;
  ai_confidence: number | null;
  ai_reason: string | null;
  video_artifact_ref: string | null;
  video_file_path: string | null;
  video_sha256: string | null;
  video_byte_size: number | null;
  video_content_type: string | null;
  video_artifact_disposition: "staging" | "final" | null;
  status: FacebookProductVideoCandidateRecord["status"];
  not_interested_status: string | null;
  created_at: string;
  updated_at: string | null;
};

export type RunRow = {
  runId: string;
  missionId: string;
  feedEntryUrl: string;
  providerKind: FacebookProductVideoMiningRunStatus["providerKind"];
  targetProductCount: number;
  maxRounds: number;
  status: FacebookProductVideoMiningRunStatus["status"];
  startedAt: string;
  endedAt: string | null;
  failureReason: string | null;
  savedProductCount: number;
  scannedCount: number;
  currentRoundId: string | null;
  currentRoundIndex: number | null;
};

export const mapRunRow = (row: RunRow): FacebookProductVideoMiningRunStatus =>
  FacebookProductVideoMiningSchemas.FacebookProductVideoMiningRunStatusSchema.parse(row);

export const mapCandidateRow = (row: CandidateRow): FacebookProductVideoCandidateRecord =>
  FacebookProductVideoMiningSchemas.FacebookProductVideoCandidateRecordSchema.parse({
    id: row.id,
    missionId: row.mission_id,
    runId: row.run_id,
    roundId: row.round_id ?? "",
    roundIndex: row.round_index,
    sourcePageUrl: row.source_page_url,
    facebookVideoId: row.facebook_video_id,
    pageTitle: row.page_title,
    authorText: row.author_text,
    captionText: row.caption_text,
    likeCount: row.like_count,
    commentCountDisplayed: row.comment_count_displayed,
    commentsLoadedCount: row.comments_loaded_count,
    commentsComplete: row.comments_complete === 1,
    commentStopReason: row.comment_stop_reason,
    aiSelectedOptionId: row.ai_selected_option_id,
    aiConfidence: row.ai_confidence,
    aiReason: row.ai_reason,
    videoArtifactRef: row.video_artifact_ref,
    videoFilePath: row.video_file_path,
    videoSha256: row.video_sha256,
    videoByteSize: row.video_byte_size,
    videoContentType: row.video_content_type,
    videoArtifactDisposition: row.video_artifact_disposition,
    status: row.status,
    notInterestedStatus: row.not_interested_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

export const resolveFacebookMiningDbPath = (dataDir: string): string =>
  path.join(dataDir, FACEBOOK_PRODUCT_VIDEO_MINING_DB_RELATIVE_PATH);

export const createFacebookMiningDatabase = (dataDir: string): Database.Database => {
  const dbPath = resolveFacebookMiningDbPath(dataDir);
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  for (const statement of FACEBOOK_PRODUCT_VIDEO_MINING_SCHEMA_SQL) {
    db.exec(statement);
  }
  return db;
};