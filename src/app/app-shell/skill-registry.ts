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
    id: "pick3-is-blind-eval",
    label: "Pick3 IS Blind Eval",
    category: "research",
    description: "Official UAE Pick 3 sync with L80 isolated blind-image batches.",
    route: "/skills/pick3-is-blind-eval",
    status: "active",
    primarySurface: "pick3-is-blind-eval-workspace",
    historySurface: "pick3-latest-task",
    detailSurface: "pick3-image-manifest",
    allowedActions: ["Sync", "Generate Images", "Latest", "Open Image"],
    forbiddenActions: [...forbiddenAppShellActionGroups, "betting", "ticket-purchase", "probability-claim"],
  },
  {
    id: "lottery-ticket-plan",
    label: "Lottery Ticket Plan",
    category: "research",
    description: "Local Pick3 upper/lower ticket plan generator for manual review.",
    route: "/skills/lottery-ticket-plan",
    status: "active",
    primarySurface: "lottery-ticket-plan-workspace",
    historySurface: "lottery-ticket-plan-result",
    detailSurface: "lottery-ticket-plan-inspector",
    allowedActions: ["Generate Plan", "Inspect Ticket"],
    forbiddenActions: [...forbiddenAppShellActionGroups, "betting", "ticket-purchase", "my-plan-write", "checkout", "payment"],
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
    allowedActions: ["Start Download", "Latest Download", "Open Artifact", "Start", "Resume", "Latest"],
    forbiddenActions: [...forbiddenAppShellActionGroups],
  },
];

export const getDefaultSkill = (): AppShellSkillRegistryItem => {
  const defaultSkill = skillRegistry.find((skill) => skill.id === "amazon-product-mining") ?? skillRegistry[0];
  if (!defaultSkill) throw new Error("App Shell skill registry must contain at least one skill.");
  return defaultSkill;
};
