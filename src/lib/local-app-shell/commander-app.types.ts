import type { ActionableErrorView } from "./view-helpers.js";

export type CommanderAppPageId = "home" | "map-lab" | "mission" | "results" | "review" | "health" | "developer";

export type CommanderAppNavItem = {
  pageId: CommanderAppPageId;
  label: string;
  shortLabel: string;
  requiresDeveloperMode?: boolean;
};

export type CommanderAppTabGroupId = "mission" | "results" | "health";

export type CommanderAppTabOption = {
  id: string;
  label: string;
};

export type CommanderAppTabGroup = {
  pageId: CommanderAppPageId;
  groupId: CommanderAppTabGroupId;
  defaultTabId: string;
  options: CommanderAppTabOption[];
};

export type CommanderAppViewportGate = {
  minWidth: number;
  maxWidth: number;
  idealWidthMin: number;
  idealWidthMax: number;
  minHeight: number;
  maxHeight: number;
  checkpoints: Array<{ width: number; height: number }>;
};

export type CommanderAppViewModel = {
  initialPageId: CommanderAppPageId;
  navItems: CommanderAppNavItem[];
  tabGroups: CommanderAppTabGroup[];
  viewportGate: CommanderAppViewportGate;
  actionableErrors: ActionableErrorView[];
};