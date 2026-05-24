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

export type ZombieDynamicNamespaceExemption = {
  consumerFilePath: string;
  reason: string;
  targetFilePath: string;
};

export type ZombieExemptionManifest = {
  externalEntryExports: readonly ZombieEntryExportExemption[];
  externalEntryFiles: readonly ZombieEntryFileExemption[];
  lawfulDynamicImports: readonly ZombieDynamicImportExemption[];
  lawfulDynamicNamespaceConsumers: readonly ZombieDynamicNamespaceExemption[];
};

export const zombieExemptionManifest: ZombieExemptionManifest = {
  externalEntryExports: [],
  externalEntryFiles: [],
  lawfulDynamicImports: [],
  lawfulDynamicNamespaceConsumers: [],
};

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

export const isLawfulDynamicNamespaceConsumer = (
  manifest: ZombieExemptionManifest,
  consumerFilePath: string,
  targetFilePath: string,
): boolean =>
  manifest.lawfulDynamicNamespaceConsumers.some(
    (entry) => entry.consumerFilePath === consumerFilePath && entry.targetFilePath === targetFilePath,
  );