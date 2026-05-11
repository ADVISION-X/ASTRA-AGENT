import {
  getPromptContractCatalogIntegrity,
  listPromptContractCatalogEntries,
  PROMPT_CONTRACT_CATALOG_VERSION,
} from "../../../src/capabilities/ai/index.js";
import { loadMuscleMemoryCatalog } from "../../../src/muscle-memory/catalog.js";
import { listPlatformProfiles } from "../../../src/platforms/index.js";

type ReadinessResult = {
  status: "ready" | "failed";
  ownerResponsible: "startup-entrypoint";
  promptContractCount: number;
  promptContractCatalogVersion: string;
  muscleMemoryEntryCount: number;
  muscleMemoryCatalogVersion: string;
  platformProfileCount: number;
  refs: string[];
  failureReason: string | null;
  actionableMessage: string | null;
};

const toFailureResult = (error: unknown): ReadinessResult => {
  const shaped = error as {
    actionableMessage?: unknown;
    message?: unknown;
  };
  const message = typeof shaped.message === "string" ? shaped.message : "Startup registry readiness failed.";
  return {
    status: "failed",
    ownerResponsible: "startup-entrypoint",
    promptContractCount: 0,
    promptContractCatalogVersion: PROMPT_CONTRACT_CATALOG_VERSION,
    muscleMemoryEntryCount: 0,
    muscleMemoryCatalogVersion: "unknown",
    platformProfileCount: 0,
    refs: [],
    failureReason: message,
    actionableMessage: typeof shaped.actionableMessage === "string"
      ? shaped.actionableMessage
      : "Fix the governed startup registries and rerun npm run ci:full.",
  };
};

const verifyPromptContractRegistry = (): number => {
  const integrity = getPromptContractCatalogIntegrity();
  if (!integrity.ok) {
    throw new Error(`PROMPT_CONTRACT_REGISTRY_INVALID ${integrity.message}`);
  }
  const contracts = listPromptContractCatalogEntries();
  if (contracts.length === 0) {
    throw new Error("PROMPT_CONTRACT_REGISTRY_EMPTY");
  }
  return contracts.length;
};

const verifyMuscleMemoryCatalog = (): { entryCount: number; catalogVersion: string } => {
  const catalog = loadMuscleMemoryCatalog();
  if (catalog.entries.length === 0) {
    throw new Error("MUSCLE_MEMORY_CATALOG_EMPTY");
  }
  return {
    entryCount: catalog.entries.length,
    catalogVersion: catalog.catalogVersion,
  };
};

const verifyPlatformRegistry = (): number => {
  const profiles = listPlatformProfiles();
  if (profiles.length === 0) {
    throw new Error("PLATFORM_REGISTRY_EMPTY");
  }
  return profiles.length;
};

function runProbe(): ReadinessResult {
  try {
    const promptContractCount = verifyPromptContractRegistry();
    const muscleMemoryCatalog = verifyMuscleMemoryCatalog();
    const platformProfileCount = verifyPlatformRegistry();
    return {
      status: "ready",
      ownerResponsible: "startup-entrypoint",
      promptContractCount,
      promptContractCatalogVersion: PROMPT_CONTRACT_CATALOG_VERSION,
      muscleMemoryEntryCount: muscleMemoryCatalog.entryCount,
      muscleMemoryCatalogVersion: muscleMemoryCatalog.catalogVersion,
      platformProfileCount,
      refs: [
        `promptContractCatalogVersion=${PROMPT_CONTRACT_CATALOG_VERSION}`,
        `promptContractCount=${promptContractCount}`,
        `muscleMemoryCatalogVersion=${muscleMemoryCatalog.catalogVersion}`,
        `muscleMemoryEntryCount=${muscleMemoryCatalog.entryCount}`,
        `platformProfileCount=${platformProfileCount}`,
      ],
      failureReason: null,
      actionableMessage: null,
    };
  } catch (error) {
    return toFailureResult(error);
  }
}

const result = runProbe();
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exitCode = result.status === "ready" ? 0 : 1;
