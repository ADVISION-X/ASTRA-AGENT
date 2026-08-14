import { readFileSync } from "node:fs";

import { z } from "zod";

import { resolveFromRepo } from "../../../shared/paths.js";

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

export type ZombieSideEffectImportExemption = ZombieDynamicImportExemption;
export type ZombieDynamicNamespaceExemption = ZombieDynamicImportExemption;

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

const pathPairSchema = z.object({
  consumerFilePath: z.string().min(1),
  targetFilePath: z.string().min(1),
}).strict();

const livenessSchema = z.object({
  externalEntryExports: z.array(z.object({
    exportName: z.string().min(1),
    filePath: z.string().min(1),
  }).strict()).default([]),
  externalEntryFiles: z.array(z.string().min(1)).default([]),
  lawfulDynamicImports: z.array(pathPairSchema).default([]),
  lawfulDynamicNamespaceConsumers: z.array(pathPairSchema).default([]),
  lawfulDynamicRegistryConsumers: z.array(z.object({
    consumerFilePath: z.string().min(1),
    registryExportName: z.string().min(1),
    registryFilePath: z.string().min(1),
  }).strict()).default([]),
  lawfulSideEffectImports: z.array(pathPairSchema).default([]),
}).strict();

const lawRegistrySchema = z.object({
  laws: z.array(z.object({
    codePurityLiveness: livenessSchema.optional(),
    lawId: z.string().min(1),
    status: z.enum(["active", "draft", "retired"]),
  }).passthrough()),
}).passthrough();

type LawLiveness = z.infer<typeof livenessSchema>;

const readActiveLawLiveness = (): Array<{ lawId: string; liveness: LawLiveness }> => {
  const registry = lawRegistrySchema.parse(JSON.parse(readFileSync(
    resolveFromRepo("scripts/audit/generated/law-registry.generated.json"),
    "utf8",
  )));
  return registry.laws.flatMap((law) => law.status === "active" && law.codePurityLiveness
    ? [{ lawId: law.lawId, liveness: law.codePurityLiveness }]
    : []);
};

export const createZombieExemptionManifest = (): ZombieExemptionManifest => {
  const authorities = readActiveLawLiveness();
  return {
    externalEntryExports: authorities.flatMap(({ lawId, liveness }) =>
      liveness.externalEntryExports.map((entry) => ({ ...entry, reason: `active law ${lawId}` }))),
    externalEntryFiles: authorities.flatMap(({ lawId, liveness }) =>
      liveness.externalEntryFiles.map((filePath) => ({ filePath, reason: `active law ${lawId}` }))),
    lawfulDynamicImports: authorities.flatMap(({ lawId, liveness }) =>
      liveness.lawfulDynamicImports.map((entry) => ({ ...entry, reason: `active law ${lawId}` }))),
    lawfulDynamicNamespaceConsumers: authorities.flatMap(({ lawId, liveness }) =>
      liveness.lawfulDynamicNamespaceConsumers.map((entry) => ({ ...entry, reason: `active law ${lawId}` }))),
    lawfulDynamicRegistryConsumers: authorities.flatMap(({ lawId, liveness }) =>
      liveness.lawfulDynamicRegistryConsumers.map((entry) => ({ ...entry, reason: `active law ${lawId}` }))),
    lawfulSideEffectImports: authorities.flatMap(({ lawId, liveness }) =>
      liveness.lawfulSideEffectImports.map((entry) => ({ ...entry, reason: `active law ${lawId}` }))),
  };
};

export const isLawfulManifestEntryFile = (
  manifest: ZombieExemptionManifest,
  filePath: string,
): boolean => manifest.externalEntryFiles.some((entry) => entry.filePath === filePath);

export const isLawfulManifestEntryExport = (
  manifest: ZombieExemptionManifest,
  filePath: string,
  exportName: string,
): boolean => manifest.externalEntryExports.some((entry) =>
  entry.filePath === filePath && entry.exportName === exportName);

const hasPathPair = (
  entries: readonly ZombieDynamicImportExemption[],
  consumerFilePath: string,
  targetFilePath: string,
): boolean => entries.some((entry) =>
  entry.consumerFilePath === consumerFilePath && entry.targetFilePath === targetFilePath);

export const isLawfulDynamicImport = (
  manifest: ZombieExemptionManifest,
  consumerFilePath: string,
  targetFilePath: string,
): boolean => hasPathPair(manifest.lawfulDynamicImports, consumerFilePath, targetFilePath);

export const isLawfulSideEffectImport = (
  manifest: ZombieExemptionManifest,
  consumerFilePath: string,
  targetFilePath: string,
): boolean => hasPathPair(manifest.lawfulSideEffectImports, consumerFilePath, targetFilePath);

export const isLawfulDynamicNamespaceConsumer = (
  manifest: ZombieExemptionManifest,
  consumerFilePath: string,
  targetFilePath: string,
): boolean => hasPathPair(manifest.lawfulDynamicNamespaceConsumers, consumerFilePath, targetFilePath);

export const isLawfulDynamicRegistryConsumer = (
  manifest: ZombieExemptionManifest,
  consumerFilePath: string,
  registryFilePath: string,
  registryExportName: string,
): boolean => manifest.lawfulDynamicRegistryConsumers.some((entry) =>
  entry.consumerFilePath === consumerFilePath
  && entry.registryFilePath === registryFilePath
  && entry.registryExportName === registryExportName);
