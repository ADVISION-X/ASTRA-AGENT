import { GRASSEYE_BROWSER_EXTENSION_ID } from "../protocol/generated/browser-protocol.js";
import {
  extensionArtifactIdentityFromManifest,
  type NativePort,
  type RunCommand,
} from "./service-worker-native-transport-auth.js";
import { NativePortActor } from "./service-worker-native-port-actor.js";

const NATIVE_HOST_NAME = "com.grasseye.browser";

declare const chrome: {
  runtime: {
    id: string;
    connectNative(name: string): NativePort;
    getManifest(): Record<string, unknown>;
    lastError?: { readonly message?: string };
  };
  alarms: {
    create(
      name: string,
      info: { periodInMinutes?: number; delayInMinutes?: number },
    ): void;
  };
};

let runCommandHandler: RunCommand | null = null;
let disconnectHandler: ((reason?: string) => void) | null = null;
let connectedPortActor: NativePortActor | null = null;
let nextPortEpoch = 0;
let reconnectAlarmScheduled = false;
let immediateReconnectAt = 0;

const scheduleReconnect = (): void => {
  const now = Date.now();
  if (runCommandHandler && !connectedPortActor && now >= immediateReconnectAt) {
    immediateReconnectAt = now + 1_000;
    connectNativeTransport();
  }
  if (runCommandHandler && !connectedPortActor && !reconnectAlarmScheduled) {
    reconnectAlarmScheduled = true;
    chrome.alarms.create("grasseye-native-reconnect", { delayInMinutes: 0.5 });
  }
};

const handleActorClosed = (
  actor: NativePortActor,
  reason?: string,
): void => {
  if (connectedPortActor !== actor) return;
  connectedPortActor = null;
  disconnectHandler?.(reason);
  scheduleReconnect();
};

export const connectNativeTransport = (): void => {
  if (connectedPortActor || !runCommandHandler) return;
  if (chrome.runtime.id !== GRASSEYE_BROWSER_EXTENSION_ID) {
    throw new Error("BROWSER_EXTENSION_ID_MISMATCH");
  }
  let actor: NativePortActor;
  actor = new NativePortActor({
    port: chrome.runtime.connectNative(NATIVE_HOST_NAME),
    nativePortEpoch: ++nextPortEpoch,
    artifactIdentity: extensionArtifactIdentityFromManifest(
      chrome.runtime.getManifest(),
    ),
    runCommand: (command, expectedLoaderId) => {
      const handler = runCommandHandler;
      if (!handler) throw new Error("BROWSER_NATIVE_TRANSPORT_NOT_CONFIGURED");
      return handler(command, expectedLoaderId);
    },
    isCurrent: () => connectedPortActor === actor,
    disconnectReason: () => chrome.runtime.lastError?.message,
    onClosed: (reason) => handleActorClosed(actor, reason),
  });
  connectedPortActor = actor;
  actor.start();
};

export const configureNativeTransport = (input: {
  runCommand: RunCommand;
  onDisconnect: (reason?: string) => void;
}): void => {
  runCommandHandler = input.runCommand;
  disconnectHandler = input.onDisconnect;
};

export const handleNativeReconnectAlarm = (): void => {
  reconnectAlarmScheduled = false;
  connectNativeTransport();
};
