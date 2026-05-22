export const FACEBOOK_MINING_MANDATORY_STAGES = [
  "FACEBOOK_MISSION_PREFLIGHT",
  "FACEBOOK_OPEN_FEED",
  "FACEBOOK_WAIT_VIDEO_STABLE",
  "FACEBOOK_ROUND_START",
  "FACEBOOK_IDENTIFY_VIDEO",
  "FACEBOOK_DOM_PROBE",
  "FACEBOOK_COMMENT_COLLECTION",
  "FACEBOOK_VIDEO_DOWNLOAD",
  "FACEBOOK_AI_UPLOAD",
  "FACEBOOK_AI_RESPONSE_WAIT",
  "FACEBOOK_AI_PARSE",
  "FACEBOOK_DECISION_APPLY",
  "FACEBOOK_ARTIFACT_PROMOTE_OR_DELETE",
  "FACEBOOK_NOT_INTERESTED",
  "FACEBOOK_NAVIGATION_NEXT",
  "FACEBOOK_VERIFY_NEXT_STABLE",
  "FACEBOOK_ROUND_FINALIZE",
] as const;

export type FacebookMiningStageName = (typeof FACEBOOK_MINING_MANDATORY_STAGES)[number];

export type FacebookMiningStageContract = {
  stageName: FacebookMiningStageName;
  ownerFiles: string[];
  requiredStartedLog: boolean;
  requiredTerminalLog: boolean;
  requiredFailureClasses: string[];
  requiredRefs: string[];
  requiredHashes: string[];
  requiredMetrics: string[];
  flowVisibility: boolean;
  debugVisibility: boolean;
  traceVisibility: boolean;
};

