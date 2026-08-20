import { admitExtensionCommand as admitRegisteredExtensionCommand } from "./command-registry.js";
import type { ExtensionCommandPermit } from "./command-permit-validator.js";
import { createExtensionNativePortActor } from "./native-port-actor.js";
import { readExtensionChromeApi } from "./extension-runtime-types.js";

export const admitExtensionCommand = async (input: Readonly<{ kind: string; permit: ExtensionCommandPermit }>): Promise<void> => admitRegisteredExtensionCommand(input);

const chromeApi = readExtensionChromeApi();
if (chromeApi) createExtensionNativePortActor(chromeApi, 1).start();
