export const FacebookLogCoverageLaw = {
  STAGE_MATRIX: "GRASSEYE-RUNTIME-LOG-SPINE-016-V1",
  FAILURE_CLASS: "GRASSEYE-RUNTIME-LOG-SPINE-010-V1",
  AI_CONTRACT: "GRASSEYE-RUNTIME-LOG-SPINE-013-V1",
  NAVIGATION_CONTRACT: "GRASSEYE-RUNTIME-LOG-SPINE-014-V1",
  RECOVERY_TRAIL: "GRASSEYE-RUNTIME-LOG-SPINE-015-V1",
  ARTIFACT_REFS: "GRASSEYE-RUNTIME-LOG-SPINE-006-V1",
} as const;

type FacebookLogCoverageLawId = (typeof FacebookLogCoverageLaw)[keyof typeof FacebookLogCoverageLaw];

export type FacebookLogCoverageFinding = {
  lawId: FacebookLogCoverageLawId;
  file: string;
  line: number;
  severity: "fatal";
  message: string;
  hint: string;
  checkId: string;
};

export type FacebookLogCoverageSection = {
  name: string;
  status: "PASS" | "FAIL";
  findingCount: number;
  coveragePercent?: number;
};

export const FACEBOOK_MINING_OWNER_FILES = [
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.flow.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.round.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-runtime.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.dom-probe.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.comments.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.video.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-judge.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.navigation.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.not-interested.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-outcomes.ts",
] as const;
