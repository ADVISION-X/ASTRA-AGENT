import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import type { MediaProcessingAbilityGroup } from "../../capabilities/media-processing/index.js";

import type { XuanxueAiProductionStore } from "./xuanxue-ai-production.store.js";

export interface XuanxueAiProductionRuntime {
  readonly aiInputGateway: AiInputGatewayAbilityGroup;
  readonly mediaProcessing: MediaProcessingAbilityGroup;
  readonly dataDir: string;
  readonly store: XuanxueAiProductionStore;
}
