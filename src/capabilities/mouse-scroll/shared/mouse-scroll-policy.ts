export const DEFAULT_MOUSE_SCROLL_SAFETY_POLICY = {
  allowOperatorManual: false,
  operatorManualApprovalRef: null,
  allowReplay: false,
  allowDesktopScreenScroll: false,
  desktopScreenOperatorApprovalRef: null,
  currentPhaseAllowsDesktopScroll: false,
  platformProfileAllowsDesktopScroll: false,
  desktopOperatorApprovalValidUntil: null,
  maxRepeat: 3,
  maxDeltaAbs: 1600,
  maxDurationMs: 60_000,
  primitiveTimeoutMs: 60_000,
  cooldownMs: 800,
  idempotencyTtlMs: 300000,
  maxIdempotencyReservations: 512,
  maxScopeEntries: 64,
  requireStableRoundBinding: false,
  requireStableVideoVisitBinding: false,
} as const;

export const MOUSE_SCROLL_ALLOWED_PURPOSE_PREFIXES = [
  "continue_",
  "scroll_",
  "review_",
  "inspect_",
  "load_",
  "align_",
  "observe_",
  "open_",
] as const;

export const MOUSE_SCROLL_SENSITIVE_TARGET_TOKENS = [
  "captcha",
  "login",
  "permission",
  "payment",
  "destructive",
  "system_dialog",
] as const;