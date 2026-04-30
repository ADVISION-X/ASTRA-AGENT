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

export const loadFrozenBaselineDomains = async (): Promise<{
  activeCapabilityDomains: string[];
  deletedOwnerDomains: string[];
  baselineFile: string;
}> => {
  const baselineFile = FROZEN_BASELINE_PATH;
  const content = await readTextFile(pathFromRepoRoot(baselineFile));
  const lines = content.split("\n");
  const activeCapabilityDomains: string[] = [];
  const deletedOwnerDomains: string[] = [];
  let section: FrozenBaselineSection = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "## 13 个 active ability groups" || line === "## 14 个 active ability groups") {
      section = "active-ability-groups";
      continue;
    }
    if (line === "## 4 个 active support laws") {
      section = "active-support-laws";
      continue;
    }
    if (line === "## 已删除 active owner") {
      section = "deleted-active-owners";
      continue;
    }
    if (line.startsWith("## ")) {
      section = null;
      continue;
    }

    const numbered = /^(\d+)\.\s+(.+)$/.exec(line);
    if (numbered && section === "active-ability-groups") {
      pushMappedValue(activeCapabilityDomains, numbered[2]!.trim(), ABILITY_GROUP_DOMAIN_MAP);
      continue;
    }
    if (numbered && section === "active-support-laws") {
      pushMappedValue(activeCapabilityDomains, numbered[2]!.trim(), SUPPORT_LAW_DOMAIN_MAP);
      continue;
    }

    const bulleted = /^-\s+(.+)$/.exec(line);
    if (bulleted && section === "deleted-active-owners") {
      pushMappedValue(deletedOwnerDomains, bulleted[1]!.trim(), DELETED_OWNER_DOMAIN_MAP);
    }
  }

  return {
    activeCapabilityDomains,
    deletedOwnerDomains,
    baselineFile,
  };
};
