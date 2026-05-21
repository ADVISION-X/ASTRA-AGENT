import Database from "better-sqlite3";

import {
  FacebookProductVideoMiningSchemas,
  type FacebookProductVideoMiningContracts,
} from "./facebook-product-video-mining.schema.js";
import {
  mapCandidateRow,
  type CandidateRow,
} from "./facebook-product-video-mining.storage-support.js";
import {
  SAVE_AI_JUDGMENT_SQL,
  SAVE_CANDIDATE_SQL,
  SAVE_COMMENT_SQL,
} from "./facebook-product-video-mining.storage-statements.js";

type FacebookCommentRecord = FacebookProductVideoMiningContracts["FacebookCommentRecord"];
type FacebookProductVideoCandidateRecord = FacebookProductVideoMiningContracts["FacebookProductVideoCandidateRecord"];
type FacebookVideoAiJudgment = FacebookProductVideoMiningContracts["FacebookVideoAiJudgment"];

type SaveCandidateInput = {
  candidate: FacebookProductVideoCandidateRecord;
  rawDomProbeJson?: string | null;
};

type SaveAiJudgmentInput = {
  id: string;
  candidateId: string;
  promptContractId: string;
  judgment: FacebookVideoAiJudgment;
};

const prepareCandidateStatements = (db: Database.Database) => ({
  saveCandidateStatement: db.prepare(SAVE_CANDIDATE_SQL),
  selectCandidateStatement: db.prepare(`SELECT * FROM facebook_product_video_candidates WHERE id = ?`),
  saveCommentStatement: db.prepare(SAVE_COMMENT_SQL),
  saveAiJudgmentStatement: db.prepare(SAVE_AI_JUDGMENT_SQL),
  listCandidatesStatement: db.prepare(`
    SELECT *
    FROM facebook_product_video_candidates
    WHERE run_id = ?
    ORDER BY round_index ASC, created_at ASC
  `),
});

const createSaveCandidate = (input: {
  saveCandidateStatement: Database.Statement;
  selectCandidateStatement: Database.Statement;
  updateRunCounters: (runId: string) => void;
}) => (inputValue: SaveCandidateInput): FacebookProductVideoCandidateRecord => {
  const candidate = FacebookProductVideoMiningSchemas.FacebookProductVideoCandidateRecordSchema.parse(inputValue.candidate);
    input.saveCandidateStatement.run(toCandidateParams(candidate, inputValue.rawDomProbeJson ?? null));
    input.updateRunCounters(candidate.runId);
    const row = input.selectCandidateStatement.get(candidate.id) as CandidateRow | undefined;
    if (!row) {
      throw new Error(`Facebook mining candidate not found after save: ${candidate.id}`);
    }
    return mapCandidateRow(row);
  };

const createSaveComments = (input: {
  db: Database.Database;
  saveCommentStatement: Database.Statement;
}) => {
  const saveCommentsTransaction = input.db.transaction((candidateId: string, comments: readonly FacebookCommentRecord[]) => {
    for (const record of comments) {
      const comment = FacebookProductVideoMiningSchemas.FacebookCommentRecordSchema.parse(record);
      input.saveCommentStatement.run(toCommentParams(candidateId, comment));
    }
  });
  return (candidateId: string, comments: readonly FacebookCommentRecord[]): void => {
    saveCommentsTransaction(candidateId, comments);
  };
};

const createSaveAiJudgment = (saveAiJudgmentStatement: Database.Statement) =>
  (inputValue: SaveAiJudgmentInput): void => {
    saveAiJudgmentStatement.run(toAiJudgmentParams(inputValue));
  };

const createListCandidates = (listCandidatesStatement: Database.Statement) =>
  (runId: string): FacebookProductVideoCandidateRecord[] => {
    const rows = listCandidatesStatement.all(runId) as CandidateRow[];
    return rows.map(mapCandidateRow);
  };

