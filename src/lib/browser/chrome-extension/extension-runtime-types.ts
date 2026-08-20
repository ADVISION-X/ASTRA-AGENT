export type ExtensionDebuggee = Readonly<{ tabId: number }>;

export type ExtensionNativePort = Readonly<{
  postMessage(message: unknown): void;
  disconnect(): void;
  onMessage: Readonly<{ addListener(listener: (message: unknown) => void): void }>;
  onDisconnect: Readonly<{ addListener(listener: () => void): void }>;
}>;

export type ExtensionChromeApi = Readonly<{
  runtime: Readonly<{
    connectNative(application: string): ExtensionNativePort;
    getManifest(): Readonly<{ version: string }>;
  }>;
  debugger: Readonly<{
    attach(target: ExtensionDebuggee, version: string): Promise<void>;
    detach(target: ExtensionDebuggee): Promise<void>;
    sendCommand(target: ExtensionDebuggee, method: string, parameters?: Readonly<Record<string, unknown>>): Promise<unknown>;
    onDetach: Readonly<{ addListener(listener: (target: ExtensionDebuggee, reason: string) => void): void }>;
  }>;
  action: Readonly<{
    onClicked: Readonly<{
      addListener(listener: (tab: Readonly<{ id?: number; url?: string; title?: string }>) => void): void;
    }>;
  }>;
}>;

export const readExtensionChromeApi = (): ExtensionChromeApi | null => {
  const candidate = (globalThis as typeof globalThis & { chrome?: unknown }).chrome;
  return isChromeApi(candidate) ? candidate : null;
};

const isChromeApi = (value: unknown): value is ExtensionChromeApi => {
  if (!isRecord(value) || !isRecord(value.runtime) || !isRecord(value.debugger) || !isRecord(value.action)) return false;
  return typeof value.runtime.connectNative === "function"
    && typeof value.runtime.getManifest === "function"
    && typeof value.debugger.attach === "function"
    && typeof value.debugger.detach === "function"
    && typeof value.debugger.sendCommand === "function"
    && isRecord(value.debugger.onDetach)
    && typeof value.debugger.onDetach.addListener === "function"
    && isRecord(value.action.onClicked)
    && typeof value.action.onClicked.addListener === "function";
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
