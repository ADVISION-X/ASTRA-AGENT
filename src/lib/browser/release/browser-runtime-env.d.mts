export function loadBrowserRuntimeEnv(rootDir: string, target?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
export function resolveBrowserRuntimeMode(env?: NodeJS.ProcessEnv): "production" | "test";
