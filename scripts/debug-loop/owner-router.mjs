const OWNER_ROUTE_TABLE = {
  "commander-console": ["src/capabilities/commander-console/**", "scripts/audit/domains/commander-console-capability/**"],
  orchestration: ["src/capabilities/orchestration/**", "scripts/audit/domains/orchestration-capability/**"],
  "nerve-bus": ["src/capabilities/nerve-bus/**", "scripts/audit/domains/nerve-bus-capability/**"],
  open: ["src/capabilities/open/**", "scripts/audit/domains/open-capability/**"],
  "page-state": ["src/capabilities/page-state/**", "scripts/audit/domains/page-state-capability/**"],
  screenshot: ["src/capabilities/screenshot/**", "scripts/audit/domains/screenshot-capability/**"],
  ai: ["src/capabilities/ai/**", "scripts/audit/domains/ai-capability/**"],
  "visual-target": ["src/capabilities/visual-target/**", "scripts/audit/domains/visual-target-capability/**"],
  "geometry-guard": ["src/capabilities/geometry-guard/**", "scripts/audit/domains/geometry-guard-capability/**"],
  "mouse-click": ["src/capabilities/mouse-click/**", "scripts/audit/domains/mouse-click-capability/**"],
  "mouse-scroll": ["src/capabilities/mouse-scroll/**", "scripts/audit/domains/mouse-scroll-capability/**"],
  "text-input": ["src/capabilities/text-input/**", "scripts/audit/domains/text-input-capability/**"],
  "post-action-verification": ["src/capabilities/post-action-verification/**", "scripts/audit/domains/post-action-verification-capability/**"],
  "forensics-persistence": ["src/capabilities/forensics-persistence/**", "scripts/audit/domains/forensics-persistence-capability/**"],
  "map-plugin-package": ["src/map-plugins/**", "scripts/audit/domains/map-plugin-package/**"],
  "code-purity": ["scripts/audit/domains/code-purity/**"],
  "audit-system": ["scripts/audit/**", "package.json"],
  "debug-loop-controller": ["scripts/debug-loop/**"],
};

function buildForbiddenCapabilityPaths(owner) {
  return Object.entries(OWNER_ROUTE_TABLE)
    .filter(([ownerId]) => ownerId !== owner)
    .flatMap(([, paths]) => paths.filter((filePattern) => filePattern.startsWith("src/capabilities/")));
}

function buildLawSourceAllowedModify(owner) {
  return [
    ".github/instructions/cursor-rules/modules/**",
    "docs/法案辅助文件/**",
    ...(OWNER_ROUTE_TABLE[owner] ?? []),
  ];
}

export function routeOwner(classification) {
  const owner = classification.owner ?? "debug-loop-controller";
  const allowedModify = classification.failureCategory === "LAW_SOURCE_ERROR"
    ? buildLawSourceAllowedModify(owner)
    : [...(OWNER_ROUTE_TABLE[owner] ?? ["scripts/debug-loop/**"]), ...(classification.failureCategory === "BLOCKED_COMMANDER_ENTRY_MISSING" ? ["src/app/task-api-handlers.ts"] : [])];
  const forbiddenModify = [
    ...(classification.failureCategory === "LAW_SOURCE_ERROR" ? [] : [".github/instructions/cursor-rules/modules/**"]),
    "scripts/audit/generated/**",
    ...buildForbiddenCapabilityPaths(owner),
  ];

  return {
    owner,
    allowedModify: [...new Set(allowedModify)],
    forbiddenModify: [...new Set(forbiddenModify)],
  };
}