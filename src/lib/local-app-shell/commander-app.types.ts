import type { ActionableErrorView } from "./view-helper-actionable-errors.js";

export type CommanderAppPageId = "home" | "amazon-invoice-upload" | "mission" | "results" | "review" | "settings" | "health";

export type CommanderAppNavItem = {
  pageId: CommanderAppPageId;
  label: string;
  shortLabel: string;
};

type CommanderAppTabGroupId = "mission" | "results" | "health";

type CommanderAppTabOption = {
  id: string;
  label: string;
};

export type CommanderAppTabGroup = {
  pageId: CommanderAppPageId;
  groupId: CommanderAppTabGroupId;
  defaultTabId: string;
  options: CommanderAppTabOption[];
};

type CommanderAppViewportGate = {
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
