const PROFILE_INVALID_PATTERNS = [/profile invalid/i, /profile_missing/i, /default_unverified/i, /managed profile is forbidden/i];
const SESSION_EXPIRED_PATTERNS = [/session[_ ]expired/i, /cookie expired/i];
const SECURITY_PATTERNS = [/captcha/i, /security[_ ]check/i, /security_wall/i, /verify you are human/i, /unusual activity/i, /challenge/i];
const AUTH_REQUIRED_PATTERNS = [/AUTH_REQUIRED/i, /login required/i, /not logged in/i, /login wall/i, /permission denied/i, /two-factor/i, /2fa/i, /checkpoint/i];

function getSignalTexts(input) {
  const texts = [];
  const modeInfo = input.modeInfo ?? null;
  const logIndex = input.logIndex ?? null;

  if (modeInfo) {
    texts.push(modeInfo.loginState ?? "");
    texts.push(modeInfo.loginRequiredReason ?? "");
    texts.push(modeInfo.reviewRequiredReason ?? "");
    texts.push(modeInfo.browserProfileStatus ?? "");
    texts.push(modeInfo.browserProfileVerificationStatus ?? "");
    texts.push(modeInfo.browserProfileVerificationReason ?? "");
  }

  for (const bucketName of ["authSignals", "externalPlatformSignals"]) {
    for (const signal of logIndex?.[bucketName] ?? []) {
      texts.push(signal.text ?? "");
    }
  }

  return texts.filter(Boolean);
}

function matchesCategory(texts, patterns) {
  return texts.some((text) => patterns.some((pattern) => pattern.test(text)));
}

function buildResult(category, decision, texts) {
  return {
    matched: true,
    classification: category,
    decision,
    signals: texts,
  };
}

export function detectAuthSignals(input = {}) {
  const texts = getSignalTexts(input);
  const loginState = input.modeInfo?.loginState ?? null;

  if (matchesCategory(texts, PROFILE_INVALID_PATTERNS)) {
    return buildResult("PROFILE_INVALID", "BLOCKED_AUTH_REQUIRED", texts);
  }

  if (matchesCategory(texts, SESSION_EXPIRED_PATTERNS)) {
    return buildResult("SESSION_EXPIRED", "BLOCKED_AUTH_REQUIRED", texts);
  }

  if (loginState === "review_required" || matchesCategory(texts, SECURITY_PATTERNS)) {
    return buildResult("EXTERNAL_PLATFORM_SECURITY", "BLOCKED_EXTERNAL_PLATFORM_SECURITY", texts);
  }

  if (loginState === "login_required" || matchesCategory(texts, AUTH_REQUIRED_PATTERNS)) {
    return buildResult("AUTH_REQUIRED", "BLOCKED_AUTH_REQUIRED", texts);
  }

  return {
    matched: false,
    classification: null,
    decision: null,
    signals: texts,
  };
}