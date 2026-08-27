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
    id: "production-runtime",
    label: "生产工厂",
    category: "system",
    description: "Local-only whole-order status and safe intervention surface.",
    route: "/skills/production-runtime",
    status: "active",
    primarySurface: "production-runtime-workspace",
    historySurface: "production-runtime-status",
    detailSurface: "production-runtime-inspector",
    allowedActions: ["Status"],
    forbiddenActions: [...forbiddenAppShellActionGroups, "stage-control", "browser-command", "selector", "coordinate"],
  },
];

export const getDefaultSkill = (): AppShellSkillRegistryItem => {
  const defaultSkill = skillRegistry.find((skill) => skill.id === "production-runtime");
  if (!defaultSkill) throw new Error("App Shell skill registry must contain at least one skill.");
  return defaultSkill;
};