export const FACEBOOK_MINING_STAGE_CONTRACTS: FacebookMiningStageContract[] = [
  { stageName: "FACEBOOK_MISSION_PREFLIGHT", ownerFiles: ["src/plugins/facebook-product-video-mining/facebook-product-video-mining.flow.ts"], requiredStartedLog: true, requiredTerminalLog: true, requiredFailureClasses: ["SCHEMA_CONTRACT_VIOLATION", "INTERNAL_BUG"], requiredRefs: ["debugBundleRef"], requiredHashes: ["configHash"], requiredMetrics: ["targetProductCount", "maxRounds", "maxMinutes"], flowVisibility: true, debugVisibility: true, traceVisibility: true },
  { stageName: "FACEBOOK_OPEN_FEED", ownerFiles: ["src/plugins/facebook-product-video-mining/facebook-product-video-mining.flow.ts"], requiredStartedLog: true, requiredTerminalLog: true, requiredFailureClasses: ["RECOVERABLE_BROWSER_DRIFT", "ACCOUNT_SECURITY_BLOCKER", "PLATFORM_RATE_LIMIT", "INTERNAL_BUG"], requiredRefs: ["browserSessionRef"], requiredHashes: [], requiredMetrics: ["durationMs"], flowVisibility: true, debugVisibility: true, traceVisibility: true },
  { stageName: "FACEBOOK_WAIT_VIDEO_STABLE", ownerFiles: ["src/plugins/facebook-product-video-mining/facebook-product-video-mining.flow.ts", "src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-runtime.ts"], requiredStartedLog: true, requiredTerminalLog: true, requiredFailureClasses: ["DOM_PROBE_FAILURE", "ACCOUNT_SECURITY_BLOCKER", "PLATFORM_RATE_LIMIT"], requiredRefs: [], requiredHashes: ["currentSrcHash"], requiredMetrics: ["stableSampleCount", "durationMs"], flowVisibility: false, debugVisibility: true, traceVisibility: true },
  { stageName: "FACEBOOK_ROUND_START", ownerFiles: ["src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-runtime.ts"], requiredStartedLog: true, requiredTerminalLog: true, requiredFailureClasses: ["INTERNAL_BUG"], requiredRefs: [], requiredHashes: [], requiredMetrics: ["roundIndex"], flowVisibility: true, debugVisibility: true, traceVisibility: true },
  { stageName: "FACEBOOK_IDENTIFY_VIDEO", ownerFiles: ["src/plugins/facebook-product-video-mining/facebook-product-video-mining.dom-probe.ts"], requiredStartedLog: true, requiredTerminalLog: true, requiredFailureClasses: ["DOM_PROBE_FAILURE"], requiredRefs: [], requiredHashes: ["currentSrcHash", "textHash"], requiredMetrics: ["confidence"], flowVisibility: false, debugVisibility: true, traceVisibility: true },
  { stageName: "FACEBOOK_DOM_PROBE", ownerFiles: ["src/plugins/facebook-product-video-mining/facebook-product-video-mining.dom-probe.ts"], requiredStartedLog: true, requiredTerminalLog: true, requiredFailureClasses: ["DOM_PROBE_FAILURE"], requiredRefs: ["domSnapshotRef"], requiredHashes: ["domSignatureHash"], requiredMetrics: ["likeCount", "commentCountDisplayed"], flowVisibility: false, debugVisibility: true, traceVisibility: true },
  { stageName: "FACEBOOK_COMMENT_COLLECTION", ownerFiles: ["src/plugins/facebook-product-video-mining/facebook-product-video-mining.comments.ts"], requiredStartedLog: true, requiredTerminalLog: true, requiredFailureClasses: ["DOM_PROBE_FAILURE"], requiredRefs: ["commentsRef"], requiredHashes: ["commentsHash"], requiredMetrics: ["commentsLoadedCount", "durationMs"], flowVisibility: true, debugVisibility: true, traceVisibility: true },
  { stageName: "FACEBOOK_VIDEO_DOWNLOAD", ownerFiles: ["src/plugins/facebook-product-video-mining/facebook-product-video-mining.video.ts", "src/plugins/facebook-product-video-mining/facebook-product-video-mining.round.ts"], requiredStartedLog: true, requiredTerminalLog: true, requiredFailureClasses: ["MEDIA_DOWNLOAD_FAILURE"], requiredRefs: ["artifactRef"], requiredHashes: ["sha256"], requiredMetrics: ["byteSize", "durationMs"], flowVisibility: true, debugVisibility: true, traceVisibility: true },
  { stageName: "FACEBOOK_AI_UPLOAD", ownerFiles: ["src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-judge.ts"], requiredStartedLog: true, requiredTerminalLog: true, requiredFailureClasses: ["AI_PROVIDER_FAILURE"], requiredRefs: ["fileRef"], requiredHashes: ["videoFileHash", "promptHash"], requiredMetrics: ["videoByteSize", "durationMs"], flowVisibility: true, debugVisibility: true, traceVisibility: true },
  { stageName: "FACEBOOK_AI_RESPONSE_WAIT", ownerFiles: ["src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-judge.ts"], requiredStartedLog: true, requiredTerminalLog: true, requiredFailureClasses: ["AI_PROVIDER_FAILURE"], requiredRefs: ["rawOutputRef"], requiredHashes: ["rawOutputHash"], requiredMetrics: ["durationMs"], flowVisibility: false, debugVisibility: true, traceVisibility: true },
  { stageName: "FACEBOOK_AI_PARSE", ownerFiles: ["src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-judge.ts"], requiredStartedLog: true, requiredTerminalLog: true, requiredFailureClasses: ["AI_PARSE_FAILURE"], requiredRefs: ["rawOutputRef"], requiredHashes: ["normalizedOutputHash"], requiredMetrics: ["confidence"], flowVisibility: true, debugVisibility: true, traceVisibility: true },
  { stageName: "FACEBOOK_DECISION_APPLY", ownerFiles: ["src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-runtime.ts", "src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-outcomes.ts"], requiredStartedLog: true, requiredTerminalLog: true, requiredFailureClasses: ["INTERNAL_BUG"], requiredRefs: ["candidateId"], requiredHashes: [], requiredMetrics: ["confidence"], flowVisibility: true, debugVisibility: true, traceVisibility: true },
  { stageName: "FACEBOOK_ARTIFACT_PROMOTE_OR_DELETE", ownerFiles: ["src/plugins/facebook-product-video-mining/facebook-product-video-mining.video.ts", "src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-outcomes.ts"], requiredStartedLog: true, requiredTerminalLog: true, requiredFailureClasses: ["ARTIFACT_FAILURE"], requiredRefs: ["artifactRef"], requiredHashes: ["sha256"], requiredMetrics: ["byteSize"], flowVisibility: true, debugVisibility: true, traceVisibility: true },
  { stageName: "FACEBOOK_NOT_INTERESTED", ownerFiles: ["src/plugins/facebook-product-video-mining/facebook-product-video-mining.not-interested.ts", "src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-outcomes.ts"], requiredStartedLog: true, requiredTerminalLog: true, requiredFailureClasses: ["RECOVERABLE_BROWSER_DRIFT"], requiredRefs: [], requiredHashes: ["beforeHash", "afterHash"], requiredMetrics: ["durationMs"], flowVisibility: true, debugVisibility: true, traceVisibility: true },
  { stageName: "FACEBOOK_NAVIGATION_NEXT", ownerFiles: ["src/plugins/facebook-product-video-mining/facebook-product-video-mining.navigation.ts"], requiredStartedLog: true, requiredTerminalLog: true, requiredFailureClasses: ["NAVIGATION_FAILURE", "RECOVERABLE_BROWSER_DRIFT"], requiredRefs: ["recoveryTrail"], requiredHashes: ["beforeSignatureHash", "afterSignatureHash"], requiredMetrics: ["durationMs"], flowVisibility: true, debugVisibility: true, traceVisibility: true },
  { stageName: "FACEBOOK_VERIFY_NEXT_STABLE", ownerFiles: ["src/plugins/facebook-product-video-mining/facebook-product-video-mining.navigation.ts"], requiredStartedLog: true, requiredTerminalLog: true, requiredFailureClasses: ["NAVIGATION_FAILURE"], requiredRefs: [], requiredHashes: ["newVideoKey"], requiredMetrics: ["stableSampleCount", "durationMs"], flowVisibility: false, debugVisibility: true, traceVisibility: true },
  { stageName: "FACEBOOK_ROUND_FINALIZE", ownerFiles: ["src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-runtime.ts"], requiredStartedLog: true, requiredTerminalLog: true, requiredFailureClasses: ["SKIPPABLE_ROUND_FAILURE", "INTERNAL_BUG"], requiredRefs: ["roundSummaryRef"], requiredHashes: [], requiredMetrics: ["durationMs"], flowVisibility: true, debugVisibility: true, traceVisibility: true },
];
