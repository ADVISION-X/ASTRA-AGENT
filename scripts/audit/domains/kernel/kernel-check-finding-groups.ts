import { listImmediateDirectories, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";

import { kernelInspectionConstants } from "./inspection-constants.js";
import { collectForbiddenOwnerLiteralFindings } from "./kernel-forbidden-owner-literal-findings.js";
import {
  collectExactListFindings,
  collectListDiffDetails,
  collectRequiredSectionLineFindings,
  parseMarkdownSections,
  type MarkdownSection,
} from "./kernel-markdown-checks.js";

export type KernelCheckFindingGroups = {
  supportLawBoundaryFindings: Finding[];
  frozenConclusionFindings: Finding[];
  kernelListFindings: Finding[];
  blueprintListFindings: Finding[];
  foundationLawFindings: Finding[];
  supportGovernanceDomainFindings: Finding[];
  localDevelopmentToolingFindings: Finding[];
  capabilityRootFindings: Finding[];
  forbiddenOwnerLiteralFindings: Finding[];
};

const {
  ACTIVE_ABILITY_GROUPS,
  BLUEPRINT_FILE,
  CAPABILITY_ROOT,
  FOUNDATION_LAWS,
  KERNEL_FILE,
  LOCAL_DEVELOPMENT_TOOLING,
  REQUIREMENT_ID_001,
  REQUIREMENT_ID_BLUEPRINT_002_001,
  REQUIREMENT_ID_BLUEPRINT_002_002,
  REQUIREMENT_ID_BLUEPRINT_002_003,
  REQUIREMENT_ID_BLUEPRINT_002_004,
  SUPPORT_GOVERNANCE_DOMAINS,
} = kernelInspectionConstants;
const PHASE_FIVE_DRAFT_FILES = [
  "docs/法案辅助文件/GrassEye 第五阶段高级AI地图生成与WEB本地程序打通施工图.md",
  "docs/项目方案/GrassEye_第五阶段建设目标方案.md",
] as const;

const collectCapabilityRootFindings = async (): Promise<Finding[]> => {
  const directories = (await listImmediateDirectories(pathFromRepoRoot(CAPABILITY_ROOT)))
    .map((directory) => directory.split("/").at(-1) ?? directory)
    .sort();
  const expected = [...ACTIVE_ABILITY_GROUPS].sort();
  const details = collectListDiffDetails(directories, expected);

  return details.length === 0
    ? []
    : [createFinding({
        lawId: REQUIREMENT_ID_001,
        file: CAPABILITY_ROOT,
        line: 1,
        severity: "fatal",
        message: `src/capabilities top-level directories must match the fixed 14 ability-group owners. Details: ${details.join("; ")}`,
      })];
};

const collectSupportLawBoundaryFindings = (kernelSections: Map<string, MarkdownSection>): Finding[] => {
  return [
    ...collectRequiredSectionLineFindings({
      requirementId: REQUIREMENT_ID_001,
      file: KERNEL_FILE,
      heading: "Fixed Formula",
      sections: kernelSections,
      expectedLine: "Support laws may define shell, storage, logging, topology, privacy, localization, and audit boundaries, but they must not create a second runtime chain.",
      missingMessage: "Kernel must declare the Fixed Formula section.",
      driftMessage: "Kernel support-law boundary must forbid creating a second runtime chain.",
    }),
    ...collectRequiredSectionLineFindings({
      requirementId: REQUIREMENT_ID_001,
      file: KERNEL_FILE,
      heading: "Core Fingerprint Index",
      sections: kernelSections,
      expectedLine: "This is the core routing index, not a full inventory of every support file, child boundary, local runtime helper, or generated audit object. Full coverage belongs to the generated audit matrix and domain inspectors.",
      missingMessage: "Kernel must declare Core Fingerprint Index as a core index, not a full inventory.",
      driftMessage: "Kernel fingerprint index must be explicitly scoped as core-only to avoid full-index drift.",
    }),
  ];
};

const collectFrozenConclusionFindings = (blueprintSections: Map<string, MarkdownSection>): Finding[] => {
  return [
    ...collectRequiredSectionLineFindings({
      requirementId: REQUIREMENT_ID_BLUEPRINT_002_001,
      file: BLUEPRINT_FILE,
      heading: "冻结结论",
      sections: blueprintSections,
      expectedLine: "14 个 active ability groups",
      missingMessage: "Frozen baseline must declare the 冻结结论 section.",
      driftMessage: "Frozen baseline conclusion must declare 14 个 active ability groups.",
    }),
    ...collectRequiredSectionLineFindings({
      requirementId: REQUIREMENT_ID_BLUEPRINT_002_002,
      file: BLUEPRINT_FILE,
      heading: "冻结结论",
      sections: blueprintSections,
      expectedLine: "5 个 foundation laws",
      missingMessage: "Frozen baseline must declare the 冻结结论 section.",
      driftMessage: "Frozen baseline conclusion must declare 5 个 foundation laws.",
    }),
    ...collectRequiredSectionLineFindings({
      requirementId: REQUIREMENT_ID_BLUEPRINT_002_003,
      file: BLUEPRINT_FILE,
      heading: "冻结结论",
      sections: blueprintSections,
      expectedLine: "1 个 support governance domain",
      missingMessage: "Frozen baseline must declare the 冻结结论 section.",
      driftMessage: "Frozen baseline conclusion must declare 1 个 support governance domain.",
    }),
    ...collectRequiredSectionLineFindings({
      requirementId: REQUIREMENT_ID_BLUEPRINT_002_004,
      file: BLUEPRINT_FILE,
      heading: "冻结结论",
      sections: blueprintSections,
      expectedLine: "若干父 owner 子契约法案",
      missingMessage: "Frozen baseline must declare the 冻结结论 section.",
      driftMessage: "Frozen baseline conclusion must declare parent-owner child-contract law files.",
    }),
  ];
};

const collectFrozenOwnerWordingFindings = (blueprintContent: string): Finding[] =>
  blueprintContent.includes("structured-logging | forensics-persistence-capability / capability-group-governance")
    ? [createFinding({
      lawId: REQUIREMENT_ID_BLUEPRINT_002_004,
      file: BLUEPRINT_FILE,
      line: 1,
      severity: "fatal",
      message: "Frozen baseline must not express structured-logging with dual parent owner wording; use forensics-persistence-capability owner plus governedBy separately.",
    })]
    : [];

const collectPhaseFiveDraftStatusFindings = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];
  for (const file of PHASE_FIVE_DRAFT_FILES) {
    const content = await readTextFile(pathFromRepoRoot(file));
    if (!content.includes("status: future-draft / inactive")) {
      findings.push(createFinding({
        lawId: REQUIREMENT_ID_001,
        file,
        line: 1,
        severity: "fatal",
        message: "Phase-five documents must be marked future-draft/inactive until Kernel Current phase upgrades to phase-five.",
      }));
    }
  }
  return findings;
};

