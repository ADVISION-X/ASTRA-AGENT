import type { BrowserLoginState } from "../../types/local-browser-session.js";
import type { PageStateType } from "./contract.js";

export const REVIEW_TOKENS = ["captcha", "challenge", "verify", "safety"] as const;
export const LOGIN_URL_TOKENS = ["login", "signin", "sign-in", "auth"] as const;
export const LOGIN_TITLE_TOKENS = ["log in", "login", "sign in", "sign-in"] as const;
const TIKTOK_HOST_TOKENS = ["tiktok.com"] as const;

export function containsToken(value: string, tokens: readonly string[]): boolean {
  return tokens.some((token) => value.includes(token));
}

export function mapLoginStateToPageState(loginState: BrowserLoginState): {
  pageStateType: PageStateType;
  stateSummary: string;
  confidence: number;
  reviewRequiredReason: string | null;
} {
  switch (loginState) {
    case "logged_in":
      return {
        pageStateType: "logged_in",
        stateSummary: "browser session appears logged in",
        confidence: 0.98,
        reviewRequiredReason: null,
      };
    case "login_required":
      return {
        pageStateType: "login_required",
        stateSummary: "browser session is blocked by a login wall",
        confidence: 0.98,
        reviewRequiredReason: "operator login required inside current local Chrome session",
      };
    case "review_required":
      return {
        pageStateType: "review_required",
        stateSummary: "browser session is blocked by captcha or safety review",
        confidence: 0.98,
        reviewRequiredReason: "browser challenge or safety review required",
      };
    default:
      return {
        pageStateType: "unknown",
        stateSummary: "browser session login state is unknown",
        confidence: 0.45,
        reviewRequiredReason: null,
      };
  }
}

export function resolvePlatformPageKind(currentUrl: string): Extract<PageStateType, "platform_feed" | "platform_video_page" | "platform_unknown"> {
  const normalizedUrl = currentUrl.toLowerCase();
  if (normalizedUrl === "about:blank" || !containsToken(normalizedUrl, TIKTOK_HOST_TOKENS)) {
    return "platform_unknown";
  }

  try {
    const parsed = new URL(currentUrl);
    const pathname = parsed.pathname.toLowerCase();
    if (pathname.includes("/video/")) {
      return "platform_video_page";
    }
    if (pathname === "/" || pathname === "" || pathname === "/foryou" || pathname === "/following" || pathname.startsWith("/@")) {
      return "platform_feed";
    }
  } catch {
    return "platform_unknown";
  }

  return "platform_feed";
}

export function detectReviewTokens(currentUrl: string, currentTitle: string): boolean {
  const normalizedUrl = currentUrl.toLowerCase();
  const normalizedTitle = currentTitle.toLowerCase();
  return containsToken(normalizedUrl, REVIEW_TOKENS) || containsToken(normalizedTitle, REVIEW_TOKENS);
}

export function detectLoginTokens(currentUrl: string, currentTitle: string): boolean {
  const normalizedUrl = currentUrl.toLowerCase();
  const normalizedTitle = currentTitle.toLowerCase();
  return containsToken(normalizedUrl, LOGIN_URL_TOKENS) || containsToken(normalizedTitle, LOGIN_TITLE_TOKENS);
}