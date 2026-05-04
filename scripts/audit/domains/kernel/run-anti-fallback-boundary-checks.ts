import { listFilesRecursive, readJsonFile, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { kernelInspectionConstants } from "./inspection-constants.js";

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const AI_CHILD_CONTRACT_ROOT = "src/capabilities/ai/children";
const EXECUTION_SURFACE_ROOTS = [
  "src/lib/browser",
  "src/lib/local-ai",
  "src/capabilities/open",
  "src/capabilities/mouse-click",
  "src/capabilities/mouse-scroll",
  "src/capabilities/text-input",
] as const;

const CLOUD_PROVIDER_TOKENS = ["openai", "anthropic", "gemini"] as const;
const SELECTOR_DOM_TOKENS = [
  "targetSelector",
  "cssSelector",
  "domSelector",
  "querySelector(",
  "document.",
  "locator(",
  "page.click(",
  "page.fill(",
  "page.type(",
] as const;
const HIDDEN_BRIDGE_TOKENS = ["bridge", "compat", "legacy"] as const;

const { REQUIREMENT_ID_016 } = kernelInspectionConstants;

const createRequirementFinding = (input: {
  file: string;
  message: string;
  detail?: string;
}): Finding => createFinding({
  lawId: REQUIREMENT_ID_016,
  file: input.file,
  line: 1,
  severity: "fatal",
  message: input.message,
  ...(input.detail ? { detail: input.detail } : {}),
});

const collectCloudProviderDependencyFindings = (packageJson: PackageJson): Finding[] => {
  const dependencyNames = Object.keys({
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  });
  const forbiddenDependencies = dependencyNames.filter((name) => CLOUD_PROVIDER_TOKENS.some((token) => name.toLowerCase().includes(token)));

  if (forbiddenDependencies.length === 0) {
    return [];
  }

  return [createRequirementFinding({
    file: "package.json",
    message: "Workspace dependencies must not pull cloud AI clients into the active runtime chain.",
    detail: forbiddenDependencies.join(", "),
  })];
};

async function collectLocalAiConfigFindings(): Promise<Finding[]> {
  const schemaText = await readTextFile(pathFromRepoRoot("src/lib/local-ai/model-config.ts"));
  const config = await readJsonFile<Record<string, unknown>>(pathFromRepoRoot("config/local-ai.models.json"));
  const findings: Finding[] = [];

  if (!schemaText.includes('allowCloudFallback: z.literal(false)') || !schemaText.includes('executionPosture: z.literal("local-only")')) {
    findings.push(createRequirementFinding({
      file: "src/lib/local-ai/model-config.ts",
      message: "Local AI runtime config schema must stay local-only and must not allow cloud fallback.",
    }));
  }

  if (config.executionPosture !== "local-only" || config.allowCloudFallback !== false || config.allowPaidApi !== false) {
    findings.push(createRequirementFinding({
      file: "config/local-ai.models.json",
      message: "Local AI runtime config must stay local-only and must not allow cloud fallback.",
      detail: `executionPosture=${String(config.executionPosture)}, allowCloudFallback=${String(config.allowCloudFallback)}, allowPaidApi=${String(config.allowPaidApi)}`,
    }));
  }

  const roleViolations = Object.entries(config.roles ?? {})
    .filter(([, value]) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return true;
      }
      return (value as Record<string, unknown>).allowCloudFallback !== false || (value as Record<string, unknown>).executionMode !== "local-only";
    })
    .map(([role]) => role);
  if (roleViolations.length > 0) {
    findings.push(createRequirementFinding({
      file: "config/local-ai.models.json",
      message: "All local AI roles must stay local-only and must not allow cloud fallback.",
      detail: roleViolations.join(", "),
    }));
  }

  return findings;
}

async function collectDisabledProviderFallbackFindings(): Promise<Finding[]> {
  const findings: Finding[] = [];
  const contractFiles = (await listFilesRecursive(pathFromRepoRoot(AI_CHILD_CONTRACT_ROOT), { extensions: [".ts"] }))
    .filter((filePath) => filePath.endsWith("/contract.ts"))
    .sort();

  for (const filePath of contractFiles) {
    const relativeFile = toRepoRelativePath(filePath);
    const text = await readTextFile(filePath);
    const isFutureOrPaidProvider = text.includes('providerKind: "future"') || text.includes('providerKind: "paid"');
    if (!isFutureOrPaidProvider) {
      continue;
    }

    const fallbackMarkerCount = text.split("forbidsLocalFallback: true").length - 1;
    if (fallbackMarkerCount < 2) {
      findings.push(createRequirementFinding({
        file: relativeFile,
        message: "Disabled or future AI child contracts must not permit fallback escape.",
        detail: `forbidsLocalFallback markers=${fallbackMarkerCount}`,
      }));
    }
  }

  return findings;
}

