export type WorkbenchWindowRestoreResult = Readonly<{
  handoffMode: "opened_new_window" | "already_visible" | "unsupported_platform_noop" | string;
}>;

export function buildChromeWindowRestoreScript(url: string): string;
export function restoreWorkbenchWindowIfChromeHasNoWindow(
  url: string,
  platform?: NodeJS.Platform,
  spawnRunner?: (command: string, args: readonly string[]) => Promise<Readonly<{ stdout: string; stderr: string }>>,
): Promise<WorkbenchWindowRestoreResult>;

export function openWorkbenchPage(url: string, platform?: NodeJS.Platform): Promise<unknown>;
