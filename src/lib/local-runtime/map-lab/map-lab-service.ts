import type { WorkbenchRuntime } from "../workbench-contract.js";
import { generateMapLabDraft } from "./map-lab-draft-generator.js";
import { buildProviderStateSnapshot, saveMapLabProviderConfig } from "./map-lab-provider-support.js";
import { createMapLabRegistrySupport } from "./map-lab-registry-support.js";
import type {
  MapLabActivationResult,
  MapLabApprovalResult,
  MapLabGenerateDraftResult,
  MapLabProviderConfigInput,
  MapLabProviderState,
  MapLabSnapshot,
} from "./map-lab-types.js";

async function getMapLabSnapshot(
  runtime: WorkbenchRuntime,
  registrySupport: ReturnType<typeof createMapLabRegistrySupport>,
): Promise<MapLabSnapshot> {
  return {
    provider: await buildProviderStateSnapshot(runtime),
    developerCatalog: registrySupport.listDeveloperCatalog(),
  };
}

export function createMapLabService(runtime: WorkbenchRuntime) {
  const registrySupport = createMapLabRegistrySupport();

  return {
    getSnapshot: (): Promise<MapLabSnapshot> => getMapLabSnapshot(runtime, registrySupport),
    saveProviderConfig: (input: MapLabProviderConfigInput): Promise<MapLabProviderState> =>
      saveMapLabProviderConfig(runtime, input),
    generateDraft: (input: unknown): Promise<MapLabGenerateDraftResult> =>
      generateMapLabDraft({ runtime, registry: registrySupport.registry, requestInput: input }),
    approveDraft: (input: { packageId: string; packageVersion: string; approvedBy: string }): Promise<MapLabApprovalResult> =>
      Promise.resolve(registrySupport.approveDraft(input)),
    activateDraft: (input: { packageId: string; packageVersion: string; approvedBy: string; reason: string }): Promise<MapLabActivationResult> =>
      Promise.resolve(registrySupport.activateDraft(input)),
  };
}