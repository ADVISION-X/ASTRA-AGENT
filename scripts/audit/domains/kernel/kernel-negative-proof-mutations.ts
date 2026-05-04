export type KernelNegativeProofMutation = {
  name: string;
  file: string;
  search?: string;
  replace?: string;
  mode?: "replace" | "write";
  content?: string;
  expectedNeedle: string;
};

type KernelNegativeProofMutationInput = {
  aiPromptContractRoot: string;
  blueprintFile: string;
  inspectorEntry: string;
  kernelFile: string;
  promptContractGovernanceBlueprintFile: string;
  runInspectorFile: string;
};

type KernelNegativeProofMutationCatalogEntry = Omit<KernelNegativeProofMutation, "file"> & {
  file: string | ((input: KernelNegativeProofMutationInput) => string);
};

const KERNEL_NEGATIVE_PROOF_MUTATION_CATALOG: KernelNegativeProofMutationCatalogEntry[] = [
  {
    name: "kernel active-owner drift mutation",
    file: (input) => input.kernelFile,
    search: "- text-input",
    replace: "- map-plugin-package",
    expectedNeedle: "Kernel active ability groups must match the fixed 14-owner constitution.",
  },
  {
    name: "frozen baseline active-owner drift mutation",
    file: (input) => input.blueprintFile,
    search: "10. text-input",
    replace: "10. map-plugin-package",
    expectedNeedle: "Frozen baseline active ability groups must match the fixed 14-owner constitution.",
  },
  {
    name: "frozen conclusion active-owner count drift mutation",
    file: (input) => input.blueprintFile,
    search: "- 14 个 active ability groups",
    replace: "- 13 个 active ability groups",
    expectedNeedle: "Frozen baseline conclusion must declare 14 个 active ability groups.",
  },
  {
    name: "frozen conclusion foundation-law count drift mutation",
    file: (input) => input.blueprintFile,
    search: "- 5 个 foundation laws",
    replace: "- 4 个 foundation laws",
    expectedNeedle: "Frozen baseline conclusion must declare 5 个 foundation laws.",
  },
  {
    name: "frozen conclusion support-domain count drift mutation",
    file: (input) => input.blueprintFile,
    search: "- 1 个 support governance domain",
    replace: "- 2 个 support governance domains",
    expectedNeedle: "Frozen baseline conclusion must declare 1 个 support governance domain.",
  },
  {
    name: "frozen conclusion child-contract summary drift mutation",
    file: (input) => input.blueprintFile,
    search: "- 若干父 owner 子契约法案",
    replace: "- 无父 owner 子契约法案",
    expectedNeedle: "Frozen baseline conclusion must declare parent-owner child-contract law files.",
  },
  {
    name: "forbidden owner literal mutation",
    file: "src/lib/local-runtime/workbench-action-dispatch-inputs.ts",
    search: '    abilityGroupId: "mouse-click",',
    replace: '    abilityGroupId: "platform-action",',
    expectedNeedle: "Governed source still emits a forbidden top-level owner literal.",
  },
  {
    name: "legacy owner literal mutation",
    file: "src/lib/local-runtime/workbench-action-dispatch-inputs.ts",
    search: '    abilityGroupId: "mouse-click",',
    replace: '    abilityGroupId: "agent-runtime",',
    expectedNeedle: "Governed source still emits a forbidden top-level owner literal.",
  },
  {
    name: "browser primitive owner literal mutation",
    file: "src/lib/local-runtime/workbench-action-dispatch-inputs.ts",
    search: '    abilityGroupId: "mouse-click",',
    replace: '    abilityGroupId: "browser-controller",',
    expectedNeedle: "Governed source still emits a forbidden top-level owner literal.",
  },
  {
    name: "local-data owner literal mutation",
    file: "src/lib/local-runtime/workbench-action-dispatch-inputs.ts",
    search: '    abilityGroupId: "mouse-click",',
    replace: '    abilityGroupId: "local-data",',
    expectedNeedle: "Governed source still emits a forbidden top-level owner literal.",
  },
  {
    name: "child audit entrypoint drift mutation",
    file: "package.json",
    search: '    "audit:mouse-click": "node --import tsx scripts/audit/domains/mouse-click-capability/run-inspector.ts",',
    replace: '    "audit:open-tiktok": "node --import tsx scripts/audit/domains/mouse-click-capability/run-inspector.ts",',
    expectedNeedle: "package.json must not expose audit:open-tiktok; child abilities may exist only under one parent ability group.",
  },
  {
    name: "prompt governance owner drift mutation",
    file: (input) => input.promptContractGovernanceBlueprintFile,
    search: "owner: ai-capability",
    replace: "owner: map-plugin-package",
    expectedNeedle: "Prompt contract governance blueprint must declare ai-capability ownership and map-plugin-package reference-only status.",
  },
  {
    name: "legacy owner audit entrypoint mutation",
    file: "package.json",
    search: '    "audit:mouse-click": "node --import tsx scripts/audit/domains/mouse-click-capability/run-inspector.ts",',
    replace: '    "audit:agent-runtime": "node --import tsx scripts/audit/domains/mouse-click-capability/run-inspector.ts",',
    expectedNeedle: "package.json must not expose audit:agent-runtime; retired legacy owners must not be reintroduced as active owners.",
  },
  {
    name: "non-owner audit entrypoint mutation",
    file: "package.json",
    search: '    "audit:mouse-click": "node --import tsx scripts/audit/domains/mouse-click-capability/run-inspector.ts",',
    replace: '    "audit:startup-entrypoint": "node --import tsx scripts/audit/domains/mouse-click-capability/run-inspector.ts",',
    expectedNeedle: "package.json must not expose audit:startup-entrypoint; non-capability surfaces must not publish audit owners.",
  },
  {
    name: "platform adapter audit owner mutation",
    file: "package.json",
    search: '    "audit:mouse-click": "node --import tsx scripts/audit/domains/mouse-click-capability/run-inspector.ts",',
    replace: '    "audit:platform-adapter": "node --import tsx scripts/audit/domains/mouse-click-capability/run-inspector.ts",',
    expectedNeedle: "package.json must not expose audit:platform-adapter; PlatformAdapter, feature folders, helper files, startup scripts, and browser primitives must not publish ability owners.",
  },
  {
    name: "forbidden feature runtime root mutation",
    file: "src/features/platform-action",
    mode: "write",
    content: "legacy runtime root should not exist\n",
    expectedNeedle: "src/features/local-data and src/features/platform-action must not exist as active runtime roots after capability-group cutover.",
  },
  {
    name: "support-law second-runtime-chain mutation",
    file: (input) => input.kernelFile,
    search: "- Support laws may define shell, storage, logging, topology, privacy, localization, and audit boundaries, but they must not create a second runtime chain.",
    replace: "- Support laws may define shell, storage, logging, topology, privacy, localization, and audit boundaries, and they may create a second runtime chain.",
    expectedNeedle: "Kernel support-law boundary must forbid creating a second runtime chain.",
  },
  {
    name: "foundation-law baseline drift mutation",
    file: (input) => input.kernelFile,
    search: "## Foundation Laws\n\n- audit-system\n- capability-group-governance\n- code-purity\n- type-safety\n- security-privacy",
    replace: "## Foundation Laws\n\n- audit-system\n- map-plugin-package\n- code-purity\n- type-safety\n- security-privacy",
    expectedNeedle: "Kernel foundation laws must match the fixed five-law baseline.",
  },
  {
    name: "support-governance-domain drift mutation",
    file: (input) => input.kernelFile,
    search: "## Support Governance Domains\n\n- map-plugin-package",
    replace: "## Support Governance Domains\n\n- debug-loop-controller",
    expectedNeedle: "Kernel support governance domains must match the fixed single-domain baseline.",
  },
  {
    name: "local-development-tooling drift mutation",
    file: (input) => input.kernelFile,
    search: "## Local Development Tooling\n\n- debug-loop-controller",
    replace: "## Local Development Tooling\n\n- local-app-shell",
    expectedNeedle: "Kernel local development tooling must match the fixed debug-loop-controller baseline.",
  },
  {
    name: "child contract ownership drift mutation",
    file: (input) => input.blueprintFile,
    search: "| platform-action | open-capability | 否 | open-capability |",
    replace: "| platform-action | platform-action | 是 | platform-action |",
    expectedNeedle: "Frozen baseline child-contract ownership table must match the governed parent-owner mapping.",
  },
  {
    name: "deleted owner list revival mutation",
    file: (input) => input.blueprintFile,
    search: "- local-data",
    replace: "- audit-system",
    expectedNeedle: "Frozen baseline deleted active owner list drifted away from the governed baseline.",
  },
  {
    name: "generated artifact source mutation",
    file: "package.json",
    search: '    "audit:build": "node --import tsx scripts/audit/build-audit-artifacts-cli.ts",',
    replace: '    "audit:build": "node scripts/audit/generated/fake-pass.js",',
    expectedNeedle: "audit:build must keep generated registry, matrix, and audit-plan sourced from the governed build-audit-artifacts CLI.",
  },
  {
    name: "kernel run-inspector build bypass mutation",
    file: (input) => input.runInspectorFile,
    search: "  await buildAuditArtifacts();",
    replace: "  // build bypassed by mutation",
    expectedNeedle: "Kernel run-inspector must rebuild generated audit artifacts before loading them.",
  },
  {
    name: "audit truth boundary mutation",
    file: "package.json",
    search: '    "audit:kernel": "node --import tsx scripts/audit/domains/kernel/run-inspector.ts",',
    replace: '    "audit:kernel": "node scripts/verify/fake-kernel-check.ts",',
    expectedNeedle: "Audit entrypoint audit:kernel must not delegate enforcement truth to verify/test/ad-hoc quality scripts.",
  },
  {
    name: "cloud fallback config mutation",
    file: "config/local-ai.models.json",
    search: '  "allowCloudFallback": false,',
    replace: '  "allowCloudFallback": true,',
    expectedNeedle: "Local AI runtime config must stay local-only and must not allow cloud fallback.",
  },
  {
    name: "future provider fallback escape mutation",
    file: "src/capabilities/ai/children/future-api-ai/contract.ts",
    search: "    forbidsLocalFallback: true,",
    replace: "    forbidsLocalFallback: false,",
    expectedNeedle: "Disabled or future AI child contracts must not permit fallback escape.",
  },
  {
    name: "selector contract mutation",
    file: "src/lib/browser/browser-controller.ts",
    search: "    abortSignal?: AbortSignal;\n  }): Promise<BrowserActionResult>;",
    replace: "    abortSignal?: AbortSignal;\n    targetSelector?: string;\n  }): Promise<BrowserActionResult>;",
    expectedNeedle: "Execution surfaces must not expose DOM selectors, locator paths, or DOM scraping contracts.",
  },
  {
    name: "hidden compat bridge mutation",
    file: "src/lib/browser/selector-compat-bridge.ts",
    mode: "write",
    content: "export const selectorCompatBridge = true;\n",
    expectedNeedle: "Execution surfaces must not add hidden compat, bridge, or legacy paths.",
  },
  {
    name: "prompt contract action boundary mutation",
    file: (input) => `${input.aiPromptContractRoot}/builtins/map.authoring.v1.prompt-contract.json`,
    search: '  "prohibitedActions": ["click", "scroll", "type", "open_page", "dispatch_action"],',
    replace: '  "prohibitedActions": [],',
    expectedNeedle: "Prompt contract map.authoring.v1 must prohibit executing actions.",
  },
  {
    name: "map package raw prompt mutation",
    file: "src/map-plugins/builtins/tiktok-product-discovery.map-package.json",
    search: '{ "stepId": "ask-product-presence", "promptContractId": "vision.productPresence.v1", "requiredInputRefs": ["promptInputRef"], "outputSchemaRef": "ai.product_presence_judgment.v1", "confidencePolicy": "review-on-low-confidence", "reviewPolicy": "handoff", "failureBranch": "ask-product-presence:failed" }',
    replace: '{ "stepId": "ask-product-presence", "promptContractId": "vision.productPresence.v1", "rawPrompt": "illegal", "requiredInputRefs": ["promptInputRef"], "outputSchemaRef": "ai.product_presence_judgment.v1", "confidencePolicy": "review-on-low-confidence", "reviewPolicy": "handoff", "failureBranch": "ask-product-presence:failed" }',
    expectedNeedle: "Map packages must reference promptContractId only; raw prompt fields are forbidden in map packages.",
  },
  {
    name: "negative-proof invocation removed mutation",
    file: (input) => input.inspectorEntry,
    search: "    : await runNegativeProofHarness();",
    replace: '    : { findings: [], phase: { name: "negative-proof-harness", classification: "PASS" as const, passed: true, summary: "negative-proof removed by mutation" } };',
    expectedNeedle: "Kernel inspector must invoke and report the negative-proof harness.",
  },
];

const resolveMutationFile = (entry: KernelNegativeProofMutationCatalogEntry, input: KernelNegativeProofMutationInput): string => {
  return typeof entry.file === "function" ? entry.file(input) : entry.file;
};

export const kernelNegativeProofMutations = (input: KernelNegativeProofMutationInput): KernelNegativeProofMutation[] => {
  return KERNEL_NEGATIVE_PROOF_MUTATION_CATALOG.map((entry) => ({
    ...entry,
    file: resolveMutationFile(entry, input),
  }));
};