async function collectSelectorDomFindings(): Promise<Finding[]> {
  const findings: Finding[] = [];

  for (const root of EXECUTION_SURFACE_ROOTS) {
    const files = await listFilesRecursive(pathFromRepoRoot(root), { extensions: [".ts", ".js"] });
    for (const filePath of files) {
      const relativeFile = toRepoRelativePath(filePath);
      const text = await readTextFile(filePath);
      const matchedTokens = SELECTOR_DOM_TOKENS.filter((token) => text.includes(token));
      if (matchedTokens.length === 0) {
        continue;
      }

      findings.push(createRequirementFinding({
        file: relativeFile,
        message: "Execution surfaces must not expose DOM selectors, locator paths, or DOM scraping contracts.",
        detail: matchedTokens.join(", "),
      }));
    }
  }

  return findings;
}

async function collectHiddenBridgeFindings(): Promise<Finding[]> {
  const findings: Finding[] = [];

  for (const root of EXECUTION_SURFACE_ROOTS) {
    const files = await listFilesRecursive(pathFromRepoRoot(root), { extensions: [".ts", ".js"] });
    const offendingFiles = files
      .map((filePath) => toRepoRelativePath(filePath))
      .filter((relativePath) => HIDDEN_BRIDGE_TOKENS.some((token) => relativePath.toLowerCase().includes(token)));

    if (offendingFiles.length === 0) {
      continue;
    }

    findings.push(createRequirementFinding({
      file: offendingFiles[0] ?? root,
      message: "Execution surfaces must not add hidden compat, bridge, or legacy paths.",
      detail: offendingFiles.join(", "),
    }));
  }

  return findings;
}

export async function runAntiFallbackBoundaryChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const packageJson = await readJsonFile<PackageJson>(pathFromRepoRoot("package.json"));
  const [
    localAiConfigFindings,
    disabledProviderFallbackFindings,
    selectorDomFindings,
    hiddenBridgeFindings,
  ] = await Promise.all([
    collectLocalAiConfigFindings(),
    collectDisabledProviderFallbackFindings(),
    collectSelectorDomFindings(),
    collectHiddenBridgeFindings(),
  ]);
  const cloudProviderDependencyFindings = collectCloudProviderDependencyFindings(packageJson);

  return {
    findings: [
      ...cloudProviderDependencyFindings,
      ...localAiConfigFindings,
      ...disabledProviderFallbackFindings,
      ...selectorDomFindings,
      ...hiddenBridgeFindings,
    ],
    phases: [
      createPhase(
        "anti-cloud-fallback-config",
        cloudProviderDependencyFindings.length + localAiConfigFindings.length + disabledProviderFallbackFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        cloudProviderDependencyFindings.length + localAiConfigFindings.length + disabledProviderFallbackFindings.length === 0,
        cloudProviderDependencyFindings.length + localAiConfigFindings.length + disabledProviderFallbackFindings.length === 0
          ? "AI runtime contracts stay local-only and keep cloud fallback disabled."
          : "AI runtime contracts or dependencies drifted toward cloud or fallback execution.",
      ),
      createPhase(
        "anti-selector-dom-contracts",
        selectorDomFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        selectorDomFindings.length === 0,
        selectorDomFindings.length === 0
          ? "Execution surfaces expose geometry- and ref-based contracts without selector or DOM scraping paths."
          : "Execution surfaces still expose selector or DOM scraping contracts.",
      ),
      createPhase(
        "anti-hidden-compat-bridges",
        hiddenBridgeFindings.length === 0 ? "PASS" : "CODE VIOLATION",
        hiddenBridgeFindings.length === 0,
        hiddenBridgeFindings.length === 0
          ? "Execution surfaces have no hidden compat, bridge, or legacy paths."
          : "Execution surfaces still contain hidden compat, bridge, or legacy paths.",
      ),
    ],
  };
}