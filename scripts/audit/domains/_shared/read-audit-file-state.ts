import { mkdir, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import { writeTextFile } from "../../core/filesystem.js";

export type AuditFileState = {
  existed: boolean;
  original: string;
  releaseLock?: () => Promise<void>;
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

const isExistingFileError = (error: unknown): boolean =>
  typeof error === "object"
  && error !== null
  && "code" in error
  && error.code === "EEXIST";

const hasErrorCode = (error: unknown, code: string): boolean =>
  typeof error === "object"
  && error !== null
  && "code" in error
  && error.code === code;

const NEGATIVE_PROOF_MUTATION_LOCK_DIR = "/private/tmp/grasseye-audit-negative-proof-mutation.lock";
const NEGATIVE_PROOF_MUTATION_LOCK_OWNER = `${NEGATIVE_PROOF_MUTATION_LOCK_DIR}/owner`;
const NEGATIVE_PROOF_MUTATION_LOCK_RETRY_MS = 250;
const NEGATIVE_PROOF_MUTATION_LOCK_STALE_MS = 10 * 60 * 1000;
const PRODUCTION_TREE_MUTATION_PROOF_DISABLED = process.env.GRASSEYE_DISABLE_PRODUCTION_TREE_NEGATIVE_PROOF === "1";

let activeLockRelease: (() => Promise<void>) | undefined;
let activeLockDepth = 0;

const processIsAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (hasErrorCode(error, "ESRCH")) {
      return false;
    }
    if (hasErrorCode(error, "EPERM")) {
      return true;
    }
    throw error;
  }
};

async function removeStaleMutationLock(): Promise<boolean> {
  try {
    const owner = await readFile(NEGATIVE_PROOF_MUTATION_LOCK_OWNER, "utf8");
    const pid = Number(owner.trim());
    if (Number.isFinite(pid) && pid > 0 && !processIsAlive(pid)) {
      await rm(NEGATIVE_PROOF_MUTATION_LOCK_DIR, { recursive: true, force: true });
      return true;
    }
  } catch {
    const lockStat = await stat(NEGATIVE_PROOF_MUTATION_LOCK_DIR).catch(() => null);
    if (lockStat && Date.now() - lockStat.mtimeMs > NEGATIVE_PROOF_MUTATION_LOCK_STALE_MS) {
      await rm(NEGATIVE_PROOF_MUTATION_LOCK_DIR, { recursive: true, force: true });
      return true;
    }
  }

  return false;
}

export async function acquireAuditMutationLock(): Promise<() => Promise<void>> {
  if (PRODUCTION_TREE_MUTATION_PROOF_DISABLED) {
    throw new Error("Production-tree mutation negative proof is disabled; use static AST/schema inspectors or an isolated throwaway workspace instead.");
  }

  if (activeLockRelease) {
    activeLockDepth += 1;
    let released = false;
    return async () => {
      if (released) {
        return;
      }
      released = true;
      activeLockDepth -= 1;
      if (activeLockDepth === 0) {
        await activeLockRelease?.();
      }
    };
  }

  for (;;) {
    try {
      await mkdir(NEGATIVE_PROOF_MUTATION_LOCK_DIR);
      await writeFile(NEGATIVE_PROOF_MUTATION_LOCK_OWNER, `${process.pid}\n`, "utf8");
      let released = false;
      activeLockDepth = 1;
      const release = async () => {
        if (released) {
          return;
        }
        activeLockDepth -= 1;
        if (activeLockDepth > 0) {
          return;
        }
        released = true;
        await rm(NEGATIVE_PROOF_MUTATION_LOCK_DIR, { recursive: true, force: true });
        if (activeLockRelease === release) {
          activeLockRelease = undefined;
          activeLockDepth = 0;
        }
      };
      activeLockRelease = release;
      return release;
    } catch (error) {
      if (!isExistingFileError(error)) {
        throw error;
      }
      await removeStaleMutationLock();
      await delay(NEGATIVE_PROOF_MUTATION_LOCK_RETRY_MS);
    }
  }
}

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
  const releaseLock = await acquireAuditMutationLock();
  try {
    const original = await readFile(filePath, "utf8");
    return {
      existed: true,
      original,
      releaseLock,
    };
  } catch (error) {
    try {
      return {
        ...createMissingFileState(error),
        releaseLock,
      };
    } catch (innerError) {
      await releaseLock();
      throw innerError;
    }
  }
}

export async function applyAuditMutation(filePath: string, original: string, mutation: AuditMutation): Promise<void> {
  try {
    if (mutation.mode === "write") {
      await writeTextFile(filePath, mutation.content ?? "");
      return;
    }

    if (!mutation.search || mutation.replace === undefined) {
      throw new Error(`Replace mutation is missing search/replace for ${mutation.name}`);
    }
    if (!original.includes(mutation.search)) {
      throw new Error(`Mutation seed not found for ${mutation.name} in ${mutation.file}`);
    }

    await writeTextFile(filePath, original.replace(mutation.search, mutation.replace));
  } catch (error) {
    await activeLockRelease?.();
    throw error;
  }
}

export async function restoreAuditFileState(filePath: string, state: AuditFileState): Promise<void> {
  try {
    if (state.existed) {
      await writeTextFile(filePath, state.original);
      return;
    }

    await unlink(filePath);
  } finally {
    await state.releaseLock?.();
  }
}
