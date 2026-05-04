import { Node, SyntaxKind } from "ts-morph";

import { listImmediateDirectories, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getAuditProject, getNodeLine, toRelativeSourcePath } from "../../core/ts-morph.js";

import { kernelInspectionConstants } from "./inspection-constants.js";

type MarkdownSection = {
  line: number;
  lines: Array<{ text: string; line: number }>;
};

const {
  ACTIVE_ABILITY_GROUPS,
  BLUEPRINT_FILE,
  CAPABILITY_ROOT,
  FOUNDATION_LAWS,
  FORBIDDEN_TOP_LEVEL_OWNER_LITERALS,
  GOVERNED_SURFACES,
  KERNEL_FILE,
  LOCAL_DEVELOPMENT_TOOLING,
  OWNER_LITERAL_PROPERTIES,
  REQUIREMENT_ID_001,
  REQUIREMENT_ID_BLUEPRINT_002_001,
  REQUIREMENT_ID_BLUEPRINT_002_002,
  REQUIREMENT_ID_BLUEPRINT_002_003,
  REQUIREMENT_ID_BLUEPRINT_002_004,
  SUPPORT_GOVERNANCE_DOMAINS,
} = kernelInspectionConstants;

const collectRequiredSectionLineFindings = (input: {
  requirementId: string;
  file: string;
  heading: string;
  sections: Map<string, MarkdownSection>;
  expectedLine: string;
  missingMessage: string;
  driftMessage: string;
}): Finding[] => {
  const section = input.sections.get(input.heading);
  if (!section) {
    return [createFinding({ lawId: input.requirementId, file: input.file, line: 1, severity: "fatal", message: input.missingMessage })];
  }

  const sectionLines = section.lines.map((line) => line.text.trim());
  if (sectionLines.includes(`- ${input.expectedLine}`)) {
    return [];
  }

  return [createFinding({
    lawId: input.requirementId,
    file: input.file,
    line: section.line,
    severity: "fatal",
    message: input.driftMessage,
  })];
};

const parseMarkdownSections = (content: string): Map<string, MarkdownSection> => {
  const sections = new Map<string, MarkdownSection>();
  let currentHeading: string | null = null;

  for (const [index, rawLine] of content.split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const headingMatch = /^(##|###)\s+(.*)$/.exec(rawLine);
    if (headingMatch) {
      const heading = headingMatch[2]?.trim();
      if (!heading) {
        continue;
      }
      currentHeading = heading;
      sections.set(currentHeading, { line: lineNumber, lines: [] });
      continue;
    }

    if (!currentHeading) {
      continue;
    }

    sections.get(currentHeading)?.lines.push({ text: rawLine, line: lineNumber });
  }

  return sections;
};

const collectSectionListItems = (section: MarkdownSection): Array<{ value: string; line: number }> => {
  return section.lines
    .map((line) => ({ text: line.text.trim(), line: line.line }))
    .flatMap((line) => {
      if (line.text.startsWith("- ")) {
        return [{ value: line.text.slice(2).trim(), line: line.line }];
      }
      const numberedMatch = /^(\d+)\.\s+(.+)$/.exec(line.text);
      return numberedMatch ? [{ value: numberedMatch[2]!.trim(), line: line.line }] : [];
    });
};

const collectListDiffDetails = (actual: readonly string[], expected: readonly string[]): string[] => {
  const details: string[] = [];
  const missing = expected.filter((item) => !actual.includes(item));
  const unexpected = actual.filter((item) => !expected.includes(item));
  if (missing.length > 0) {
    details.push(`missing: ${missing.join(", ")}`);
  }
  if (unexpected.length > 0) {
    details.push(`unexpected: ${unexpected.join(", ")}`);
  }
  if (actual.length !== expected.length) {
    details.push(`count=${actual.length}, expected=${expected.length}`);
  }
  return details;
};

const collectExactListFindings = (input: {
  file: string;
  heading: string;
  sections: Map<string, MarkdownSection>;
  expected: readonly string[];
  missingMessage: string;
  driftMessage: string;
}): Finding[] => {
  const section = input.sections.get(input.heading);
  if (!section) {
    return [createFinding({ lawId: REQUIREMENT_ID_001, file: input.file, line: 1, severity: "fatal", message: input.missingMessage })];
  }

  const actual = collectSectionListItems(section).map((item) => item.value);
  const details = collectListDiffDetails(actual, input.expected);
  return details.length === 0
    ? []
    : [createFinding({
        lawId: REQUIREMENT_ID_001,
        file: input.file,
        line: section.line,
        severity: "fatal",
        message: `${input.driftMessage} Details: ${details.join("; ")}`,
      })];
};

const getStringLiteralValue = (node: Node | undefined): string | null => {
  if (!node) {
    return null;
  }
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralValue();
  }
  if (Node.isAsExpression(node) || Node.isTypeAssertion(node) || Node.isParenthesizedExpression(node)) {
    return getStringLiteralValue(node.getExpression());
  }
  return null;
};

