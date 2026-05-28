import { APP_SHELL_CORE_STYLES } from "./app-shell-core-styles.js";
import { APP_SHELL_INSPECTOR_CONSOLE_STYLES } from "./app-shell-inspector-console-styles.js";
import { APP_SHELL_WORKSPACE_STYLES } from "./app-shell-workspace-styles.js";

const APP_SHELL_STYLES = [
  APP_SHELL_CORE_STYLES,
  APP_SHELL_WORKSPACE_STYLES,
  APP_SHELL_INSPECTOR_CONSOLE_STYLES,
].join("\n");

export const renderAppShellStyles = (): string => APP_SHELL_STYLES;
