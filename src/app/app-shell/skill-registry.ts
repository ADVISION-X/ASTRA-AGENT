export type AppShellSkillStatus = "active" | "disabled" | "planned";

export type AppShellSkillRegistryItem = {
  id: string;
  label: string;
  category: "product-mining" | "research" | "content" | "system";
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
    id: "amazon-product-mining",
    label: "Amazon Product Mining",
    category: "product-mining",
    description: "Keyword evidence packages and keyword-level AI review history.",
    route: "/skills/amazon-product-mining",
    status: "active",
    primarySurface: "amazon-product-mining-workspace",
    historySurface: "amazon-product-mining-keyword-history",
    detailSurface: "amazon-product-mining-inspector",
    allowedActions: ["Start Task", "Latest", "Export", "Refresh", "Open Package", "Open Master Report", "Open AI Review", "Open Evidence"],
    forbiddenActions: [...forbiddenAppShellActionGroups],
  },
  {
    id: "facebook-video-mining",
    label: "Facebook Video Mining",
    category: "product-mining",
    description: "Governed Facebook product video mining run surface.",
    route: "/skills/facebook-video-mining",
    status: "active",
    primarySurface: "facebook-video-mining-workspace",
    historySurface: "facebook-video-record-history",
    detailSurface: "runtime-event-inspector",
    allowedActions: ["Start", "Latest", "Export"],
    forbiddenActions: [...forbiddenAppShellActionGroups],
  },
  {
    id: "tiktok-product-mining",
    label: "TikTok Product Mining",
    category: "product-mining",
    description: "Planned short-video product signal workspace.",
    route: "/skills/tiktok-product-mining",
    status: "planned",
    primarySurface: "planned-skill-workspace",
    historySurface: "planned-history",
    detailSurface: "planned-detail",
    allowedActions: [],
    forbiddenActions: [...forbiddenAppShellActionGroups],
  },
  {
    id: "deep-research-analysis",
    label: "Deep Research Analysis",
    category: "research",
    description: "Structured research job flow with durable reports and evidence refs.",
    route: "/skills/deep-research-analysis",
    status: "active",
    primarySurface: "deep-research-workspace",
    historySurface: "deep-research-history",
    detailSurface: "deep-research-report-detail",
    allowedActions: ["Start", "Latest", "Refresh"],
    forbiddenActions: [...forbiddenAppShellActionGroups],
  },
  {
    id: "video-downloader",
    label: "Video Downloader",
    category: "content",
    description: "Governed single-source video artifact extraction.",
    route: "/skills/video-downloader",
    status: "active",
    primarySurface: "video-download-workspace",
    historySurface: "video-download-status",
    detailSurface: "artifact-detail",
    allowedActions: ["Start", "Detect Source"],
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
    allowedActions: ["Start", "Resume", "Latest"],
    forbiddenActions: [...forbiddenAppShellActionGroups],
  },
];

export const getDefaultSkill = (): AppShellSkillRegistryItem => {
  const defaultSkill = skillRegistry.find((skill) => skill.id === "amazon-product-mining") ?? skillRegistry[0];
  if (!defaultSkill) throw new Error("App Shell skill registry must contain at least one skill.");
  return defaultSkill;
};
