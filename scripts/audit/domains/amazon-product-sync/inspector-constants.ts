export const domain = "amazon-product-sync";
export const selfPath = "scripts/audit/domains/amazon-product-sync/inspector.ts";
export const pluginStatusPath = "scripts/audit/config/plugin-status.json";
export const boundaryPath = "src/app/workbench-api-boundary.ts";
export const serverPath = "src/app/create-workbench-server.ts";
export const schemaPath = "src/plugins/amazon-product-sync/amazon-product-sync.schema.ts";
export const flowPath = "src/plugins/amazon-product-sync/amazon-product-sync.flow.ts";
export const taskServicePath = "src/plugins/amazon-product-sync/amazon-product-sync-task-service.ts";
export const domScriptsPath = "src/plugins/amazon-product-sync/amazon-product-sync.dom-scripts.ts";
export const acceptancePath = "scripts/acceptance/amazon-product-sync.acceptance.ts";

export const requiredFiles = [
  ".github/instructions/agent-rules/modules/module-amazon-product-sync.instructions.md",
  "docs/法案辅助文件/GrassEye Amazon 产品更新同步施工图.md",
  "scripts/audit/domains/amazon-product-sync/manifest.json",
  schemaPath,
  flowPath,
  domScriptsPath,
  taskServicePath,
  "src/plugins/amazon-product-sync/amazon-product-sync.storage.ts",
  "src/plugins/amazon-product-sync/index.ts",
  "src/app/workbench-amazon-product-sync-routes.ts",
  acceptancePath,
] as const;

export const requiredFlowTokens = [
  "form#sc-global-search-form",
  "input#sc-search-field",
  "button.sc-search-button",
  "搜索 SKU、商品名称/关键词、FNSKU、ASIN、UPC/EAN",
  "shadowRoot",
  "input[type='text'], input",
  "dispatchEvent",
  "document.createEvent",
  "Object.defineProperty",
  "hostValueGetterDefined",
  "shadowValueReady",
  "searchEventsReady",
  "kat-input host own value getter for React onInput target",
  "SearchBox-module__searchButton MouseEvent click",
  "SearchBox-module__searchButton DOM MouseEvent submit click",
  "pointerdown",
  "clickEventDispatched",
  "searchClickDelayMs",
  "setTimeout",
  "closeAmazonTabOnCompletion",
  "closeActiveTab",
  "ProductDetails-module__container",
  "JanusSplitBox-module__row",
  "JanusSplitBox-module__panel",
  "JanusTable-module__tableContentRow",
  "SKU",
  "ASIN",
  "现货（亚马逊物流）",
  "inventory_filter_shadow_input_submit_failed",
  "inventory_filter_search_button_dom_click_failed",
  "inventory_search_result_dom_not_verified",
] as const;

export const requiredLogEvents = [
  "amazon_product_sync.start_received",
  "amazon_product_sync.queued",
  "amazon_product_sync.progress",
  "amazon_product_sync.item_summary",
  "amazon_product_sync.flow_finished",
  "amazon_product_sync.flow_failed",
  "amazon_product_sync.stale_running_task_failed",
] as const;

export const requiredDiagnosticRefs = ["authGate", "detectedState", "diagnosticStage", "pageTitle", "pageUrlPath"] as const;
export const requiredMainImageSchemaTokens = ["mainImageUpload", "endpoint", "token", "imageUrl", "mediaId", "imageSha256", "uploaded"] as const;
export const requiredMainImageUploadTokens = ["mainImageUpload", "x-amzmgr-agent-product-image-token", "imageBase64", "imageMimeType", "imageUrl", "mediaId", "uploaded"] as const;
export const forbiddenFlowTokens = ["setFileInputFiles", "callbackUrl", "XMLHttpRequest", "rowMatchScore", "pickBestSkuRow", "findAfter", "readFieldAfter", "expectedOutputOverride"] as const;
