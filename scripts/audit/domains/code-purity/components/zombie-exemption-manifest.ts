export type ZombieEntryFileExemption = {
  filePath: string;
  reason: string;
};

export type ZombieEntryExportExemption = {
  exportName: string;
  filePath: string;
  reason: string;
};

export type ZombieDynamicImportExemption = {
  consumerFilePath: string;
  reason: string;
  targetFilePath: string;
};

export type ZombieSideEffectImportExemption = {
  consumerFilePath: string;
  reason: string;
  targetFilePath: string;
};

export type ZombieDynamicNamespaceExemption = {
  consumerFilePath: string;
  reason: string;
  targetFilePath: string;
};

export type ZombieDynamicRegistryConsumerExemption = {
  consumerFilePath: string;
  reason: string;
  registryExportName: string;
  registryFilePath: string;
};

export type ZombieExemptionManifest = {
  externalEntryExports: readonly ZombieEntryExportExemption[];
  externalEntryFiles: readonly ZombieEntryFileExemption[];
  lawfulDynamicImports: readonly ZombieDynamicImportExemption[];
  lawfulDynamicRegistryConsumers: readonly ZombieDynamicRegistryConsumerExemption[];
  lawfulDynamicNamespaceConsumers: readonly ZombieDynamicNamespaceExemption[];
  lawfulSideEffectImports: readonly ZombieSideEffectImportExemption[];
};

const emptyEntryExports: readonly ZombieEntryExportExemption[] = [];
const emptyEntryFiles: readonly ZombieEntryFileExemption[] = [];
const emptyDynamicImports: readonly ZombieDynamicImportExemption[] = [];
const emptyDynamicNamespaceConsumers: readonly ZombieDynamicNamespaceExemption[] = [];
const emptySideEffectImports: readonly ZombieSideEffectImportExemption[] = [];

const lawfulDynamicRegistryConsumers: readonly ZombieDynamicRegistryConsumerExemption[] = [
  {
    consumerFilePath: "src/capabilities/ai-input-gateway/runtime/feed-gemini-api-once.ts",
    registryFilePath: "src/capabilities/ai-input-gateway/providers/gemini-api.adapter.ts",
    registryExportName: "geminiApiAdapter",
    reason: "Default Gemini API adapter is intentionally passed as a full provider contract.",
  },
  {
    consumerFilePath: "src/capabilities/ai-input-gateway/runtime/feed-gemini-web-chat-once.ts",
    registryFilePath: "src/capabilities/ai-input-gateway/providers/gemini-web-chat.adapter.ts",
    registryExportName: "geminiWebChatAdapter",
    reason: "Default Gemini web-chat adapter is intentionally passed as a full provider contract.",
  },
  {
    consumerFilePath: "src/capabilities/ai-input-gateway/runtime/feed-gpt-web-chat-once.ts",
    registryFilePath: "src/capabilities/ai-input-gateway/providers/gpt-web-chat.adapter.ts",
    registryExportName: "gptWebChatAdapter",
    reason: "Default GPT web-chat adapter is intentionally passed as a full provider contract.",
  },
  {
    consumerFilePath: "src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts",
    registryFilePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts",
    registryExportName: "businessHtmlReportPublisherPrompt",
    reason: "HTML report stage passes the full prompt contract as a bounded prompt asset.",
  },
  {
    consumerFilePath: "src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts",
    registryFilePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts",
    registryExportName: "finalAdjudicationPrompt",
    reason: "Final adjudication stage passes the full prompt contract as a bounded prompt asset.",
  },
  {
    consumerFilePath: "src/plugins/deep-research-analysis/deep-research-analysis.public.ts",
    registryFilePath: "src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts",
    registryExportName: "finalAdjudicationPrompt",
    reason: "Report reader prompt reconstruction uses the full prompt contract for hash verification.",
  },
  {
    consumerFilePath: "src/capabilities/video-download/registry.ts",
    registryFilePath: "src/capabilities/video-download/children/download-web-video-once.ts",
    registryExportName: "downloadWebVideoOnce",
    reason: "Video download registry intentionally stores full child capability contracts.",
  },
  {
    consumerFilePath: "src/capabilities/video-download/registry.ts",
    registryFilePath: "src/capabilities/video-download/children/download-facebook-video-once.ts",
    registryExportName: "downloadFacebookVideoOnce",
    reason: "Video download registry intentionally stores full child capability contracts.",
  },
  {
    consumerFilePath: "src/capabilities/video-download/registry.ts",
    registryFilePath: "src/capabilities/video-download/children/download-tiktok-video-once.ts",
    registryExportName: "downloadTikTokVideoOnce",
    reason: "Video download registry intentionally stores full child capability contracts.",
  },
  {
    consumerFilePath: "src/capabilities/video-download/registry.ts",
    registryFilePath: "src/capabilities/video-download/children/download-instagram-video-once.ts",
    registryExportName: "downloadInstagramVideoOnce",
    reason: "Video download registry intentionally stores full child capability contracts.",
  },
  {
    consumerFilePath: "src/capabilities/video-download/registry.ts",
    registryFilePath: "src/capabilities/video-download/children/download-bilibili-video-once.ts",
    registryExportName: "downloadBilibiliVideoOnce",
    reason: "Video download registry intentionally stores full child capability contracts.",
  },
  {
    consumerFilePath: "src/capabilities/video-download/registry.ts",
    registryFilePath: "src/capabilities/video-download/children/download-douyin-video-once.ts",
    registryExportName: "downloadDouyinVideoOnce",
    reason: "Video download registry intentionally stores full child capability contracts.",
  },
  {
    consumerFilePath: "src/capabilities/video-download/registry.ts",
    registryFilePath: "src/capabilities/video-download/children/download-x-video-once.ts",
    registryExportName: "downloadXVideoOnce",
    reason: "Video download registry intentionally stores full child capability contracts.",
  },
  {
    consumerFilePath: "src/capabilities/video-download/registry.ts",
    registryFilePath: "src/capabilities/video-download/children/download-xiaohongshu-video-once.ts",
    registryExportName: "downloadXiaohongshuVideoOnce",
    reason: "Video download registry intentionally stores full child capability contracts.",
  },
  {
    consumerFilePath: "src/capabilities/video-download/registry.ts",
    registryFilePath: "src/capabilities/video-download/children/download-youtube-video-once.ts",
    registryExportName: "downloadYoutubeVideoOnce",
    reason: "Video download registry intentionally stores full child capability contracts.",
  },
  {
    consumerFilePath: "src/capabilities/video-download/registry.ts",
    registryFilePath: "src/capabilities/video-download/children/download-telegram-web-video-once.ts",
    registryExportName: "downloadTelegramWebVideoOnce",
    reason: "Video download registry intentionally stores full child capability contracts.",
  },
];

