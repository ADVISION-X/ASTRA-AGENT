export type WorkbenchWindowRestoreResult = Readonly<{
  handoffMode: "opened_new_window" | "already_visible" | "unsupported_platform_noop" | string;
}>;

export function getOpenCommand(url: string, platform?: NodeJS.Platform): Readonly<{ command: string; args: string[]; browserName: string; browserPath: string }>;
export function buildChromeWindowRestoreScript(url: string, browserApp?: string): string;
export function restoreWorkbenchWindowIfChromeHasNoWindow(
  url: string,
  platform?: NodeJS.Platform,
  spawnRunner?: (command: string, args: readonly string[]) => Promise<Readonly<{ stdout: string; stderr: string }>>,
): Promise<WorkbenchWindowRestoreResult>;

export function openWorkbenchPage(
  url: string,
  platform?: NodeJS.Platform,
  spawnRunner?: (command: string, args: readonly string[]) => Promise<Readonly<{ stdout: string; stderr: string }>>,
): Promise<Readonly<{ browserName: string; browserPath: string; handoffMode: string }>>;
