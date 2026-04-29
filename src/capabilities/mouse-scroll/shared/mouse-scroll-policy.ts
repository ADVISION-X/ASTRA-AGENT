export const DEFAULT_MOUSE_SCROLL_SAFETY_POLICY = {
  allowOperatorManual: false,
  operatorManualApprovalRef: null,
  allowReplay: false,
  allowDesktopScreenScroll: false,
  desktopScreenOperatorApprovalRef: null,
  maxRepeat: 1,
  maxDeltaAbs: 1600,
  maxDurationMs: 5000,
  primitiveTimeoutMs: 3000,
  cooldownMs: 800,
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