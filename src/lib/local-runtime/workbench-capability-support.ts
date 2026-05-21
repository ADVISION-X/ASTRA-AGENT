import { createConfiguredAiAbilityGroup } from "../../capabilities/ai/index.js";
import { createForensicsPersistenceAbilityGroup } from "../../capabilities/forensics-persistence/index.js";
import { createForensicsStorageAdapter } from "../../capabilities/forensics-persistence/storage-adapter.js";
import { createGeometryGuardAbilityGroup } from "../../capabilities/geometry-guard/index.js";
import { createMouseClickAbilityGroupWithPrimitivePort } from "../../capabilities/mouse-click/index.js";
import { createMouseScrollAbilityGroupWithPrimitivePort } from "../../capabilities/mouse-scroll/index.js";
import { createTextInputAbilityGroupWithPrimitivePort } from "../../capabilities/text-input/index.js";
import {
  createFilesystemVideoArtifactStoragePort,
  createVideoDownloadAbilityGroup,
} from "../../capabilities/video-download/index.js";
import { createGrassEyeFileStorage } from "../storage/index.js";
import type { RuntimeLogger } from "../runtime-logs/index.js";
import type { BrowserController } from "../browser/browser-controller.js";
import type { WorkbenchPrimitivePorts } from "./workbench-browser-support.js";

export function createWorkbenchForensicsGroup(
  dataDir: string,
  runtimeLogger: RuntimeLogger,
) {
  const genericStorage = createGrassEyeFileStorage(dataDir);
  const forensicsStoragePort = createForensicsStorageAdapter(genericStorage);
  return createForensicsPersistenceAbilityGroup(forensicsStoragePort, runtimeLogger);
}

export function createWorkbenchCapabilityGroups(input: {
  dataDir: string;
  runtimeLogger: RuntimeLogger;
  primitivePorts: WorkbenchPrimitivePorts;
  browserController: BrowserController;
}) {
  const geometryGuardAbilityGroup = createGeometryGuardAbilityGroup();
  const mouseClickAbilityGroup = createMouseClickAbilityGroupWithPrimitivePort({
    primitivePort: input.primitivePorts.mouseClickPrimitivePort,
  });
  const mouseScrollAbilityGroup =
    createMouseScrollAbilityGroupWithPrimitivePort({
      primitivePort: input.primitivePorts.mouseScrollPrimitivePort,
    });
  const textInputAbilityGroup =
    createTextInputAbilityGroupWithPrimitivePort(input.primitivePorts.textInputPorts);
  const aiAbilityGroup = createConfiguredAiAbilityGroup({
    dataDir: input.dataDir,
    runtimeLogger: input.runtimeLogger,
  });
  const videoDownloadAbilityGroup = createVideoDownloadAbilityGroup({
    browserMediaSourcePort: input.browserController,
    artifactStoragePort: createFilesystemVideoArtifactStoragePort(input.dataDir),
  });
  return {
    aiAbilityGroup,
    geometryGuardAbilityGroup,
    mouseClickAbilityGroup,
    mouseScrollAbilityGroup,
    textInputAbilityGroup,
    videoDownloadAbilityGroup,
  };
}
