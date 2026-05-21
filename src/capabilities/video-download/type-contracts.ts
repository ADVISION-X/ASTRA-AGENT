export type VideoDownloadPlatformId =
  | "universal-web"
  | "facebook-web"
  | "tiktok-web"
  | "instagram-web"
  | "bilibili-web"
  | "douyin-web"
  | "x-web"
  | "xiaohongshu-web"
  | "youtube-web";

export type VideoDownloadFailureReason =
  | "input_schema_invalid"
  | "unknown_child_capability"
  | "source_page_mismatch"
  | "candidate_not_found"
  | "candidate_not_video"
  | "candidate_host_forbidden"
  | "download_expired"
  | "download_too_large"
  | "downloaded_file_invalid"
  | "login_required"
  | "captcha_or_2fa_required"
  | "drm_or_private_video"
  | "permission_denied"
  | "network_failed"
  | "metadata_validation_failed"
  | "artifact_write_failed";

export type VideoDownloadSubtitleArtifact = {
  artifactRef: string;
  storageRef: string;
  filePath: string;
  sha256: string;
  language: string;
  contentType: string;
  byteSize: number;
  sourceKind: "manual" | "automatic";
};