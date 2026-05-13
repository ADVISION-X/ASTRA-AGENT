export const PURE_VISUAL_ROUND_CONFIG = {
  activeSourceRoots: ["src"],
  ignoredPathParts: ["/archive/", "/dist/", "/node_modules/"],
  forbiddenAiOutputFields: [
    "isProductVideo",
    "productDecision",
    "visibleProductTypes",
    "pageStateDecision",
    "isTargetFeed",
    "nonExecutableClickTargets",
    "visibleInteractiveElements",
    "nonExecutableSummary",
  ],
  forbiddenDecisionTokens: [
    "product_yes",
    "product_no",
    "uncertain",
  ],
  forbiddenPlatformHints: [
    "nextVideoPreferredActionCode",
    "likeActionHint",
    "likeApprovedKey",
    "commentsActionHint",
    "defaultRecoveryActionCode",
  ],
  requiredPureVisualTokens: [
    "pureVisualRound.v1",
    "goalMatched",
    "save",
    "decision",
    "nextAction",
  ],
} as const;
