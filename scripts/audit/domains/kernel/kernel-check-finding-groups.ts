import { fileExists, listImmediateDirectories, readTextFile } from "../../core/filesystem.js";
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
] as const;

const SUPPORT_LAW_SECTION_RULES = [
  {
    requirementId: REQUIREMENT_ID_001,
    heading: "Fixed Formula",
    expectedLine: "Support laws may define shell, storage, logging, topology, privacy, localization, and audit boundaries, but they must not create a second runtime chain.",
    missingMessage: "Kernel must declare the Fixed Formula section.",
    driftMessage: "Kernel support-law boundary must forbid creating a second runtime chain.",
  },
  {
    requirementId: REQUIREMENT_ID_001,
    heading: "Core Fingerprint Index",
    expectedLine: "This is the core routing index, not a full inventory of every support file, child boundary, local runtime helper, or generated audit object. Generated artifacts may support inspection, but no generated artifact outranks laws, blueprints, or owner inspectors.",
    missingMessage: "Kernel must declare Core Fingerprint Index as a core index, not a full inventory.",
    driftMessage: "Kernel fingerprint index must be explicitly scoped as core-only and must forbid generated artifacts from outranking laws.",
  },
  {
    requirementId: REQUIREMENT_ID_BLUEPRINT_002_001,
    heading: "Current Runtime Mission Loop",
    expectedLine: "docs/法案辅助文件/GrassEye 简单能力机器总纲施工图.md",
    missingMessage: "Kernel must declare current narrative authority inside the runtime mission loop section.",
    driftMessage: "Kernel current narrative authority must include the simple capability-machine blueprint.",
  },
  {
    requirementId: REQUIREMENT_ID_BLUEPRINT_002_002,
    heading: "Current Runtime Mission Loop",
    expectedLine: "docs/法案辅助文件/GrassEye Muscle Memory Catalog 肌肉记忆目录施工图.md",
    missingMessage: "Kernel must declare current narrative authority inside the runtime mission loop section.",
    driftMessage: "Kernel current narrative authority must include the MuscleMemory capability-registry blueprint.",
  },
  {
    requirementId: REQUIREMENT_ID_BLUEPRINT_002_003,
    heading: "Current Runtime Mission Loop",
    expectedLine: "docs/法案辅助文件/GrassEye Child Capability Strength 子能力强度施工图.md",
    missingMessage: "Kernel must declare current narrative authority inside the runtime mission loop section.",
    driftMessage: "Kernel current narrative authority must include the child-capability-strength blueprint.",
  },
] as const;

// Non-ability-group support directories that are explicitly allowed under src/capabilities.
const ALLOWED_NON_GROUP_DIRS = new Set(["shared"]);

const collectCapabilityRootFindings = async (): Promise<Finding[]> => {
  const directories = (await listImmediateDirectories(pathFromRepoRoot(CAPABILITY_ROOT)))
    .map((directory) => directory.split("/").at(-1) ?? directory)
    .filter((dir) => !ALLOWED_NON_GROUP_DIRS.has(dir))
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
        message: `src/capabilities top-level directories must match the current implementation inventory declared by Kernel. Details: ${details.join("; ")}`,
      })];
};

const collectSupportLawBoundaryFindings = (kernelSections: Map<string, MarkdownSection>): Finding[] =>
  SUPPORT_LAW_SECTION_RULES.flatMap((rule) =>
    collectRequiredSectionLineFindings({
      ...rule,
      file: KERNEL_FILE,
      sections: kernelSections,
    }),
  );

const collectFrozenConclusionFindings = (_blueprintSections: Map<string, MarkdownSection>): Finding[] => [];

const collectFrozenOwnerWordingFindings = (_blueprintContent: string): Finding[] => [];

const readPhaseFiveDraftContent = async (file: string): Promise<string | null> => {
  const absolutePath = pathFromRepoRoot(file);
  if (!(await fileExists(absolutePath))) {
    return null;
  }
  return readTextFile(absolutePath);
};

const collectPhaseFiveDraftStatusFindings = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];
  for (const file of PHASE_FIVE_DRAFT_FILES) {
    const content = await readPhaseFiveDraftContent(file);
    if (content === null) {
      continue;
    }
    if (!content.includes("status: future-draft / inactive")) {
      findings.push(createFinding({
        lawId: REQUIREMENT_ID_001,
        file,
        line: 1,
        severity: "fatal",
        message: "Phase-five documents must be marked future-draft/inactive to confirm they are no longer current narrative authority.",
      }));
    }
  }
  return findings;
};

const collectAbilityGroupBaselineFindings = (kernelSections: Map<string, MarkdownSection>, blueprintSections: Map<string, MarkdownSection>) => {
  return {
    kernelListFindings: [
      ...collectRequiredSectionLineFindings({
        requirementId: REQUIREMENT_ID_001,
        file: KERNEL_FILE,
        heading: "Active Ability Groups",
        sections: kernelSections,
        expectedLine: "The current 14 roots remain the implementation inventory, but they are not equal semantic authority.",
        missingMessage: "Kernel must declare the Active Ability Groups section.",
        driftMessage: "Kernel active ability groups must stay framed as implementation inventory instead of equal semantic authority.",
      }),
      ...collectRequiredSectionLineFindings({
        requirementId: REQUIREMENT_ID_001,
        file: KERNEL_FILE,
        heading: "Active Ability Groups",
        sections: kernelSections,
        expectedLine: "Support and transition evidence surfaces must be folded or retired when they stop providing independent atomic child abilities.",
        missingMessage: "Kernel must declare the Active Ability Groups section.",
        driftMessage: "Kernel must keep support surfaces subordinate to atomic child-capability truth.",
      }),
    ],
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
      driftMessage: "Kernel foundation laws must match the current five-law baseline.",
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
      driftMessage: "Kernel support governance domains must remain empty.",
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
      driftMessage: "Kernel local development tooling must stay outside active governance.",
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
