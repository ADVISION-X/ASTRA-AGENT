import { readFile, unlink, writeFile } from "node:fs/promises";

export type AuditFileState = {
  existed: boolean;
  original: string;
};

export type AuditMutation = {
  name: string;
  file: string;
  mode?: "replace" | "write";
  search?: string;
  replace?: string;
  content?: string;
};

const isMissingFileError = (error: unknown): boolean =>
  typeof error === "object"
  && error !== null
  && "code" in error
  && error.code === "ENOENT";

const createMissingFileState = (error: unknown): AuditFileState => {
  if (!isMissingFileError(error)) {
    throw error;
  }

  return {
    existed: false,
    original: "",
  };
};

export async function readAuditFileState(filePath: string): Promise<AuditFileState> {
  try {
    const original = await readFile(filePath, "utf8");
    return {
      existed: true,
      original,
    };
  } catch (error) {
    return createMissingFileState(error);
  }
}

export async function applyAuditMutation(filePath: string, original: string, mutation: AuditMutation): Promise<void> {
  if (mutation.mode === "write") {
    await writeFile(filePath, mutation.content ?? "", "utf8");
    return;
  }

  if (!mutation.search || mutation.replace === undefined) {
    throw new Error(`Replace mutation is missing search/replace for ${mutation.name}`);
  }
  if (!original.includes(mutation.search)) {
    throw new Error(`Mutation seed not found for ${mutation.name} in ${mutation.file}`);
  }

  await writeFile(filePath, original.replace(mutation.search, mutation.replace), "utf8");
}

export async function restoreAuditFileState(filePath: string, state: AuditFileState): Promise<void> {
  if (state.existed) {
    await writeFile(filePath, state.original, "utf8");
    return;
  }

  await unlink(filePath);
}