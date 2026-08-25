import type { InspectorExecutedCheck } from "./inspector-contracts.js";

type RouteInput = Readonly<{
  lawId: string;
  evidenceMode: string;
  clauses: readonly string[];
  semanticChecks: readonly string[];
}>;

const ordered = (values: readonly string[]): string[] => [...new Set(values)].sort((left, right) =>
  Buffer.compare(Buffer.from(left), Buffer.from(right)));

const route = (input: RouteInput): InspectorExecutedCheck => ({
  lawId: input.lawId,
  evidenceMode: input.evidenceMode,
  clauses: ordered(input.clauses),
  checkId: `${input.lawId.toLocaleLowerCase("en-US")}/${input.evidenceMode.replace("static.", "static-")}`,
  semanticChecks: ordered(input.semanticChecks),
});

const summaryRoutes = (
  lawId: string,
  evidenceModes: readonly string[],
  semanticChecks: readonly string[],
): InspectorExecutedCheck[] => evidenceModes.map((evidenceMode) => route({
  lawId,
  evidenceMode,
  clauses: ["summary"],
  semanticChecks,
}));

const allClauses = (forbiddenCount: number): string[] => [
  ...Array.from({ length: forbiddenCount }, (_, index) => `forbidden:${index}`),
  "summary",
];

const aiTransportChecks = ["inspectPublicBoundary"];
const aiParallelChecks = [
  "inspectBoundedParallelExecution",
  "inspectSerialProviderBrowserActions",
  "inspectFreshConversationIdentity",
  "inspectNoChatGptPageRefresh",
  "inspectCanonicalConversationIdentity",
  "inspectAiInputGatewayRecovery",
  "inspectSubmissionPriorityPatrol",
  "inspectSharedRateLimitWatcher",
  "inspectLiveGenerationProof",
  "inspectTransientPatrolRetry",
  "inspectTransientSubmissionIsNotRoutable",
  "inspectTransientOverlayHygiene",
  "inspectGeneratedImageCapture",
  "inspectConversationTopology",
];