const collectAbilityGroupBaselineFindings = (kernelSections: Map<string, MarkdownSection>, blueprintSections: Map<string, MarkdownSection>) => {
  return {
    kernelListFindings: collectExactListFindings({
      requirementId: REQUIREMENT_ID_001,
      file: KERNEL_FILE,
      heading: "Active Ability Groups",
      sections: kernelSections,
      expected: ACTIVE_ABILITY_GROUPS,
      missingMessage: "Kernel must declare the Active Ability Groups section.",
      driftMessage: "Kernel active ability groups must match the fixed 14-owner constitution.",
    }),
    blueprintListFindings: collectExactListFindings({
      requirementId: REQUIREMENT_ID_001,
      file: BLUEPRINT_FILE,
      heading: "14 个 active ability groups",
      sections: blueprintSections,
      expected: ACTIVE_ABILITY_GROUPS,
      missingMessage: "Frozen baseline must declare the 14 个 active ability groups section.",
      driftMessage: "Frozen baseline active ability groups must match the fixed 14-owner constitution.",
    }),
  };
};

const collectFoundationLawBaselineFindings = (kernelSections: Map<string, MarkdownSection>, blueprintSections: Map<string, MarkdownSection>): Finding[] => {
  return [
    ...collectExactListFindings({
      requirementId: REQUIREMENT_ID_001,
      file: KERNEL_FILE,
      heading: "Foundation Laws",
      sections: kernelSections,
      expected: FOUNDATION_LAWS,
      missingMessage: "Kernel must declare the Foundation Laws section.",
      driftMessage: "Kernel foundation laws must match the fixed five-law baseline.",
    }),
    ...collectExactListFindings({
      requirementId: REQUIREMENT_ID_001,
      file: BLUEPRINT_FILE,
      heading: "5 个 foundation laws",
      sections: blueprintSections,
      expected: FOUNDATION_LAWS,
      missingMessage: "Frozen baseline must declare the 5 个 foundation laws section.",
      driftMessage: "Frozen baseline foundation laws must match the fixed five-law baseline.",
    }),
  ];
};

