export const supportedAppShellLocales = ["zh", "en"] as const;
export type AppShellLocale = (typeof supportedAppShellLocales)[number];

export const defaultAppShellLocale: AppShellLocale = "zh";
export const appShellLocaleCookieName = "grasseye-app-locale";
export const appShellLocaleSearchParamName = "locale";

const appShellZhCopyEntries = [
  ["GrassEye", "GrassEye"],
  ["GrassEye AGENT Workbench", "GrassEye AGENT 工作台"],
  ["AGENT Workbench", "AGENT 工作台"],
  ["Skill Registry", "技能注册表"],
  ["Toggle sidebar", "切换侧边栏"],
  ["Collapse sidebar", "收起侧边栏"],
  ["Toggle inspector", "切换检查器"],
  ["Toggle console", "切换控制台"],
  ["Refresh shell", "刷新工作台"],
  ["Language", "语言"],
  ["Chinese", "中文"],
  ["English", "English"],
  ["health", "健康"],
  ["mode", "模式"],
  ["Inspector", "检查器"],
  ["No selection", "未选择"],
  ["empty", "空"],
  ["Open Detail When Needed", "需要时打开详情"],
  ["Task, keyword review, package, AI review, evidence, exception, and runtime events use this third-level surface. It stays closed until a user selects a detail.", "任务、关键词复核、资料包、AI 复核、证据、异常和运行事件都使用这个三级详情面板。用户选择详情前它保持关闭。"],
  ["Task Snapshot", "任务快照"],
  ["ID", "ID"],
  ["Status", "状态"],
  ["Step", "步骤"],
  ["Reason", "原因"],
  ["Evidence", "证据"],
  ["Raw record", "原始记录"],
  ["Runtime Console", "运行控制台"],
  ["ready", "就绪"],
  ["Waiting for runtime events.", "等待运行事件。"],
  ["Loading runtime events...", "正在加载运行事件..."],
  ["Runtime event stream unavailable.", "运行事件流不可用。"],
  ["manual_required events appear here.", "manual_required 事件显示在这里。"],
  ["failed events appear here.", "failed 事件显示在这里。"],
  ["Level 2 Skill Workspace", "二级技能工作区"],
  ["Facebook Video Mining", "Facebook 视频挖掘"],
  ["Governed feed scan result surface. Run details open in Inspector.", "受治理的信息流扫描结果面。运行详情在检查器中打开。"],
  ["Saved Records", "已保存记录"],
  ["New Run", "新运行"],
  ["Runtime", "运行态"],
  ["Primary History", "主历史"],
  ["Saved product records", "已保存产品记录"],
  ["Agent Records", "Agent 记录"],
  ["No saved records loaded", "未加载已保存记录"],
  ["Run Facebook Video Mining or load Latest to review persisted product video records. Selecting a record opens the Inspector.", "运行 Facebook 视频挖掘或加载最新记录来查看持久化产品视频记录。选择记录会打开检查器。"],
  ["Target product count", "目标产品数量"],
  ["Start", "开始"],
  ["Latest", "最新"],
  ["Export", "导出"],
  ["Delete", "删除"],
  ["Runtime Events", "运行事件"],
  ["Use the bottom console for live events", "使用底部控制台查看实时事件"],
  ["Task started, completed, manual_required, and failed events stay in the independent Runtime Console, not in the history table.", "任务开始、完成、manual_required 和 failed 事件保留在独立运行控制台中，不进入历史表。"],
  ["Telegram Web", "Telegram Web"],
  ["YouTube", "YouTube"],
  ["Universal", "通用"],
  ["Facebook", "Facebook"],
  ["TikTok", "TikTok"],
  ["Telegram Web boundary", "Telegram Web 边界"],
  ["Open and authorize the target Telegram Web page in local Chrome, play the target video, then detect the current source.", "在本地 Chrome 打开并授权目标 Telegram Web 页面，播放目标视频，然后探测当前来源。"],
  ["Open Telegram Web", "打开 Telegram Web"],
  ["URL -> governed local runtime -> optional subtitles.", "URL -> 受治理本地运行时 -> 可选字幕。"],
  ["Visible page media candidates -> one validated artifact.", "可见页面媒体候选 -> 一个已验证 artifact。"],
  ["Visible video URL -> governed media artifact.", "可见视频 URL -> 受治理媒体 artifact。"],
  ["Source page URL", "来源页面 URL"],
  ["Detect current video", "探测当前视频"],
  ["Play the video first, then detect.", "先播放视频，再探测。"],
  ["Quality", "质量"],
  ["Best available", "最佳可用"],
  ["Max MB", "最大 MB"],
  ["download subtitles", "下载字幕"],
  ["Subtitle languages", "字幕语言"],
  ["Save to Downloads/GrassEye Video Downloads", "保存到 Downloads/GrassEye Video Downloads"],
  ["Artifact", "产物"],
  ["No media artifact selected", "未选择媒体 artifact"],
  ["Verified video artifacts, subtitles, and failure reasons open here from backend results.", "已验证视频 artifact、字幕和失败原因从后端结果打开到这里。"],
  ["Settings", "设置"],
  ["Source-specific controls", "来源专属控制"],
  ["Platform mode, quality ceiling, size limit, and download destination stay bounded to this skill workspace.", "平台模式、质量上限、大小限制和下载位置限定在此技能工作区内。"],
  ["Video Downloader", "视频下载器"],
  ["One source page, one verified media artifact.", "一个来源页面，一个已验证媒体 artifact。"],
  ["Source", "来源"],
  ["Planned Skill Workspace", "规划技能工作区"],
  ["TikTok Product Mining", "TikTok 产品挖掘"],
  ["This skill is registered but disabled until a future law authorizes its job flow.", "该技能已注册但保持禁用，直到未来法案授权其 job flow。"],
  ["planned", "规划中"],
  ["No production surface", "无生产界面"],
  ["Planned skills remain visible in the registry without creating a second implementation path.", "规划技能只在注册表中可见，不创建第二实现路径。"],
  ["Research Executor", "研究执行器"],
  ["Pick3 IS Blind Eval", "Pick3 IS 盲测评估"],
  ["Official UAE Pick 3 data sync and isolated L80 visual batches.", "官方 UAE Pick 3 数据同步与隔离 L80 视觉批次。"],
  ["active", "活跃"],
  ["Run", "运行"],
  ["Trend", "趋势"],
  ["Images", "图片"],
  ["History", "历史"],
  ["Audit", "审计"],
  ["Mode", "模式"],
  ["Sync and generate images", "同步并生成图片"],
  ["Full pipeline via GPT web chat", "通过 GPT 网页聊天运行完整链路"],
  ["Next prediction stability", "下一期预测稳定性"],
  ["AI provider", "AI 提供方"],
  ["AI analysis mode", "AI 分析模式"],
  ["Playbook mode", "Playbook 模式"],
  ["AI free analysis mode", "AI 自由分析模式"],
  ["Gemini web chat", "Gemini 网页聊天"],
  ["Sync only", "仅同步"],
  ["Batch size", "批次大小"],
  ["Blind boundary", "盲测边界"],
  ["L80 images contain no title, axis, phase, date, Chart number, point count, answer, or position text.", "L80 图片不包含标题、坐标轴、期号、日期、图表编号、点数、答案或位置文字。"],
  ["Next stability", "下一期稳定性"],
  ["In next prediction stability, batch size is repeat sends of the same one image per selected position.", "在下一期预测稳定性中，批次大小表示每个所选位置同一张图片的重复发送次数。"],
  ["Latest Task", "最新任务"],
  ["No Pick3 task loaded", "未加载 Pick3 任务"],
  ["idle", "空闲"],
  ["Rows seen", "读取行数"],
  ["Inserted", "新增"],
  ["Updated", "更新"],
  ["Newest phase", "最新期号"],
  ["Batch", "批次"],
  ["Artifact dir", "Artifact 目录"],
  ["Random baseline", "随机基线"],
  ["Official Trend", "官方趋势"],
  ["Latest 80 draw window", "最新 80 期窗口"],
  ["Window", "窗口"],
  ["Phase range", "期号范围"],
  ["Latest phase", "最新期号"],
  ["Historical offset", "历史偏移"],
  ["Total draws", "总期数"],
  ["AI Image Manifest", "AI 图片清单"],
  ["One image per AI call", "每次 AI 调用一张图片"],
  ["Next Stability History", "下一期稳定性历史"],
  ["Pick3 History", "Pick3 历史"],
  ["Human review evidence", "人工复核证据"],
  ["Scoring and human review evidence", "评分与人工复核证据"],
  ["Task", "任务"],
  ["Phase", "期号"],
  ["Window", "窗口"],
  ["Repeats", "重复次数"],
  ["Completeness", "完整性"],
  ["Observed distribution", "观察分布"],
  ["Scoring", "评分"],
  ["Phase Result", "单期结果"],
  ["Playbook Lessons", "Playbook 经验库"],
  ["AI Answers", "AI 回答"],
  ["Statistical Honesty", "统计诚实性"],
  ["Confidence is not probability", "置信度不是概率"],
  ["Model id, temperature, image detail, prompt versions, random baselines, calibration, and abstain coverage are required by law before AI scoring is considered complete.", "模型 ID、temperature、图片细节、prompt 版本、随机基线、校准和 abstain 覆盖率都是 AI 评分完成前的法定要求。"],
  ["Latest Task Summary Card", "最新任务摘要卡"],
  ["Latest task", "最新任务"],
  ["read model", "读取模型"],
  ["latest task id", "最新任务 ID"],
  ["task status", "任务状态"],
  ["keywords", "关键词"],
  ["search results", "搜索结果"],
  ["product details", "产品详情"],
  ["reviews", "评论"],
  ["keyword reviews", "关键词复核"],
  ["package/pdf ref", "资料包/PDF 引用"],
  ["No latest task loaded.", "未加载最新任务。"],
  ["Live task read model loaded.", "实时任务读取模型已加载。"],
  ["Loading latest task...", "正在加载最新任务..."],
  ["Latest task failed to load. Retry from the command bar or task card.", "最新任务加载失败。请从命令栏或任务卡重试。"],
  ["failed task state will appear here.", "失败任务状态将显示在这里。"],
  ["Amazon Product Mining", "Amazon 产品挖掘"],
  ["Amazon Product Mining pages", "Amazon 产品挖掘页面"],
  ["Keyword evidence packages and keyword-level opportunity reviews. Business verdicts are displayed from persisted backend records only.", "关键词证据包和关键词级机会复核。业务判断只显示持久化后端记录。"],
  ["Keyword evidence packages and keyword-level AI review history.", "关键词证据包和关键词级 AI 复核历史。"],
  ["Review History", "复核历史"],
  ["New Task", "新任务"],
  ["Decision", "决策"],
  ["All", "全部"],
  ["Keyword search", "关键词搜索"],
  ["Search keyword", "搜索关键词"],
  ["Marketplace", "站点"],
  ["Task ID", "任务 ID"],
  ["Optional task ID", "可选任务 ID"],
  ["Target market", "目标市场"],
  ["Filter target market", "筛选目标市场"],
  ["Human next step", "人工下一步"],
  ["Data confidence", "数据置信度"],
  ["Package integrity", "资料包完整性"],
  ["Package Integrity", "资料包完整性"],
  ["Sort", "排序"],
  ["Created At desc", "创建时间倒序"],
  ["Decision priority", "决策优先级"],
  ["Data Confidence", "数据置信度"],
  ["Review Count", "评论数量"],
  ["Product Count", "产品数量"],
  ["Keyword Opportunity Review History", "关键词机会复核历史"],
  ["No keyword opportunity reviews yet. Run an Amazon product mining task and complete AI keyword review to populate this table.", "还没有关键词机会复核。运行 Amazon 产品挖掘任务并完成 AI 关键词复核后会填充此表。"],
  ["Agent History", "Agent 历史"],
  ["No keyword reviews loaded", "未加载关键词复核"],
  ["Run or refresh Amazon Product Mining to load persisted keyword opportunity reviews. The wide review table opens only when backend records exist.", "运行或刷新 Amazon 产品挖掘以加载持久化关键词机会复核。只有存在后端记录时才打开宽表。"],
  ["Created At", "创建时间"],
  ["Keyword", "关键词"],
  ["Human Next Step", "人工下一步"],
  ["Demand Signal", "需求信号"],
  ["Review Health", "评论健康度"],
  ["Price Ceiling", "价格上限"],
  ["Competition Openness", "竞争开放度"],
  ["Improvement Opportunity", "改进机会"],
  ["Data Completeness", "数据完整性"],
  ["Open", "打开"],
  ["Keyword Review Inspector", "关键词复核检查器"],
  ["Publish Task Card", "发布任务卡"],
  ["New keyword mining task", "新关键词挖掘任务"],
  ["governed input", "受治理输入"],
  ["Amazon marketplace", "Amazon 站点"],
  ["Product direction", "产品方向"],
  ["Requested keyword count", "请求关键词数量"],
  ["Provider", "提供方"],
  ["Select provider", "选择提供方"],
  ["Gemini API", "Gemini API"],
  ["Gemini web chat", "Gemini 网页聊天"],
  ["GPT web chat", "GPT 网页聊天"],
  ["Language preference", "语言偏好"],
  ["Download", "下载"],
  ["Upload", "上传"],
  ["Batch Upload", "批量上传"],
  ["Ledger", "账本"],
  ["Date Range", "日期范围"],
  ["Last 30 Days", "最近 30 天"],
  ["Format", "格式"],
  ["Report Type", "报告类型"],
  ["Callback URL", "回调 URL"],
  ["require human review", "需要人工复核"],
  ["Start Download", "开始下载"],
  ["Latest Download", "最新下载"],
  ["Open Artifact", "打开产物"],
  ["task id", "任务 ID"],
  ["reached step", "到达步骤"],
  ["artifact ref", "artifact 引用"],
  ["Amazon order ID", "Amazon 订单 ID"],
  ["Seller Central URL", "Seller Central 链接"],
  ["Seller Central Entry URL", "Seller Central 入口 URL"],
  ["Invoice number", "发票号"],
  ["Approved PDF", "已批准 PDF"],
  ["Admin order URL", "后台订单 URL"],
  ["Resume", "恢复"],
  ["PDF files", "PDF 文件"],
  ["Source rule", "来源规则"],
  ["filename = order id = invoice no", "文件名 = 订单 ID = 发票号"],
  ["stop on failed", "失败时停止"],
  ["Start Batch Upload", "开始批量上传"],
  ["Open Ledger", "打开账本"],
  ["batch id", "批次 ID"],
  ["current order", "当前订单"],
  ["total", "总数"],
  ["succeeded", "成功"],
  ["already uploaded", "已上传"],
  ["failed", "失败"],
  ["blocked auth", "授权阻塞"],
  ["Upload Ledger", "上传账本"],
  ["Invoice upload records", "发票上传记录"],
  ["Refresh", "刷新"],
  ["No invoice task selected", "未选择发票任务"],
  ["Use Latest after entering an Amazon order ID. Task details open in the Inspector only when selected.", "输入 Amazon 订单 ID 后使用最新任务。任务详情仅在选择后打开到检查器。"],
  ["No evidence loaded", "未加载证据"],
  ["Completed invoice upload evidence and failure reasons appear here from persisted task records.", "完成的发票上传证据和失败原因从持久化任务记录显示在这里。"],
  ["Bounded Job Flow Surface", "有界 Job Flow 界面"],
  ["Amazon invoice upload", "Amazon 发票上传"],
  ["Structured invoice upload entry inside the unified workbench shell.", "统一工作台外壳内的结构化发票上传入口。"],
  ["Amazon Invoice Upload", "Amazon 发票上传"],
  ["Amazon invoice upload pages", "Amazon 发票上传页面"],
  ["Bounded invoice upload job flow inside the unified shell.", "统一外壳内的有界发票上传 job flow。"],
  ["Source file", "源文件"],
  ["Preset", "预设"],
  ["Web image", "网页图片"],
  ["Responsive image set", "响应式图片组"],
  ["Web video", "网页视频"],
  ["Compressed video", "压缩视频"],
  ["Video poster", "视频封面"],
  ["Output format", "输出格式"],
  ["Max width", "最大宽度"],
  ["Max height", "最大高度"],
  ["Target bitrate kbps", "目标码率 kbps"],
  ["Target max MB", "目标最大 MB"],
  ["Variant widths", "变体宽度"],
  ["Save to Downloads/GrassEye Media Processing", "保存到 Downloads/GrassEye Media Processing"],
  ["Optimized media", "已优化媒体"],
  ["No optimized media yet", "尚无已优化媒体"],
  ["Completed artifacts open here with file path, size, SHA-256, and proof reference.", "完成的 artifact 会在这里显示文件路径、大小、SHA-256 和证明引用。"],
  ["Website output presets", "网站输出预设"],
  ["Image and video transforms stay inside the media-processing capability group.", "图片和视频转换保留在 media-processing 能力组内。"],
  ["Media Optimizer", "媒体优化器"],
  ["Media Optimizer pages", "媒体优化器页面"],
  ["Website-ready image and video artifacts.", "网站可用的图片和视频 artifact。"],
  ["Website-ready image and video artifact optimization.", "网站可用的图片和视频 artifact 优化。"],
  ["Deep Research Analysis", "深度研究分析"],
  ["Deep Research Analysis pages", "深度研究分析页面"],
  ["Structured research job flow with durable reports and evidence refs.", "带持久化报告和证据引用的结构化研究 job flow。"],
  ["New Research", "新研究"],
  ["Report Library", "报告库"],
  ["Case File", "案例文件"],
  ["Report History", "报告历史"],
  ["Recent Reports", "最近报告"],
  ["Search reports", "搜索报告"],
  ["Find by title, question, or status", "按标题、问题或状态查找"],
  ["Report Reader", "报告阅读器"],
  ["Report Navigation", "报告导航"],
  ["Metadata", "元数据"],
  ["Select a report from history", "从历史中选择报告"],
  ["Choose a report above to open the ResearchPlan, promptBundle, clean/raw/index views, exports, and process trace.", "选择上方报告以打开 ResearchPlan、promptBundle、clean/raw/index 视图、导出和过程追踪。"],
  ["User Question", "用户问题"],
  ["Analysis Goal", "分析目标"],
  ["Input Attachments", "输入附件"],
  ["HTML delivery", "HTML 交付"],
  ["Field help", "字段帮助"],
  ["User Question help", "用户问题帮助"],
  ["Analysis Goal help", "分析目标帮助"],
  ["Input Attachments help", "输入附件帮助"],
  ["Language help", "语言帮助"],
  ["Provider help", "提供方帮助"],
  ["Max sub questions", "最大子问题数"],
  ["Max sub questions help", "最大子问题数帮助"],
  ["Close field help", "关闭字段帮助"],
  ["Add files, paste files, or drop local files here", "添加文件、粘贴文件，或把本地文件拖放到这里"],
  ["This is an AI research report, not a guaranteed prediction. Read reverse conditions, opposing arguments, and evidence gaps before acting.", "这是 AI 研究报告，不是保证性预测。行动前请阅读反转条件、反方论据和证据缺口。"],
  ["Governed Facebook product video mining run surface.", "受治理的 Facebook 产品视频挖掘运行界面。"],
  ["Facebook Video Mining pages", "Facebook 视频挖掘页面"],
  ["Governed single-source video artifact extraction.", "受治理的单来源视频 artifact 提取。"],
  ["Video Downloader pages", "视频下载器页面"],
  ["Official UAE Pick 3 sync with L80 isolated blind-image batches.", "官方 UAE Pick 3 同步与 L80 隔离盲测图片批次。"],
  ["Pick3 IS Blind Eval pages", "Pick3 IS 盲测评估页面"],
  ["Planned short-video product signal workspace.", "规划中的短视频产品信号工作区。"],
  ["50% single / 12.5% combo", "单位置 50% / 组合 12.5%"],
  ["optional subtitles.", "可选字幕。"],
  ["governed media artifact.", "受治理媒体 artifact。"],
  ["one validated artifact.", "一个已验证 artifact。"],
  ["hundreds", "百位"],
  ["tens", "十位"],
  ["ones", "个位"],
  ["strong", "强"],
  ["medium", "中"],
  ["weak", "弱"],
  ["insufficient", "不足"],
  ["pass", "通过"],
  ["reject", "拒绝"],
  ["status", "状态"],
  ["not_available", "不可用"],
  ["enter_next_validation", "进入下一步验证"],
  ["mine_related_keywords", "挖掘相关关键词"],
  ["rerun_or_collect_more_data", "重跑或收集更多数据"],
] as const;

