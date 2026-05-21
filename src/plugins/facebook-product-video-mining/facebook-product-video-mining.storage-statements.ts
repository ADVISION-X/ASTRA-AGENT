export const RUN_STATUS_SELECT_SQL = `
  SELECT
    id AS runId,
    mission_id AS missionId,
    feed_entry_url AS feedEntryUrl,
    provider_kind AS providerKind,
    target_product_count AS targetProductCount,
    max_rounds AS maxRounds,
    status,
    started_at AS startedAt,
    ended_at AS endedAt,
    failure_reason AS failureReason,
    saved_product_count AS savedProductCount,
    scanned_count AS scannedCount,
    current_round_id AS currentRoundId,
    current_round_index AS currentRoundIndex
  FROM facebook_product_video_runs
`;

export const CREATE_RUN_SQL = `
  INSERT INTO facebook_product_video_runs (
    id, mission_id, feed_entry_url, provider_kind, target_product_count, max_rounds,
    status, started_at, ended_at, failure_reason, saved_product_count, scanned_count,
    current_round_id, current_round_index
  ) VALUES (
    @id, @mission_id, @feed_entry_url, @provider_kind, @target_product_count, @max_rounds,
    @status, @started_at, NULL, NULL, 0, 0, NULL, NULL
  )
`;

export const UPDATE_RUN_PROGRESS_SQL = `
  UPDATE facebook_product_video_runs
  SET status = @status,
      failure_reason = @failureReason,
      ended_at = @endedAt,
      current_round_id = @currentRoundId,
      current_round_index = @currentRoundIndex
  WHERE id = @runId
`;

export const SAVE_CANDIDATE_SQL = `
  INSERT INTO facebook_product_video_candidates (
    id, mission_id, run_id, round_id, round_index, source_page_url, facebook_video_id,
    page_title, author_text, caption_text, like_count, comment_count_displayed,
    comments_loaded_count, comments_complete, comment_stop_reason, ai_selected_option_id,
    ai_confidence, ai_reason, video_artifact_ref, video_file_path, video_sha256,
    video_byte_size, video_content_type, video_artifact_disposition, status,
    not_interested_status, raw_dom_probe_json, created_at, updated_at
  ) VALUES (
    @id, @mission_id, @run_id, @round_id, @round_index, @source_page_url, @facebook_video_id,
    @page_title, @author_text, @caption_text, @like_count, @comment_count_displayed,
    @comments_loaded_count, @comments_complete, @comment_stop_reason, @ai_selected_option_id,
    @ai_confidence, @ai_reason, @video_artifact_ref, @video_file_path, @video_sha256,
    @video_byte_size, @video_content_type, @video_artifact_disposition, @status,
    @not_interested_status, @raw_dom_probe_json, @created_at, @updated_at
  )
  ON CONFLICT(id) DO UPDATE SET
    source_page_url = excluded.source_page_url,
    facebook_video_id = excluded.facebook_video_id,
    page_title = excluded.page_title,
    author_text = excluded.author_text,
    caption_text = excluded.caption_text,
    like_count = excluded.like_count,
    comment_count_displayed = excluded.comment_count_displayed,
    comments_loaded_count = excluded.comments_loaded_count,
    comments_complete = excluded.comments_complete,
    comment_stop_reason = excluded.comment_stop_reason,
    ai_selected_option_id = excluded.ai_selected_option_id,
    ai_confidence = excluded.ai_confidence,
    ai_reason = excluded.ai_reason,
    video_artifact_ref = excluded.video_artifact_ref,
    video_file_path = excluded.video_file_path,
    video_sha256 = excluded.video_sha256,
    video_byte_size = excluded.video_byte_size,
    video_content_type = excluded.video_content_type,
    video_artifact_disposition = excluded.video_artifact_disposition,
    status = excluded.status,
    not_interested_status = excluded.not_interested_status,
    raw_dom_probe_json = excluded.raw_dom_probe_json,
    updated_at = excluded.updated_at
`;

export const SAVE_COMMENT_SQL = `
  INSERT INTO facebook_product_video_comments (
    id, candidate_id, ordinal, comment_id, author_display_text, comment_text,
    like_count, reply_depth, parent_comment_id, captured_at, source_signal
  ) VALUES (
    @id, @candidate_id, @ordinal, @comment_id, @author_display_text, @comment_text,
    @like_count, @reply_depth, @parent_comment_id, @captured_at, @source_signal
  )
  ON CONFLICT(id) DO UPDATE SET
    ordinal = excluded.ordinal,
    author_display_text = excluded.author_display_text,
    comment_text = excluded.comment_text,
    like_count = excluded.like_count,
    reply_depth = excluded.reply_depth,
    parent_comment_id = excluded.parent_comment_id,
    captured_at = excluded.captured_at,
    source_signal = excluded.source_signal
`;

export const SAVE_AI_JUDGMENT_SQL = `
  INSERT INTO facebook_product_video_ai_judgments (
    id, candidate_id, provider_kind, prompt_contract_id, raw_output_ref, raw_output_hash,
    normalized_text, parsed_json, provider_proof_json, schema_validation_status,
    status, selected_option_id, confidence, created_at
  ) VALUES (
    @id, @candidate_id, @provider_kind, @prompt_contract_id, @raw_output_ref, @raw_output_hash,
    @normalized_text, @parsed_json, @provider_proof_json, @schema_validation_status,
    @status, @selected_option_id, @confidence, @created_at
  )
  ON CONFLICT(id) DO UPDATE SET
    raw_output_ref = excluded.raw_output_ref,
    raw_output_hash = excluded.raw_output_hash,
    normalized_text = excluded.normalized_text,
    parsed_json = excluded.parsed_json,
    provider_proof_json = excluded.provider_proof_json,
    schema_validation_status = excluded.schema_validation_status,
    status = excluded.status,
    selected_option_id = excluded.selected_option_id,
    confidence = excluded.confidence,
    created_at = excluded.created_at
`;