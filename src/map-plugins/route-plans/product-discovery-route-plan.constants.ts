export const PRODUCT_DISCOVERY_ROUTE_PLAN_ID = "product-discovery-route-plan.v1";

export const PRODUCT_DISCOVERY_POSITIVE_ROUTE_LABEL = "read-comments-and-save-evidence";

export const PRODUCT_DISCOVERY_NEGATIVE_ROUTE_LABEL = "skip-current-video";

export const NEXT_ITEM_ADVANCED_ROUTE_LABEL = "next-item-advanced";

export const NEXT_ITEM_NOT_ADVANCED_ROUTE_LABEL = "next-item-not-advanced";

export const PRODUCT_DISCOVERY_ROUTE_LABELS = [
  "read-comments",
  "save-evidence",
  PRODUCT_DISCOVERY_POSITIVE_ROUTE_LABEL,
  "finish-current-video",
  PRODUCT_DISCOVERY_NEGATIVE_ROUTE_LABEL,
  "mark-not-interested-then-continue",
  "publish-default-smile-comment-then-continue",
  "stop-task",
] as const;

export const PRODUCT_DISCOVERY_OUTCOME_OPTIONS = [
  {
    optionId: "read_comments",
    label: "1. 读取评论",
    decision: "product_yes",
    routeLabel: "read-comments",
    description: "V2 dormant: 产品成立时进入评论读取链路。",
  },
  {
    optionId: "save_evidence",
    label: "2. 保存证据",
    decision: "product_yes",
    routeLabel: "save-evidence",
    description: "V2 dormant: 产品成立时保留当前视频的扩展证据。",
  },
  {
    optionId: "read_comments_and_save_evidence",
    label: "3. 保存产品线索并继续",
    decision: "product_yes",
    routeLabel: PRODUCT_DISCOVERY_POSITIVE_ROUTE_LABEL,
    description: "V1 当前生产主链：保存截图、URL 和 AI 判断摘要为产品线索记录，然后继续下一个视频。",
  },
  {
    optionId: "finish_current_video",
    label: "4. 结束当前视频",
    decision: "product_yes",
    routeLabel: "finish-current-video",
    description: "产品成立时结束当前视频处理。",
  },
  {
    optionId: "skip_current_video",
    label: "1. 跳过当前视频",
    decision: "product_no",
    routeLabel: PRODUCT_DISCOVERY_NEGATIVE_ROUTE_LABEL,
    description: "产品不成立时直接切换到下一个视频。",
  },
  {
    optionId: "mark_not_interested_then_continue",
    label: "2. 点不感兴趣后继续",
    decision: "product_no",
    routeLabel: "mark-not-interested-then-continue",
    description: "产品不成立时标记不感兴趣并继续浏览。",
  },
  {
    optionId: "publish_default_smile_comment_then_continue",
    label: "3. 发布默认笑脸评论后继续",
    decision: "product_no",
    routeLabel: "publish-default-smile-comment-then-continue",
    description: "产品不成立时发布默认评论再继续浏览。",
  },
  {
    optionId: "stop_task",
    label: "4. 直接结束任务",
    decision: "product_no",
    routeLabel: "stop-task",
    description: "产品不成立时结束当前任务。",
  },
] as const;
