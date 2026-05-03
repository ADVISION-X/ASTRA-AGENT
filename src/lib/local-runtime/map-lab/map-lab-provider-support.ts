import { getAiExternalProviderPublicState, saveAiExternalProviderConfig } from "../../../capabilities/ai/runtime/provider-config-store.js";
import { getDefaultLocalDataDir } from "../default-data-dir.js";
import type { WorkbenchRuntime } from "../workbench-contract.js";
import type { MapLabProviderConfigInput, MapLabProviderState } from "./map-lab-types.js";

function resolveMapLabDataDir(runtime: WorkbenchRuntime): string {
  return runtime.options.dataDir ?? getDefaultLocalDataDir();
}

export function buildProviderStateSnapshot(runtime: WorkbenchRuntime): Promise<MapLabProviderState> {
  return getAiExternalProviderPublicState(resolveMapLabDataDir(runtime));
}

export function saveMapLabProviderConfig(
  runtime: WorkbenchRuntime,
  input: MapLabProviderConfigInput,
): Promise<MapLabProviderState> {
  return saveAiExternalProviderConfig(resolveMapLabDataDir(runtime), input);
}