const routesByDomain: Readonly<Record<string, readonly InspectorExecutedCheck[]>> = {
  "ai-input-gateway": [
    ...summaryRoutes("LAW-AI-INPUT-GATEWAY-001-V1", ["static.ast", "static.contract"], aiTransportChecks),
    ...summaryRoutes("LAW-AI-INPUT-GATEWAY-002-V1", ["static.ast"], ["inspectAtomicIfAndThenActions"]),
    ...summaryRoutes("LAW-AI-INPUT-GATEWAY-003-V1", ["static.ast", "static.contract"], [
      "inspectAttachmentRoutingChild", "inspectRemovedRegion",
    ]),
    ...summaryRoutes("LAW-AI-INPUT-GATEWAY-004-V1", ["static.ast", "static.contract"], ["inspectAttachmentProofChild"]),
    ...summaryRoutes("LAW-AI-INPUT-GATEWAY-005-V4", ["static.ast", "static.contract"], aiParallelChecks),
    ...summaryRoutes("LAW-AI-INPUT-GATEWAY-006-V1", ["static.ast", "static.contract"], ["inspectBoundedChoiceJudge"]),
    ...summaryRoutes("LAW-AI-INPUT-GATEWAY-007-V1", ["static.ast", "static.contract"], ["inspectCallerApprovedInputReferences"]),
  ],
  "app-shell-ui": [
    ...summaryRoutes("LAW-APP-SHELL-UI-001-V2", ["static.ast"], [
      "inspectAppShellLayout", "inspectForbiddenAppShellActions", "inspectSkillRegistry",
    ]),
    ...summaryRoutes("LAW-APP-SHELL-UI-002-V1", ["static.ast"], ["inspectAppShellLocalization"]),
    ...summaryRoutes("LAW-APP-SHELL-UI-003-V2", ["static.ast"], ["inspectLegacyAppUserDemandPhysicalAbsence"]),
  ],
  "architecture-boundary": [
    route({
      lawId: "LAW-ARCHITECTURE-BOUNDARY-001-V1",
      evidenceMode: "static.ast",
      clauses: allClauses(7),
      semanticChecks: [
        "inspectRootAllowlist", "inspectProjectSources", "inspectActivePluginGate",
        "inspectActivePluginMediators", "inspectTypesContractRoot",
      ],
    }),
    ...summaryRoutes("LAW-ARCHITECTURE-BOUNDARY-001-V1", [
      "static.dependency", "static.filesystem", "static.types",
    ], ["inspectProjectSources", "inspectRootAllowlist", "inspectTypesContractRoot"]),
  ],
  "capability-governance": summaryRoutes("LAW-CAPABILITY-GOVERNANCE-001-V2", [
    "static.ast", "static.dependency", "static.filesystem", "static.types",
  ], ["inspectCapabilityGovernanceProject"]),
  "code-purity": [
    route({
      lawId: "LAW-CODE-PURITY-001-V2",
      evidenceMode: "static.ast",
      clauses: [
        "forbidden:0", "forbidden:1", "forbidden:4", "forbidden:5", "forbidden:6",
        "forbidden:8", "forbidden:9", "forbidden:11", "forbidden:12", "forbidden:13",
        "forbidden:14", "summary",
      ],
      semanticChecks: ["runCodePurityPhases"],
    }),
    ...summaryRoutes("LAW-CODE-PURITY-001-V2", [
      "static.config", "static.dependency", "static.filesystem", "static.json", "static.types",
    ], ["runCodePurityPhases"]),
  ],
  "forensics-persistence-capability": [
    ...summaryRoutes("LAW-FORENSICS-PERSISTENCE-CAPABILITY-001-V2", ["static.ast", "static.contract"], [
      "inspectCapabilityRequiredFiles", "inspectOwnerImports", "inspectPublicFacade",
    ]),
    ...summaryRoutes("LAW-FORENSICS-PERSISTENCE-CAPABILITY-002-V2", ["static.ast", "static.contract"], [
      "inspectStorageRequiredFiles", "inspectStoragePort",
    ]),
    ...summaryRoutes("LAW-FORENSICS-PERSISTENCE-CAPABILITY-003-V2", ["static.ast", "static.contract"], [
      "inspectSchemaVocabulary",
    ]),
  ],
  "local-app-shell": [
    route({
      lawId: "LAW-LOCAL-APP-SHELL-001-V5",
      evidenceMode: "static.ast",
      clauses: ["forbidden:4", "forbidden:7", "forbidden:8", "summary"],
      semanticChecks: ["inspectShellOwnership"],
    }),
    ...summaryRoutes("LAW-LOCAL-APP-SHELL-001-V5", ["static.contract"], ["inspectShellOwnership"]),
    ...summaryRoutes("LAW-LOCAL-APP-SHELL-002-V3", ["static.ast"], ["inspectBrowserAuthorityBoundary"]),
    route({
      lawId: "LAW-LOCAL-APP-SHELL-003-V2",
      evidenceMode: "static.ast",
      clauses: ["forbidden:0", "forbidden:1", "summary"],
      semanticChecks: ["inspectSeparatedStatus"],
    }),
  ],
  "local-browser-session": [
    route({
      lawId: "LAW-LOCAL-BROWSER-SESSION-001-V4", evidenceMode: "static.ast", clauses: allClauses(10),
      semanticChecks: ["inspectSingleTransport", "collectTransportPayloadCeilingFindings"],
    }),
    ...summaryRoutes("LAW-LOCAL-BROWSER-SESSION-001-V4", ["static.contract"], ["inspectSingleTransport"]),
    route({
      lawId: "LAW-LOCAL-BROWSER-SESSION-002-V4", evidenceMode: "static.ast", clauses: allClauses(11),
      semanticChecks: ["inspectAuthenticatedChannelGuards"],
    }),
    ...summaryRoutes("LAW-LOCAL-BROWSER-SESSION-002-V4", ["static.contract"], ["inspectAuthenticatedChannelGuards"]),
    route({
      lawId: "LAW-LOCAL-BROWSER-SESSION-003-V6", evidenceMode: "static.ast", clauses: allClauses(12),
      semanticChecks: ["inspectTargetClaimGuards"],
    }),
    ...summaryRoutes("LAW-LOCAL-BROWSER-SESSION-003-V6", ["static.contract"], ["inspectTargetClaimGuards"]),
    route({
      lawId: "LAW-LOCAL-BROWSER-SESSION-004-V6", evidenceMode: "static.ast",
      clauses: ["forbidden:10", "forbidden:11", "forbidden:12", "forbidden:13", "forbidden:14", "forbidden:15", "summary"],
      semanticChecks: ["inspectRegistryAndMutationBoundary", "inspectAtomicIfAndThenBoundary", "inspectJournalRecoveryBoundary"],
    }),
    route({
      lawId: "LAW-LOCAL-BROWSER-SESSION-005-V4", evidenceMode: "static.ast", clauses: allClauses(5),
      semanticChecks: ["inspectReleaseAndRetiredPaths"],
    }),
    ...summaryRoutes("LAW-LOCAL-BROWSER-SESSION-005-V4", ["static.contract"], ["inspectReleaseAndRetiredPaths"]),
    route({
      lawId: "LAW-LOCAL-BROWSER-SESSION-006-V2", evidenceMode: "static.ast", clauses: ["forbidden:0", "summary"],
      semanticChecks: ["inspectOpaqueAuthorityBoundary"],
    }),
    ...summaryRoutes("LAW-LOCAL-BROWSER-SESSION-006-V2", ["static.contract"], ["inspectOpaqueAuthorityBoundary"]),
  ],
  "runtime-log-spine": [
    ...summaryRoutes("LAW-RUNTIME-LOG-SPINE-001-V3", ["static.ast", "static.contract"], ["collectRuntimeOperationalTraceFindings"]),
    ...summaryRoutes("LAW-RUNTIME-LOG-SPINE-002-V2", ["static.ast", "static.contract"], ["collectRuntimeRedactionFindings"]),
    ...summaryRoutes("LAW-RUNTIME-LOG-SPINE-003-V2", ["static.ast", "static.contract"], ["collectRuntimeContractFindings"]),
  ],
  "startup-entrypoint": [
    route({
      lawId: "LAW-STARTUP-ENTRYPOINT-001-V4", evidenceMode: "static.ast", clauses: ["forbidden:11", "summary"],
      semanticChecks: ["inspectStartupBoundary"],
    }),
    ...summaryRoutes("LAW-STARTUP-ENTRYPOINT-001-V4", ["static.contract"], ["inspectStartupBoundary"]),
    route({
      lawId: "LAW-STARTUP-ENTRYPOINT-002-V1", evidenceMode: "static.ast", clauses: ["forbidden:0", "summary"],
      semanticChecks: ["inspectLocalStartupAuthorityBoundary"],
    }),
    ...summaryRoutes("LAW-STARTUP-ENTRYPOINT-002-V1", ["static.contract"], ["inspectLocalStartupAuthorityBoundary"]),
  ],
  "system-security": summaryRoutes("LAW-SYSTEM-SECURITY-001-V1", [
    "static.ast", "static.config", "static.contract", "static.dependency", "static.types",
  ], ["inspectSystemSecurityProject"]),
  "workbench-api-boundary": [
    route({
      lawId: "LAW-WORKBENCH-API-BOUNDARY-001-V4", evidenceMode: "static.ast", clauses: allClauses(7),
      semanticChecks: [
        "inspectRequiredFiles", "inspectRouteRules", "inspectForbiddenKeys", "inspectExternalIngressIdentity",
        "inspectSecondServers", "inspectCallbackEscapes",
      ],
    }),
    ...summaryRoutes("LAW-WORKBENCH-API-BOUNDARY-001-V4", ["static.contract"], [
      "inspectRouteRules", "inspectExternalIngressIdentity",
    ]),
  ],
  "xuanxue-ai-production": summaryRoutes("LAW-XUANXUE-AI-PRODUCTION-001-V9", [
    "static.ast", "static.contract",
  ], ["inspectDomainPolicy"]),
  "xuanxue-ai-production-localization-contract": summaryRoutes(
    "LAW-XUANXUE-AI-PRODUCTION-LOCALIZATION-CONTRACT-001-V4",
    ["static.ast"],
    ["inspectXuanxueLocalizationContract"],
  ),
};

export const staticClauseRoutesForDomain = (domain: string): InspectorExecutedCheck[] =>
  (routesByDomain[domain] ?? []).map((entry) => ({
    ...entry,
    clauses: [...entry.clauses],
    semanticChecks: [...entry.semanticChecks],
  }));
