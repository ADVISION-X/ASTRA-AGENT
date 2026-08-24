import type { Project, SourceFile } from "ts-morph";

export type PurityFinding = {
  code: string;
  detail: string;
  line: number;
  path: string;
  symbol?: string;
};

export type PurityManifest = {
  externalEntryFiles: string[];
  externalEntryExports: Array<{ exportName: string; filePath: string }>;
  lawfulDynamicImports: Array<{ consumerFilePath: string; targetFilePath: string }>;
  lawfulDynamicRegistryConsumers: Array<{ consumerFilePath: string; registryExportName: string; registryFilePath: string }>;
  lawfulSideEffectImports: Array<{ consumerFilePath: string; targetFilePath: string }>;
};

export type PurityInput = {
  entryScripts: string[];
  manifest: PurityManifest;
  project: Project;
  root: string;
  sourceFiles: SourceFile[];
};

export const emptyManifest = (): PurityManifest => ({
  externalEntryExports: [],
  externalEntryFiles: [],
  lawfulDynamicImports: [],
  lawfulDynamicRegistryConsumers: [],
  lawfulSideEffectImports: [],
});

export const purityFinding = (code: string, path: string, line: number, detail: string, symbol?: string): PurityFinding => ({
  code,
  detail,
  line,
  path,
  ...(symbol === undefined ? {} : { symbol }),
});
