import { readTextFile } from "./filesystem.js";
import { pathFromRepoRoot } from "./paths.js";
import type { OwnerKind } from "./schema-manifests.js";

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
};

const FOUNDATION_LAW_DOMAIN_MAP: Record<string, string> = {
  "audit-system": "audit-system",
  "capability-group-governance": "capability-group-governance",
  "code-purity": "audit-system",
  "type-safety": "type-safety",
  "security-privacy": "security-privacy",
};

const SUPPORT_GOVERNANCE_DOMAIN_MAP: Record<string, string> = {};

const LOCAL_DEVELOPMENT_GOVERNANCE_DOMAIN_MAP: Record<string, string> = {
  "debug-loop-boundary": "debug-loop-boundary",
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

type FrozenBaselineSection =
  | "active-ability-groups"
  | "foundation-laws"
  | "support-governance-domains"
  | "local-development-governance-domains"
  | "deleted-active-owners"
  | null;

const FROZEN_BASELINE_SECTION_BY_HEADING: Record<string, Exclude<FrozenBaselineSection, null>> = {
  "## 13 个 active ability groups": "active-ability-groups",
  "## 14 个 active ability groups": "active-ability-groups",
  "## 4 个 active support laws": "foundation-laws",
  "## 5 个 foundation laws": "foundation-laws",
  "## 0 个 support governance domain": "support-governance-domains",
  "## 0 个 support governance domains": "support-governance-domains",
  "## support governance domains": "support-governance-domains",
  "## 本地开发治理 allowlist": "local-development-governance-domains",
  "## 已删除 active owner": "deleted-active-owners",
};

const ACTIVE_DOMAIN_MAP_BY_SECTION: Partial<Record<Exclude<FrozenBaselineSection, null>, Record<string, string>>> = {
  "active-ability-groups": ABILITY_GROUP_DOMAIN_MAP,
  "foundation-laws": FOUNDATION_LAW_DOMAIN_MAP,
  "support-governance-domains": SUPPORT_GOVERNANCE_DOMAIN_MAP,
  "local-development-governance-domains": LOCAL_DEVELOPMENT_GOVERNANCE_DOMAIN_MAP,
};

const OWNER_KIND_BY_SECTION: Partial<Record<Exclude<FrozenBaselineSection, null>, OwnerKind>> = {
  "active-ability-groups": "ability-group",
  "foundation-laws": "foundation-law",
  "support-governance-domains": "support-governance",
  "local-development-governance-domains": "local-development-governance",
};

const readNumberedListValue = (line: string): string | null => /^\d+\.\s+(.+)$/.exec(line)?.[1]?.trim() ?? null;

const readBulletedListValue = (line: string): string | null => /^-\s+(.+)$/.exec(line)?.[1]?.trim() ?? null;

const pushMappedValue = (target: string[], rawValue: string, mapping: Record<string, string>): void => {
  const mapped = mapping[rawValue];
  if (mapped && !target.includes(mapped)) {
    target.push(mapped);
  }
};

const resolveFrozenBaselineSection = (line: string): FrozenBaselineSection | undefined => {
  return line.startsWith("## ") ? FROZEN_BASELINE_SECTION_BY_HEADING[line] ?? null : undefined;
};

const pushActiveDomain = (input: {
  section: FrozenBaselineSection;
  activeLawDomains: string[];
  localDevelopmentGovernanceDomains: string[];
  ownerKindByDomain: Record<string, OwnerKind>;
}, mapped: string): void => {
  if (input.section === "local-development-governance-domains") {
    if (!input.localDevelopmentGovernanceDomains.includes(mapped)) {
      input.localDevelopmentGovernanceDomains.push(mapped);
    }
  } else if (!input.activeLawDomains.includes(mapped)) {
    input.activeLawDomains.push(mapped);
  }

  const ownerKind = input.section ? OWNER_KIND_BY_SECTION[input.section] : undefined;
  if (ownerKind) {
    input.ownerKindByDomain[mapped] = ownerKind;
  }
};

const collectNumberedFrozenBaselineDomain = (input: {
  line: string;
  section: FrozenBaselineSection;
  activeLawDomains: string[];
  localDevelopmentGovernanceDomains: string[];
  ownerKindByDomain: Record<string, OwnerKind>;
}): boolean => {
  const numberedValue = readNumberedListValue(input.line);
  const activeDomainMap = input.section ? ACTIVE_DOMAIN_MAP_BY_SECTION[input.section] : undefined;
  const mapped = numberedValue && activeDomainMap ? activeDomainMap[numberedValue] : undefined;
  if (!mapped) {
    return false;
  }

  pushActiveDomain(input, mapped);
  return true;
};

const collectDeletedFrozenBaselineDomain = (input: {
  line: string;
  section: FrozenBaselineSection;
  deletedOwnerDomains: string[];
}): void => {
  const bulletedValue = input.section === "deleted-active-owners" ? readBulletedListValue(input.line) : null;
  if (bulletedValue) {
    pushMappedValue(input.deletedOwnerDomains, bulletedValue, DELETED_OWNER_DOMAIN_MAP);
  }
};

const collectFrozenBaselineDomain = (input: {
  line: string;
  section: FrozenBaselineSection;
  activeLawDomains: string[];
  localDevelopmentGovernanceDomains: string[];
  deletedOwnerDomains: string[];
  ownerKindByDomain: Record<string, OwnerKind>;
}): void => {
  if (collectNumberedFrozenBaselineDomain(input)) {
    return;
  }

  collectDeletedFrozenBaselineDomain(input);
};

const collectFrozenBaselineDomains = (content: string): Pick<Awaited<ReturnType<typeof loadFrozenBaselineDomains>>, "activeLawDomains" | "localDevelopmentGovernanceDomains" | "deletedOwnerDomains" | "ownerKindByDomain"> => {
  const activeLawDomains: string[] = [];
  const localDevelopmentGovernanceDomains: string[] = [];
  const deletedOwnerDomains: string[] = [];
  const ownerKindByDomain: Record<string, OwnerKind> = {};
  let section: FrozenBaselineSection = null;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    const resolvedSection = resolveFrozenBaselineSection(line);
    if (resolvedSection !== undefined) {
      section = resolvedSection;
      continue;
    }

    collectFrozenBaselineDomain({
      line,
      section,
      activeLawDomains,
      localDevelopmentGovernanceDomains,
      deletedOwnerDomains,
      ownerKindByDomain,
    });
  }

  return { activeLawDomains, localDevelopmentGovernanceDomains, deletedOwnerDomains, ownerKindByDomain };
};

export const loadFrozenBaselineDomains = async (): Promise<{
  activeLawDomains: string[];
  localDevelopmentGovernanceDomains: string[];
  deletedOwnerDomains: string[];
  ownerKindByDomain: Record<string, OwnerKind>;
  baselineFile: string;
}> => {
  const baselineFile = FROZEN_BASELINE_PATH;
  const content = await readTextFile(pathFromRepoRoot(baselineFile));
  const { activeLawDomains, localDevelopmentGovernanceDomains, deletedOwnerDomains, ownerKindByDomain } = collectFrozenBaselineDomains(content);

  return {
    activeLawDomains,
    localDevelopmentGovernanceDomains,
    deletedOwnerDomains,
    ownerKindByDomain,
    baselineFile,
  };
};
