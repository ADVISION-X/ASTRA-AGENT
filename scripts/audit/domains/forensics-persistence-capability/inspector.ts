import { fileURLToPath } from "node:url";

import { runManifestOwnerInspector } from "../shared/manifest-owner-helper.js";
import type { InspectorContext, InspectorResult } from "../../core/schema.js";

const manifestPath = fileURLToPath(new URL("./manifest.json", import.meta.url));

export const runForensicsPersistenceCapabilityInspector = (
  context: InspectorContext,
): Promise<InspectorResult> => runManifestOwnerInspector(manifestPath, context);