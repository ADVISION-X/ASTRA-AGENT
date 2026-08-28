import type { ExtensionChromeApi } from "./extension-runtime-types.js";

export const GRASSEYE_PAIRING_URL = "http://127.0.0.1:4173/api/browser-authority/pairing";
export const GRASSEYE_AUTO_PAIRING_ALARM = "grasseye-browser-authority-auto-pairing";
export const GRASSEYE_TOOL_EXTENSION_ID = "emkmbecadncngofidjgocmifhbonifgm";
export const GRASSEYE_TOOL_EXTENSION_ID_HEADER = "X-GrassEye-Tool-Extension-Id";

export type WorkbenchPairingState = Readonly<{
  authority: "present" | "absent";
  pairingSecret: string | null;
  releaseBuildId: string;
}>;

type AutomaticPairingActor = Readonly<{
  canAttemptAutomaticPairing(): boolean;
  pair(pairingSecret: string): Promise<void>;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isReleaseBuildId = (value: unknown): value is string =>
  typeof value === "string" && /^build-[a-f0-9-]{36}$/u.test(value);

export const readWorkbenchPairingState = async (
  fetchPairing: typeof globalThis.fetch = globalThis.fetch,
  extensionId = GRASSEYE_TOOL_EXTENSION_ID,
): Promise<WorkbenchPairingState> => {
  const response = await fetchPairing(GRASSEYE_PAIRING_URL, {
    method: "GET",
    cache: "no-store",
    credentials: "omit",
    headers: { [GRASSEYE_TOOL_EXTENSION_ID_HEADER]: extensionId },
    redirect: "error",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) {
    throw new Error(response.status === 403
      ? "BROWSER_PAIRING_ORIGIN_REJECTED"
      : "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
  }
  const body: unknown = await response.json();
  if (!isRecord(body)
    || (body.authority !== "present" && body.authority !== "absent")
    || !isReleaseBuildId(body.releaseBuildId)) {
    throw new Error("BROWSER_PAIRING_RESPONSE_INVALID");
  }
  if (body.authority === "present") {
    return { authority: "present", pairingSecret: null, releaseBuildId: body.releaseBuildId };
  }
  if (typeof body.pairingSecret !== "string" || !/^[a-f0-9]{64}$/u.test(body.pairingSecret)) {
    throw new Error("BROWSER_PAIRING_RESPONSE_INVALID");
  }
  return { authority: "absent", pairingSecret: body.pairingSecret, releaseBuildId: body.releaseBuildId };
};

export class PairingAutoBootstrap {
  private inFlight: Promise<void> | null = null;
  private failureCode: string | null = null;

  public constructor(
    private readonly chromeApi: ExtensionChromeApi,
    private readonly actor: AutomaticPairingActor,
    private readonly currentReleaseBuildId: string,
    private readonly readPairingState: () => Promise<WorkbenchPairingState> = () =>
      readWorkbenchPairingState(globalThis.fetch, chromeApi.runtime.id),
  ) {}

  public start(): void {
    this.chromeApi.runtime.onStartup.addListener(() => { void this.attempt(); });
    this.chromeApi.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
      const url = changeInfo.url ?? tab.url;
      const terminalPageState = changeInfo.status === "loading" || changeInfo.status === "complete";
      if (terminalPageState && url?.startsWith("http://127.0.0.1:4173/")) void this.attempt();
    });
    this.chromeApi.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === GRASSEYE_AUTO_PAIRING_ALARM) void this.attempt();
    });
    void this.chromeApi.alarms.create(GRASSEYE_AUTO_PAIRING_ALARM, { periodInMinutes: 1 }).catch((error) => {
      const code = error instanceof Error ? error.message : "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE";
      this.failureCode = /^BROWSER_[A-Z_]+$/u.test(code) ? code : "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE";
    });
    void this.attempt();
  }

  public attempt(): Promise<void> {
    if (!this.actor.canAttemptAutomaticPairing()) return Promise.resolve();
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.run().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  public currentFailureCode(): string | null {
    return this.failureCode;
  }

  private async run(): Promise<void> {
    let pairingSecret: string | null = null;
    try {
      const state = await this.readPairingState();
      if (state.releaseBuildId !== this.currentReleaseBuildId) {
        this.failureCode = null;
        this.chromeApi.runtime.reload();
        return;
      }
      if (state.authority === "present" || !this.actor.canAttemptAutomaticPairing()) {
        this.failureCode = null;
        return;
      }
      pairingSecret = state.pairingSecret;
      if (!pairingSecret) throw new Error("BROWSER_PAIRING_RESPONSE_INVALID");
      await this.actor.pair(pairingSecret);
      this.failureCode = null;
    } catch (error) {
      const code = error instanceof Error ? error.message : "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE";
      this.failureCode = /^BROWSER_[A-Z_]+$/u.test(code) ? code : "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE";
    } finally {
      pairingSecret = null;
    }
  }
}
