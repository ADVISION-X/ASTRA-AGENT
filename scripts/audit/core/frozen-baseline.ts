import { readTextFile } from "./filesystem.js";
import { pathFromRepoRoot } from "./paths.js";

const FROZEN_BASELINE_PATH = "docs/法案辅助文件/GrassEye 法案冻结基线.md";

const ABILITY_GROUP_DOMAIN_MAP: Record<string, string> = {
  "commander-console": "commander-console-capability",
  orchestration: "orchestration-capability",
  "nerve-bus": "nerve-bus-capability",
  ai: "ai-capability",
  open: "open-capability",
  screenshot: "screenshot-capability",
  "visual-target": "visual-target-capability",
  "geometry-guard": "geometry-guard-capability",
  "mouse-click": "mouse-click-capability",
  "text-input": "text-input-capability",
  "mouse-scroll": "mouse-scroll-capability",
  "post-action-verification": "post-action-verification-capability",
  "forensics-persistence": "forensics-persistence-capability",
  "page-state": "page-state-capability",
  "map-plugin-package": "map-plugin-package",
};

const SUPPORT_LAW_DOMAIN_MAP: Record<string, string> = {
  "audit-system": "audit-system",
  "capability-group-governance": "capability-group-governance",
  "type-safety": "type-safety",
  "security-privacy": "security-privacy",
};

const DELETED_OWNER_DOMAIN_MAP: Record<string, string> = {
  "local-data": "local-data",
  localization: "localization",
  "platform-action as action owner": "platform-action",
  "local-ai-runtime as independent owner": "local-ai-runtime",
  "local-browser-session as independent owner": "local-browser-session",
  "local-app-shell as independent owner": "local-app-shell",
  "startup-entrypoint as independent owner": "startup-entrypoint",
  "structured-logging as independent owner": "structured-logging",
  "local-persistence-schema as independent owner": "local-persistence-schema",
  "multi-frame-evidence as independent owner": "multi-frame-evidence",
  "code-topology as independent owner": "code-topology",
  "code-purity as independent owner": "code-purity",
};

type FrozenBaselineSection = "active-ability-groups" | "active-support-laws" | "deleted-active-owners" | null;

const pushMappedValue = (target: string[], rawValue: string, mapping: Record<string, string>): void => {
  const mapped = mapping[rawValue];
  if (mapped) {
    target.push(mapped);
  }
};

const resolveFrozenBaselineSection = (line: string): FrozenBaselineSection | undefined => {
  if (line === "## 13 个 active ability groups" || line === "## 14 个 active ability groups") {
    return "active-ability-groups";
  }
  if (line === "## 4 个 active support laws") {
    return "active-support-laws";
  }
  if (line === "## 已删除 active owner") {
    return "deleted-active-owners";
  }
  if (line.startsWith("## ")) {
    return null;
  }

  return undefined;
};

const collectFrozenBaselineDomain = (input: {
  line: string;
  section: FrozenBaselineSection;
  activeCapabilityDomains: string[];
  deletedOwnerDomains: string[];
}): void => {
  const numbered = /^(\d+)\.\s+(.+)$/.exec(input.line);
  if (numbered && input.section === "active-ability-groups") {
    pushMappedValue(input.activeCapabilityDomains, numbered[2]!.trim(), ABILITY_GROUP_DOMAIN_MAP);
    return;
  }
  if (numbered && input.section === "active-support-laws") {
    pushMappedValue(input.activeCapabilityDomains, numbered[2]!.trim(), SUPPORT_LAW_DOMAIN_MAP);
    return;
  }

  const bulleted = /^-\s+(.+)$/.exec(input.line);
  if (bulleted && input.section === "deleted-active-owners") {
    pushMappedValue(input.deletedOwnerDomains, bulleted[1]!.trim(), DELETED_OWNER_DOMAIN_MAP);
  }
};

const collectFrozenBaselineDomains = (content: string): Pick<Awaited<ReturnType<typeof loadFrozenBaselineDomains>>, "activeCapabilityDomains" | "deletedOwnerDomains"> => {
  const activeCapabilityDomains: string[] = [];
  const deletedOwnerDomains: string[] = [];
  let section: FrozenBaselineSection = null;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    const resolvedSection = resolveFrozenBaselineSection(line);
    if (resolvedSection !== undefined) {
      section = resolvedSection;
      continue;
    }

    collectFrozenBaselineDomain({ line, section, activeCapabilityDomains, deletedOwnerDomains });
  }

  return { activeCapabilityDomains, deletedOwnerDomains };
};

export const loadFrozenBaselineDomains = async (): Promise<{
  activeCapabilityDomains: string[];
  deletedOwnerDomains: string[];
  baselineFile: string;
}> => {
  const baselineFile = FROZEN_BASELINE_PATH;
  const content = await readTextFile(pathFromRepoRoot(baselineFile));
  const { activeCapabilityDomains, deletedOwnerDomains } = collectFrozenBaselineDomains(content);

  return {
    activeCapabilityDomains,
    deletedOwnerDomains,
    baselineFile,
  };
};
