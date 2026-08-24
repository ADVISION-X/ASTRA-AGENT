export type AppShellSkillStatus = "active" | "disabled" | "planned";

export type AppShellSkillRegistryItem = {
  id: string;
  label: string;
  category: "system";
  description: string;
  route: string;
  status: AppShellSkillStatus;
  primarySurface: string;
  historySurface: string;
  detailSurface: string;
  allowedActions: string[];
  forbiddenActions: string[];
};

export const forbiddenAppShellActionGroups = [
  "commerce-commit",
  "supplier-ordering",
  "listing-launch",
  "campaign-launch",
  "shipment-control",
  "inventory-allocation",
  "winner-selection",
  "margin-adjudication",
  "automated-commerce",
] as const;

export const skillRegistry: AppShellSkillRegistryItem[] = [
  {
    id: "xuanxue-ai-production",
    label: "玄学 AI 生产",
    category: "system",
    description: "Local-only whole-order status and safe intervention surface.",
    route: "/skills/xuanxue-ai-production",
    status: "active",
    primarySurface: "xuanxue-ai-production-workspace",
    historySurface: "xuanxue-ai-production-status",
    detailSurface: "xuanxue-ai-production-inspector",
    allowedActions: ["Status", "Pause", "Cancel", "Takeover", "Resume"],
    forbiddenActions: [...forbiddenAppShellActionGroups, "stage-control", "browser-command", "selector", "coordinate"],
  },
];

export const getDefaultSkill = (): AppShellSkillRegistryItem => {
  const defaultSkill = skillRegistry.find((skill) => skill.id === "xuanxue-ai-production");
  if (!defaultSkill) throw new Error("App Shell skill registry must contain at least one skill.");
  return defaultSkill;
};
