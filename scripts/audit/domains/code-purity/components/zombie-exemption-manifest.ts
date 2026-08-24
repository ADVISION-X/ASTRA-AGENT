import { existsSync, readFileSync, readdirSync } from "node:fs";

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
  auditInspectionFiles: readonly ZombieEntryFileExemption[];
  externalEntryExports: readonly ZombieEntryExportExemption[];
  externalEntryFiles: readonly ZombieEntryFileExemption[];
  lawfulDynamicImports: readonly ZombieDynamicImportExemption[];
  lawfulDynamicRegistryConsumers: readonly ZombieDynamicRegistryConsumerExemption[];
  lawfulDynamicNamespaceConsumers: readonly ZombieDynamicNamespaceExemption[];
  lawfulSideEffectImports: readonly ZombieSideEffectImportExemption[];
};

const entryFileSchema = z.object({ filePath: z.string().min(1), reason: z.string().min(1) }).strict();
const entryExportSchema = entryFileSchema.extend({ exportName: z.string().min(1) }).strict();
const pathPairSchema = z.object({
  consumerFilePath: z.string().min(1),
  reason: z.string().min(1),
  targetFilePath: z.string().min(1),
}).strict();
const registryConsumerSchema = z.object({
  consumerFilePath: z.string().min(1),
  reason: z.string().min(1),
  registryExportName: z.string().min(1),
  registryFilePath: z.string().min(1),
}).strict();

const authoritySchema = z.object({
  auditInspectionFiles: z.array(entryFileSchema),
  externalEntryExports: z.array(entryExportSchema),
  externalEntryFiles: z.array(entryFileSchema),
  lawfulDynamicImports: z.array(pathPairSchema),
  lawfulDynamicNamespaceConsumers: z.array(pathPairSchema),
  lawfulDynamicRegistryConsumers: z.array(registryConsumerSchema),
  lawfulSideEffectImports: z.array(pathPairSchema),
  owner: z.literal("code-purity"),
  schemaVersion: z.literal(1),
  status: z.literal("active"),
}).strict();

const AUTHORITY_PATH = "scripts/audit/domains/code-purity/liveness-authority.json";

const assertedExistingPath = (repoPath: string): void => {
  if (!existsSync(resolveFromRepo(repoPath))) {
    throw new Error(`CODE_PURITY_LIVENESS_PATH_MISSING:${repoPath}`);
  }
};

const uniqueKey = (value: unknown): string => JSON.stringify(value);

const assertUnique = (label: string, entries: readonly unknown[]): void => {
  if (new Set(entries.map(uniqueKey)).size !== entries.length) {
    throw new Error(`CODE_PURITY_LIVENESS_DUPLICATE:${label}`);
  }
};

const manifestBindingExports = (): ZombieEntryExportExemption[] => {
  const domains=resolveFromRepo("scripts/audit/domains");const entries:ZombieEntryExportExemption[]=[];
  for(const domain of readdirSync(domains,{withFileTypes:true}).filter((item)=>item.isDirectory())){
    const path=resolveFromRepo(`scripts/audit/domains/${domain.name}/manifest.json`);if(!existsSync(path))continue;
    const manifest=JSON.parse(readFileSync(path,"utf8")) as {lawBindings?:Record<string,{staticBinding?:{inspectorRef?:string}|null;examBindings?:Array<{examRef?:string}>;proofBindings?:Array<{proofRef?:string}>}>};
    for(const bindings of Object.values(manifest.lawBindings??{}))for(const ref of [bindings.staticBinding?.inspectorRef,...(bindings.examBindings??[]).map((item)=>item.examRef),...(bindings.proofBindings??[]).map((item)=>item.proofRef)]){
      const [filePath,selector]=ref?.split("#")??[];const exportName=selector?.split("|")[0];
      if(filePath&&exportName)entries.push({filePath,exportName,reason:"Manifest v4 stable enforcement binding."});
    }
  }
  return [...new Map(entries.map((entry)=>[`${entry.filePath}#${entry.exportName}`,entry])).values()].sort((left,right)=>`${left.filePath}#${left.exportName}`.localeCompare(`${right.filePath}#${right.exportName}`));
};

export const createZombieExemptionManifest = (): ZombieExemptionManifest => {
  const authority = authoritySchema.parse(JSON.parse(readFileSync(resolveFromRepo(AUTHORITY_PATH), "utf8")));
  const collections = {
    auditInspectionFiles: authority.auditInspectionFiles,
    externalEntryExports: [...authority.externalEntryExports,...manifestBindingExports()],
    externalEntryFiles: authority.externalEntryFiles,
    lawfulDynamicImports: authority.lawfulDynamicImports,
    lawfulDynamicNamespaceConsumers: authority.lawfulDynamicNamespaceConsumers,
    lawfulDynamicRegistryConsumers: authority.lawfulDynamicRegistryConsumers,
    lawfulSideEffectImports: authority.lawfulSideEffectImports,
  };
  for (const [label, entries] of Object.entries(collections)) {
    assertUnique(label, entries);
  }
  for (const entry of [...authority.auditInspectionFiles, ...authority.externalEntryExports, ...authority.externalEntryFiles]) {
    assertedExistingPath(entry.filePath);
  }
  for (const entry of [...authority.lawfulDynamicImports, ...authority.lawfulDynamicNamespaceConsumers, ...authority.lawfulSideEffectImports]) {
    assertedExistingPath(entry.consumerFilePath);
    assertedExistingPath(entry.targetFilePath);
  }
  for (const entry of authority.lawfulDynamicRegistryConsumers) {
    assertedExistingPath(entry.consumerFilePath);
    assertedExistingPath(entry.registryFilePath);
  }
  return collections;
};

export const isLawfulManifestEntryFile = (manifest: ZombieExemptionManifest, filePath: string): boolean =>
  manifest.externalEntryFiles.some((entry) => entry.filePath === filePath);

export const isLawfulAuditInspectionFile = (manifest: ZombieExemptionManifest, filePath: string): boolean =>
  manifest.auditInspectionFiles.some((entry) => entry.filePath === filePath);

export const isLawfulManifestEntryExport = (
  manifest: ZombieExemptionManifest,
  filePath: string,
  exportName: string,
): boolean => manifest.externalEntryExports.some((entry) => entry.filePath === filePath && entry.exportName === exportName);

const hasPathPair = (
  entries: readonly ZombieDynamicImportExemption[],
  consumerFilePath: string,
  targetFilePath: string,
): boolean => entries.some((entry) => entry.consumerFilePath === consumerFilePath && entry.targetFilePath === targetFilePath);

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
