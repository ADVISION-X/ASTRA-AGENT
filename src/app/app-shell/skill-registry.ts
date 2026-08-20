export type AppShellSkillStatus = "active" | "disabled" | "planned";

export type AppShellSkillRegistryItem = {
  id: string;
  label: string;
  category: "product-mining" | "content" | "system";
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
  {
    id: "amazon-product-mining",
    label: "Amazon Product Mining",
    category: "product-mining",
    description: "Keyword evidence packages and keyword-level AI review history.",
    route: "/skills/amazon-product-mining",
    status: "active",
    primarySurface: "amazon-product-mining-workspace",
    historySurface: "amazon-product-mining-keyword-history",
    detailSurface: "amazon-product-mining-inspector",
    allowedActions: ["Start Task", "Latest", "Export", "Refresh", "Open Package", "Open Master Report", "Open AI Review", "Open Evidence", "Pause", "Cancel", "Takeover", "Resume"],
    forbiddenActions: [...forbiddenAppShellActionGroups],
  },
  {
    id: "media-optimizer",
    label: "Media Optimizer",
    category: "content",
    description: "Website-ready image and video artifact optimization.",
    route: "/skills/media-optimizer",
    status: "active",
    primarySurface: "media-optimizer-workspace",
    historySurface: "media-processing-status",
    detailSurface: "media-artifact-detail",
    allowedActions: ["Upload", "Start", "Download", "Inspect Artifact"],
    forbiddenActions: [...forbiddenAppShellActionGroups],
  },
  {
    id: "amazon-invoice-upload",
    label: "Amazon Invoice Upload",
    category: "system",
    description: "Bounded invoice upload job flow inside the unified shell.",
    route: "/skills/amazon-invoice-upload",
    status: "active",
    primarySurface: "amazon-invoice-upload-workspace",
    historySurface: "task-status-inspector",
    detailSurface: "evidence-detail",
    allowedActions: ["Start Download", "Latest Download", "Open Artifact", "Start", "Latest", "Pause", "Cancel", "Takeover", "Resume"],
    forbiddenActions: [...forbiddenAppShellActionGroups],
  },
];

export const getDefaultSkill = (): AppShellSkillRegistryItem => {
  const defaultSkill = skillRegistry.find((skill) => skill.id === "amazon-product-mining") ?? skillRegistry[0];
  if (!defaultSkill) throw new Error("App Shell skill registry must contain at least one skill.");
  return defaultSkill;
};