const toCandidateParams = (
  candidate: FacebookProductVideoCandidateRecord,
  rawDomProbeJson: string | null,
) => ({
  id: candidate.id,
  mission_id: candidate.missionId,
  run_id: candidate.runId,
  round_id: candidate.roundId,
  round_index: candidate.roundIndex,
  source_page_url: candidate.sourcePageUrl,
  facebook_video_id: candidate.facebookVideoId,
  page_title: candidate.pageTitle,
  author_text: candidate.authorText,
  caption_text: candidate.captionText,
  like_count: candidate.likeCount,
  comment_count_displayed: candidate.commentCountDisplayed,
  comments_loaded_count: candidate.commentsLoadedCount,
  comments_complete: candidate.commentsComplete ? 1 : 0,
  comment_stop_reason: candidate.commentStopReason,
  ai_selected_option_id: candidate.aiSelectedOptionId,
  ai_confidence: candidate.aiConfidence,
  ai_reason: candidate.aiReason,
  video_artifact_ref: candidate.videoArtifactRef,
  video_file_path: candidate.videoFilePath,
  video_sha256: candidate.videoSha256,
  video_byte_size: candidate.videoByteSize,
  video_content_type: candidate.videoContentType,
  video_artifact_disposition: candidate.videoArtifactDisposition,
  status: candidate.status,
  not_interested_status: candidate.notInterestedStatus,
  raw_dom_probe_json: rawDomProbeJson,
  created_at: candidate.createdAt,
  updated_at: candidate.updatedAt ?? null,
});

const toCommentParams = (candidateId: string, comment: FacebookCommentRecord) => ({
  id: comment.commentId ?? `${candidateId}_${comment.ordinal}`,
  candidate_id: candidateId,
  ordinal: comment.ordinal,
  comment_id: comment.commentId,
  author_display_text: comment.authorDisplayText,
  comment_text: comment.commentText,
  like_count: comment.likeCount,
  reply_depth: comment.replyDepth,
  parent_comment_id: comment.parentCommentId,
  captured_at: comment.capturedAt,
  source_signal: comment.sourceSignal,
});

const toAiJudgmentParams = (input: SaveAiJudgmentInput) => {
  const judgment = FacebookProductVideoMiningSchemas.FacebookVideoAiJudgmentSchema.parse(input.judgment);
  return {
    id: input.id,
    candidate_id: input.candidateId,
    provider_kind: judgment.providerKind,
    prompt_contract_id: input.promptContractId,
    raw_output_ref: judgment.rawOutputRef,
    raw_output_hash: judgment.rawOutputHash,
    normalized_text: judgment.normalizedText,
    parsed_json: JSON.stringify({
      selectedOptionId: judgment.selectedOptionId,
      confidence: judgment.confidence,
      visibleProduct: judgment.visibleProduct,
      productCategory: judgment.productCategory,
      sellingIntentSignals: judgment.sellingIntentSignals,
      evidenceFromVideo: judgment.evidenceFromVideo,
      reason: judgment.reason,
    }),
    provider_proof_json: JSON.stringify(judgment.providerProof),
    schema_validation_status: judgment.schemaValidationStatus,
    status: judgment.status,
    selected_option_id: judgment.selectedOptionId,
    confidence: judgment.confidence,
    created_at: judgment.createdAt,
  };
};

export const createFacebookMiningCandidateStore = (input: {
  db: Database.Database;
  updateRunCounters: (runId: string) => void;
}) => {
  const statements = prepareCandidateStatements(input.db);

  return {
    saveCandidate: createSaveCandidate({
      saveCandidateStatement: statements.saveCandidateStatement,
      selectCandidateStatement: statements.selectCandidateStatement,
      updateRunCounters: input.updateRunCounters,
    }),
    saveComments: createSaveComments({ db: input.db, saveCommentStatement: statements.saveCommentStatement }),
    saveAiJudgment: createSaveAiJudgment(statements.saveAiJudgmentStatement),
    listCandidates: createListCandidates(statements.listCandidatesStatement),
  };
};