const collectSupportGovernanceDomainBaselineFindings = (kernelSections: Map<string, MarkdownSection>, blueprintSections: Map<string, MarkdownSection>): Finding[] => {
  return [
    ...collectExactListFindings({
      requirementId: REQUIREMENT_ID_001,
      file: KERNEL_FILE,
      heading: "Support Governance Domains",
      sections: kernelSections,
      expected: SUPPORT_GOVERNANCE_DOMAINS,
      missingMessage: "Kernel must declare the Support Governance Domains section.",
      driftMessage: "Kernel support governance domains must match the fixed single-domain baseline.",
    }),
    ...collectExactListFindings({
      requirementId: REQUIREMENT_ID_001,
      file: BLUEPRINT_FILE,
      heading: "1 个 support governance domain",
      sections: blueprintSections,
      expected: SUPPORT_GOVERNANCE_DOMAINS,
      missingMessage: "Frozen baseline must declare the 1 个 support governance domain section.",
      driftMessage: "Frozen baseline support governance domains must match the fixed single-domain baseline.",
    }),
  ];
};

const collectLocalDevelopmentToolingBaselineFindings = (kernelSections: Map<string, MarkdownSection>, blueprintSections: Map<string, MarkdownSection>): Finding[] => {
  return [
    ...collectExactListFindings({
      requirementId: REQUIREMENT_ID_001,
      file: KERNEL_FILE,
      heading: "Local Development Tooling",
      sections: kernelSections,
      expected: LOCAL_DEVELOPMENT_TOOLING,
      missingMessage: "Kernel must declare the Local Development Tooling section.",
      driftMessage: "Kernel local development tooling must stay empty after retirement.",
    }),
    ...collectExactListFindings({
      requirementId: REQUIREMENT_ID_001,
      file: BLUEPRINT_FILE,
      heading: "本地开发工具",
      sections: blueprintSections,
      expected: LOCAL_DEVELOPMENT_TOOLING,
      missingMessage: "Frozen baseline must declare the 本地开发工具 section.",
      driftMessage: "Frozen baseline local development tooling must stay empty after retirement.",
    }),
  ];
};

export async function loadKernelCheckFindingGroups(): Promise<KernelCheckFindingGroups> {
  const [kernelContent, blueprintContent] = await Promise.all([
    readTextFile(pathFromRepoRoot(KERNEL_FILE)),
    readTextFile(pathFromRepoRoot(BLUEPRINT_FILE)),
  ]);
  const kernelSections = parseMarkdownSections(kernelContent);
  const blueprintSections = parseMarkdownSections(blueprintContent);
  const abilityGroupBaseline = collectAbilityGroupBaselineFindings(kernelSections, blueprintSections);

  return {
    supportLawBoundaryFindings: [
      ...collectSupportLawBoundaryFindings(kernelSections),
      ...(await collectPhaseFiveDraftStatusFindings()),
    ],
    frozenConclusionFindings: [
      ...collectFrozenConclusionFindings(blueprintSections),
      ...collectFrozenOwnerWordingFindings(blueprintContent),
    ],
    kernelListFindings: abilityGroupBaseline.kernelListFindings,
    blueprintListFindings: abilityGroupBaseline.blueprintListFindings,
    foundationLawFindings: collectFoundationLawBaselineFindings(kernelSections, blueprintSections),
    supportGovernanceDomainFindings: collectSupportGovernanceDomainBaselineFindings(kernelSections, blueprintSections),
    localDevelopmentToolingFindings: collectLocalDevelopmentToolingBaselineFindings(kernelSections, blueprintSections),
    capabilityRootFindings: await collectCapabilityRootFindings(),
    forbiddenOwnerLiteralFindings: collectForbiddenOwnerLiteralFindings(),
  };
}