export const appShellZhCopy: Readonly<Record<string, string>> = Object.freeze(Object.fromEntries(appShellZhCopyEntries));

export const renderLocaleToggle = (): string => `
<div class="locale-toggle" data-locale-toggle aria-label="Language">
  <span>Language</span>
  <button class="locale-button" type="button" data-locale-choice="zh" aria-pressed="true">中文</button>
  <button class="locale-button" type="button" data-locale-choice="en" aria-pressed="false">English</button>
</div>`;

export const renderAppShellLocalizationClient = (): string => `
const GRASSEYE_SUPPORTED_LOCALES = ${JSON.stringify(supportedAppShellLocales)};
const GRASSEYE_DEFAULT_LOCALE = ${JSON.stringify(defaultAppShellLocale)};
const GRASSEYE_LOCALE_COOKIE = ${JSON.stringify(appShellLocaleCookieName)};
const GRASSEYE_LOCALE_PARAM = ${JSON.stringify(appShellLocaleSearchParamName)};
const GRASSEYE_ZH_COPY = ${JSON.stringify(appShellZhCopy)};
const grasseyeOriginalText = new WeakMap();
const grasseyeOriginalAttrs = new WeakMap();
let grasseyeLocaleObserver = null;
const resolveGrassEyeLocale = (input) => GRASSEYE_SUPPORTED_LOCALES.includes(input) ? input : GRASSEYE_DEFAULT_LOCALE;
const readGrassEyeCookieLocale = () => document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(GRASSEYE_LOCALE_COOKIE + "="))?.split("=")[1] || "";
const readGrassEyeInitialLocale = () => {
  const explicit = new URLSearchParams(window.location.search).get(GRASSEYE_LOCALE_PARAM);
  return resolveGrassEyeLocale(explicit || readGrassEyeCookieLocale() || GRASSEYE_DEFAULT_LOCALE);
};
const writeGrassEyeLocaleCookie = (locale) => {
  document.cookie = GRASSEYE_LOCALE_COOKIE + "=" + locale + "; Max-Age=31536000; Path=/; SameSite=Lax";
};
const translateGrassEyeText = (value, locale) => {
  if (locale !== "zh") return value;
  const trimmed = String(value || "").trim();
  if (!trimmed) return value;
  return GRASSEYE_ZH_COPY[trimmed] || value;
};
const translateGrassEyeNode = (node, locale) => {
  if (node.nodeType === Node.TEXT_NODE) {
    if (!grasseyeOriginalText.has(node)) grasseyeOriginalText.set(node, node.textContent || "");
    node.textContent = translateGrassEyeText(grasseyeOriginalText.get(node), locale);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE || node.closest("script,style,pre,code")) return;
  const attrs = ["aria-label", "title", "placeholder", "value"];
  let original = grasseyeOriginalAttrs.get(node);
  if (!original) {
    original = {};
    for (const attr of attrs) if (node.hasAttribute(attr)) original[attr] = node.getAttribute(attr) || "";
    grasseyeOriginalAttrs.set(node, original);
  }
  for (const attr of attrs) {
    if (original[attr] !== undefined) node.setAttribute(attr, translateGrassEyeText(original[attr], locale));
  }
  for (const child of node.childNodes) translateGrassEyeNode(child, locale);
};
const applyGrassEyeLocale = (localeInput) => {
  const locale = resolveGrassEyeLocale(localeInput);
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  document.body.dataset.locale = locale;
  if (grasseyeLocaleObserver) grasseyeLocaleObserver.disconnect();
  translateGrassEyeNode(document.body, locale);
  document.querySelectorAll("[data-locale-choice]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.localeChoice === locale));
  });
  grasseyeLocaleObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) translateGrassEyeNode(node, locale);
    }
  });
  grasseyeLocaleObserver.observe(document.body, { childList: true, subtree: true });
};
const switchGrassEyeLocale = (locale) => {
  const next = resolveGrassEyeLocale(locale);
  writeGrassEyeLocaleCookie(next);
  applyGrassEyeLocale(next);
};
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-locale-choice]").forEach((button) => {
    button.addEventListener("click", () => switchGrassEyeLocale(button.dataset.localeChoice));
  });
  applyGrassEyeLocale(readGrassEyeInitialLocale());
});
`;
