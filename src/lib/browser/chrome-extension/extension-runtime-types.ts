export type ExtensionDebuggee = Readonly<{ tabId: number }>;
export type ExtensionDebuggerDetachReason = "target_closed" | "canceled_by_user";
export type ExtensionDebugTarget = Readonly<{
  attached: boolean;
  id: string;
  tabId?: number;
  title: string;
  type: "page" | "background_page" | "worker" | "other";
  url: string;
}>;

export type ExtensionChromeApi = Readonly<{
  runtime: Readonly<{
    id: string;
    getManifest(): Readonly<{ version: string }>;
    getPlatformInfo(): Promise<unknown>;
    reload(): void;
    onMessage: Readonly<{
      addListener(listener: (
        message: unknown,
        sender: Readonly<{ id?: string }>,
        sendResponse: (response: unknown) => void,
      ) => boolean | void): void;
    }>;
    onStartup: Readonly<{ addListener(listener: () => void): void }>;
  }>;
  debugger: Readonly<{
    attach(target: ExtensionDebuggee, version: string): Promise<void>;
    detach(target: ExtensionDebuggee): Promise<void>;
    getTargets(): Promise<readonly ExtensionDebugTarget[]>;
    sendCommand(target: ExtensionDebuggee, method: string, parameters?: Readonly<Record<string, unknown>>): Promise<unknown>;
    onDetach: Readonly<{
      addListener(listener: (target: ExtensionDebuggee, reason: ExtensionDebuggerDetachReason) => void): void;
    }>;
    onEvent: Readonly<{
      addListener(listener: (target: ExtensionDebuggee, method: string, parameters?: Readonly<Record<string, unknown>>) => void): void;
    }>;
  }>;
  tabs: Readonly<{
    create(createProperties: Readonly<{ active: false; url: string }>): Promise<Readonly<{ id?: number }>>;
    remove(tabId: number): Promise<void>;
    onRemoved?: Readonly<{ addListener(listener: (tabId: number) => void): void }>;
    onUpdated: Readonly<{
      addListener(listener: (
        tabId: number,
        changeInfo: Readonly<{ status?: string; url?: string }>,
        tab: Readonly<{ id?: number; url?: string; title?: string }>,
      ) => void): void;
    }>;
  }>;
  alarms: Readonly<{
    create(name: string, alarmInfo: Readonly<{ periodInMinutes: number }>): Promise<void>;
    onAlarm: Readonly<{ addListener(listener: (alarm: Readonly<{ name: string }>) => void): void }>;
  }>;
}>;

export const readExtensionChromeApi = (): ExtensionChromeApi | null => {
  const candidate = (globalThis as typeof globalThis & { chrome?: unknown }).chrome;
  return isChromeApi(candidate) ? candidate : null;
};

const isChromeApi = (value: unknown): value is ExtensionChromeApi => {
  if (!isRecord(value)) return false;
  return isRuntimeApi(value.runtime)
    && isDebuggerApi(value.debugger)
    && isTabsApi(value.tabs)
    && isAlarmsApi(value.alarms);
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const hasListener = (value: unknown): boolean =>
  isRecord(value) && typeof value.addListener === "function";

const isRuntimeApi = (value: unknown): boolean =>
  isRecord(value)
  && typeof value.id === "string"
  && typeof value.getManifest === "function"
  && typeof value.getPlatformInfo === "function"
  && typeof value.reload === "function"
  && hasListener(value.onMessage)
  && hasListener(value.onStartup);

const isDebuggerApi = (value: unknown): boolean =>
  isRecord(value)
  && typeof value.attach === "function"
  && typeof value.detach === "function"
  && typeof value.getTargets === "function"
  && typeof value.sendCommand === "function"
  && hasListener(value.onDetach)
  && hasListener(value.onEvent);

const isTabsApi = (value: unknown): boolean =>
  isRecord(value) && typeof value.create === "function" && typeof value.remove === "function" && hasListener(value.onUpdated);

const isAlarmsApi = (value: unknown): boolean =>
  isRecord(value) && typeof value.create === "function" && hasListener(value.onAlarm);
