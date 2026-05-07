import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { pathFromRepoRoot } from "../../core/paths.js";

export type ThrowawayAuditMutation = {
  name: string;
  mode?: "replace" | "write";
  search?: string;
  replace?: string;
  content?: string;
};

export type ThrowawayAuditFileState = {
  existed: boolean;
  original: string;
};

async function writeWorkspaceFile(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

export async function createThrowawayAuditWorkspace(input: {
  workspaceName: string;
  relativePaths: readonly string[];
}): Promise<{ workspaceRoot: string; cleanup: () => Promise<void> }> {
  const parentDir = pathFromRepoRoot("tmp/audit-negative-proof-workspaces");
  await mkdir(parentDir, { recursive: true });

  const workspaceRoot = await mkdtemp(path.join(parentDir, `${input.workspaceName}-`));
  for (const relativePath of input.relativePaths) {
    const sourcePath = pathFromRepoRoot(relativePath);
    const destinationPath = path.join(workspaceRoot, relativePath);
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await cp(sourcePath, destinationPath, { recursive: true, force: true });
  }

  return {
    workspaceRoot,
    cleanup: async () => rm(workspaceRoot, { recursive: true, force: true }),
  };
}

export async function readThrowawayAuditFileState(filePath: string): Promise<ThrowawayAuditFileState> {
  try {
    return {
      existed: true,
      original: await readFile(filePath, "utf8"),
    };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return {
        existed: false,
        original: "",
      };
    }
    throw error;
  }
}

export async function applyThrowawayAuditMutation(
  filePath: string,
  original: string,
  mutation: ThrowawayAuditMutation,
): Promise<void> {
  if (mutation.mode === "write") {
    await writeWorkspaceFile(filePath, mutation.content ?? "");
    return;
  }

  if (!mutation.search || mutation.replace === undefined) {
    throw new Error(`Replace mutation is missing search/replace for ${mutation.name}`);
  }
  if (!original.includes(mutation.search)) {
    throw new Error(`Mutation seed not found for ${mutation.name}`);
  }

  await writeWorkspaceFile(filePath, original.replace(mutation.search, mutation.replace));
}

export async function restoreThrowawayAuditFileState(
  filePath: string,
  state: ThrowawayAuditFileState,
): Promise<void> {
  if (state.existed) {
    await writeWorkspaceFile(filePath, state.original);
    return;
  }

  await rm(filePath, { force: true });
}