const collectForbiddenOwnerLiteralFindings = (project: ReturnType<typeof getAuditProject>): Finding[] => {
  const findings: Finding[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const relativePath = toRelativeSourcePath(sourceFile);
    if (!GOVERNED_SURFACES.some((prefix) => relativePath.startsWith(prefix))) {
      continue;
    }

    for (const propertyAssignment of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
      const propertyName = propertyAssignment.getName();
      const literalValue = getStringLiteralValue(propertyAssignment.getInitializer());
      if (!OWNER_LITERAL_PROPERTIES.has(propertyName) || !literalValue || !FORBIDDEN_TOP_LEVEL_OWNER_LITERALS.has(literalValue)) {
        continue;
      }

      findings.push(createFinding({
        lawId: REQUIREMENT_ID_001,
        file: relativePath,
        line: getNodeLine(propertyAssignment),
        severity: "fatal",
        message: "Governed source still emits a forbidden top-level owner literal.",
        detail: `${propertyName}=${literalValue}`,
      }));
    }
  }

  return findings;
};

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

export async function runKernelChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const [kernelContent, blueprintContent] = await Promise.all([
    readTextFile(pathFromRepoRoot(KERNEL_FILE)),
    readTextFile(pathFromRepoRoot(BLUEPRINT_FILE)),
  ]);
  const project = getAuditProject();
  const kernelSections = parseMarkdownSections(kernelContent);
  const blueprintSections = parseMarkdownSections(blueprintContent);

  const supportLawBoundaryFindings = collectRequiredSectionLineFindings({
    requirementId: REQUIREMENT_ID_001,
    file: KERNEL_FILE,
    heading: "Fixed Formula",
    sections: kernelSections,
    expectedLine: "Support laws may define shell, storage, logging, topology, privacy, localization, and audit boundaries, but they must not create a second runtime chain.",
    missingMessage: "Kernel must declare the Fixed Formula section.",
    driftMessage: "Kernel support-law boundary must forbid creating a second runtime chain.",
  });
  const frozenConclusionFindings = [
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

  const kernelListFindings = collectExactListFindings({
    file: KERNEL_FILE,
    heading: "Active Ability Groups",
    sections: kernelSections,
    expected: ACTIVE_ABILITY_GROUPS,
    missingMessage: "Kernel must declare the Active Ability Groups section.",
    driftMessage: "Kernel active ability groups must match the fixed 14-owner constitution.",
  });
  const blueprintListFindings = collectExactListFindings({
    file: BLUEPRINT_FILE,
    heading: "14 个 active ability groups",
    sections: blueprintSections,
    expected: ACTIVE_ABILITY_GROUPS,
    missingMessage: "Frozen baseline must declare the 14 个 active ability groups section.",
    driftMessage: "Frozen baseline active ability groups must match the fixed 14-owner constitution.",
  });
  const foundationLawFindings = [
    ...collectExactListFindings({
      file: KERNEL_FILE,
      heading: "Foundation Laws",
      sections: kernelSections,
      expected: FOUNDATION_LAWS,
      missingMessage: "Kernel must declare the Foundation Laws section.",
      driftMessage: "Kernel foundation laws must match the fixed five-law baseline.",
    }),
    ...collectExactListFindings({
      file: BLUEPRINT_FILE,
      heading: "5 个 foundation laws",
      sections: blueprintSections,
      expected: FOUNDATION_LAWS,
      missingMessage: "Frozen baseline must declare the 5 个 foundation laws section.",
      driftMessage: "Frozen baseline foundation laws must match the fixed five-law baseline.",
    }),
  ];
  const supportGovernanceDomainFindings = [
    ...collectExactListFindings({
      file: KERNEL_FILE,
      heading: "Support Governance Domains",
      sections: kernelSections,
      expected: SUPPORT_GOVERNANCE_DOMAINS,
      missingMessage: "Kernel must declare the Support Governance Domains section.",
      driftMessage: "Kernel support governance domains must match the fixed single-domain baseline.",
    }),
    ...collectExactListFindings({
      file: BLUEPRINT_FILE,
      heading: "1 个 support governance domain",
      sections: blueprintSections,
      expected: SUPPORT_GOVERNANCE_DOMAINS,
      missingMessage: "Frozen baseline must declare the 1 个 support governance domain section.",
      driftMessage: "Frozen baseline support governance domains must match the fixed single-domain baseline.",
    }),
  ];
  const localDevelopmentToolingFindings = [
    ...collectExactListFindings({
      file: KERNEL_FILE,
      heading: "Local Development Tooling",
      sections: kernelSections,
      expected: LOCAL_DEVELOPMENT_TOOLING,
      missingMessage: "Kernel must declare the Local Development Tooling section.",
      driftMessage: "Kernel local development tooling must match the fixed debug-loop-controller baseline.",
    }),
    ...collectExactListFindings({
      file: BLUEPRINT_FILE,
      heading: "本地开发工具",
      sections: blueprintSections,
      expected: LOCAL_DEVELOPMENT_TOOLING,
      missingMessage: "Frozen baseline must declare the 本地开发工具 section.",
      driftMessage: "Frozen baseline local development tooling must match the fixed debug-loop-controller baseline.",
    }),
  ];
  const capabilityRootFindings = await collectCapabilityRootFindings();
  const forbiddenOwnerLiteralFindings = collectForbiddenOwnerLiteralFindings(project);

  return {
    findings: [
      ...supportLawBoundaryFindings,
      ...frozenConclusionFindings,
      ...kernelListFindings,
      ...blueprintListFindings,
      ...foundationLawFindings,
      ...supportGovernanceDomainFindings,
      ...localDevelopmentToolingFindings,
      ...capabilityRootFindings,
      ...forbiddenOwnerLiteralFindings,
    ],
    phases: [
      createPhase(
        "support-law-runtime-boundary",
        supportLawBoundaryFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        supportLawBoundaryFindings.length === 0,
        supportLawBoundaryFindings.length === 0
          ? "Kernel Fixed Formula keeps support laws as governance boundaries only, not a second runtime chain."
          : "Kernel Fixed Formula drifted and now allows a second runtime chain through support laws.",
      ),
      createPhase(
        "frozen-baseline-conclusion",
        frozenConclusionFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        frozenConclusionFindings.length === 0,
        frozenConclusionFindings.length === 0
          ? "Frozen baseline conclusion keeps the governed owner-count summary."
          : "Frozen baseline conclusion drifted away from the governed owner-count summary.",
      ),
      createPhase(
        "kernel-active-ability-groups",
        kernelListFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        kernelListFindings.length === 0,
        kernelListFindings.length === 0
          ? "Kernel keeps the fixed 14 active ability-group owners."
          : "Kernel Active Ability Groups drifted away from the fixed 14-owner constitution.",
      ),
      createPhase(
        "frozen-baseline-active-ability-groups",
        blueprintListFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        blueprintListFindings.length === 0,
        blueprintListFindings.length === 0
          ? "Frozen baseline keeps the fixed 14 active ability-group owners."
          : "Frozen baseline Active Ability Groups drifted away from the fixed 14-owner constitution.",
      ),
      createPhase(
        "foundation-laws-baseline",
        foundationLawFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        foundationLawFindings.length === 0,
        foundationLawFindings.length === 0
          ? "Kernel and frozen baseline keep the fixed five foundation laws."
          : "Kernel or frozen baseline foundation laws drifted away from the fixed five-law baseline.",
      ),
      createPhase(
        "support-governance-domain-baseline",
        supportGovernanceDomainFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        supportGovernanceDomainFindings.length === 0,
        supportGovernanceDomainFindings.length === 0
          ? "Kernel and frozen baseline keep the fixed support governance domain set."
          : "Kernel or frozen baseline support governance domains drifted away from the fixed single-domain baseline.",
      ),
      createPhase(
        "local-development-tooling-baseline",
        localDevelopmentToolingFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        localDevelopmentToolingFindings.length === 0,
        localDevelopmentToolingFindings.length === 0
          ? "Kernel and frozen baseline keep the fixed local development tooling set."
          : "Kernel or frozen baseline local development tooling drifted away from the fixed debug-loop-controller baseline.",
      ),
      createPhase(
        "capability-root-top-level-owners",
        capabilityRootFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        capabilityRootFindings.length === 0,
        capabilityRootFindings.length === 0
          ? "src/capabilities exposes only the 14 governed top-level ability-group roots."
          : "src/capabilities still exposes non-constitutional top-level roots.",
      ),
      createPhase(
        "forbidden-top-level-owner-literals",
        forbiddenOwnerLiteralFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        forbiddenOwnerLiteralFindings.length === 0,
        forbiddenOwnerLiteralFindings.length === 0
          ? "Governed source does not emit forbidden top-level owner literals."
          : "Governed source still emits forbidden top-level owner literals.",
      ),
    ],
  };
}
