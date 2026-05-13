import type { BrowserActionResult, BrowserStateSnapshot } from "./browser-controller.js";

const LOGIN_URL_TOKENS = ["login", "signin", "signup"];
const LOGIN_TITLE_TOKENS = ["log in", "sign in", "注册", "登录"];
const REVIEW_TOKENS = ["captcha", "challenge", "verify", "safety"];

const containsToken = (value: string, tokens: string[]): boolean => tokens.some((token) => value.includes(token));

export function resolveChromeLoginState(currentUrl: string, currentTitle: string): BrowserStateSnapshot["loginState"] {
  const normalizedUrl = currentUrl.toLowerCase();
  const normalizedTitle = currentTitle.toLowerCase();
  if (normalizedUrl === "about:blank") {
    return "unknown";
  }
  if (containsToken(normalizedUrl, REVIEW_TOKENS) || containsToken(normalizedTitle, REVIEW_TOKENS)) {
    return "review_required";
  }
  if (containsToken(normalizedUrl, LOGIN_URL_TOKENS) || containsToken(normalizedTitle, LOGIN_TITLE_TOKENS)) {
    return "login_required";
  }
  return "logged_in";
}

export function createBrowserActionResult(input: {
  actionId: string;
  message: string;
  ok?: boolean;
}): BrowserActionResult {
  return {
    browserActionId: input.actionId,
    ok: input.ok ?? true,
    message: input.message,
    createdAt: new Date().toISOString(),
  };
}