export const createZombieExemptionManifest = (): ZombieExemptionManifest => ({
  externalEntryExports: emptyEntryExports,
  externalEntryFiles: emptyEntryFiles,
  lawfulDynamicImports: emptyDynamicImports,
  lawfulDynamicRegistryConsumers: lawfulDynamicRegistryConsumers,
  lawfulDynamicNamespaceConsumers: emptyDynamicNamespaceConsumers,
  lawfulSideEffectImports: emptySideEffectImports,
});

export const isLawfulManifestEntryFile = (
  manifest: ZombieExemptionManifest,
  filePath: string,
): boolean => manifest.externalEntryFiles.some((entry) => entry.filePath === filePath);

export const isLawfulManifestEntryExport = (
  manifest: ZombieExemptionManifest,
  filePath: string,
  exportName: string,
): boolean =>
  manifest.externalEntryExports.some((entry) => entry.filePath === filePath && entry.exportName === exportName);

export const isLawfulDynamicImport = (
  manifest: ZombieExemptionManifest,
  consumerFilePath: string,
  targetFilePath: string,
): boolean =>
  manifest.lawfulDynamicImports.some(
    (entry) => entry.consumerFilePath === consumerFilePath && entry.targetFilePath === targetFilePath,
  );

export const isLawfulSideEffectImport = (
  manifest: ZombieExemptionManifest,
  consumerFilePath: string,
  targetFilePath: string,
): boolean =>
  manifest.lawfulSideEffectImports.some(
    (entry) => entry.consumerFilePath === consumerFilePath && entry.targetFilePath === targetFilePath,
  );

export const isLawfulDynamicNamespaceConsumer = (
  manifest: ZombieExemptionManifest,
  consumerFilePath: string,
  targetFilePath: string,
): boolean =>
  manifest.lawfulDynamicNamespaceConsumers.some(
    (entry) => entry.consumerFilePath === consumerFilePath && entry.targetFilePath === targetFilePath,
  );

export const isLawfulDynamicRegistryConsumer = (
  manifest: ZombieExemptionManifest,
  consumerFilePath: string,
  registryFilePath: string,
  registryExportName: string,
): boolean =>
  manifest.lawfulDynamicRegistryConsumers.some(
    (entry) => entry.consumerFilePath === consumerFilePath
      && entry.registryFilePath === registryFilePath
      && entry.registryExportName === registryExportName,
  );
