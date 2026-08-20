const AMAZON_INVOICE_UPLOAD_STATUS_VALUES = [
  "received",
  "uploading",
  "pending",
  "opened_amazon",
  "login_required",
  "captcha_or_2fa_required",
  "search_input_found",
  "order_search_submitted",
  "order_found",
  "order_detail_opened",
  "upload_entry_found",
  "order_not_found",
  "ambiguous",
  "upload_entry_not_found",
  "file_input_not_found",
  "file_attached",
  "upload_submitted",
  "submit_failed",
  "amount_mismatch_skipped",
  "upload_success",
  "already_uploaded",
  "review_required",
  "failed",
] as const;

export type AmazonInvoiceUploadStatus =
  (typeof AMAZON_INVOICE_UPLOAD_STATUS_VALUES)[number];
