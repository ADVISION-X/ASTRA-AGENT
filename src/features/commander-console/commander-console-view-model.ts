import type { CommanderMissionDashboardView } from "../../capabilities/commander-console/index.js";
import type { Locale } from "../../lib/localization/dictionaries.js";
import { getDefaultMapPluginRegistry } from "../../map-plugins/registry/map-plugin-registry.js";

import { localizeCommanderText } from "./locale.js";
import { buildCommanderTaskTemplates } from "./task-template-registry.js";

import type {
  CommanderConsoleBadge,
  CommanderConsoleFailureItem,
  CommanderConsoleInspectItem,
  CommanderConsoleMapView,
  CommanderConsolePolicyCheck,
  CommanderConsolePreflightCheck,
  CommanderConsolePrimaryPageId,
  CommanderConsoleViewModel,
} from "./types.js";

function localize(locale: Locale, zh: string, en: string): string {
  return localizeCommanderText(locale, zh, en);
}

function buildPrimaryPages(locale: Locale): CommanderConsoleViewModel["primaryPages"] {
  return [
    {
      id: "command-center",
      navCode: "CMD",
      label: localize(locale, "指令", "Command"),
      eyebrow: localize(locale, "一级页面", "Level 1"),
      description: localize(locale, "用户只选任务模板与运行限制。内部 map / platform / profile 仅在高级与检查面显示。", "The operator only picks a task template and run limits. Internal map, platform, and profile stay in Advanced and Inspect views."),
      tabs: [
        { id: "command-center:maps", label: localize(locale, "任务目录", "Task Catalog"), subtitle: localize(locale, "选择预设任务模板", "Choose a preset task template") },
        { id: "command-center:start", label: localize(locale, "开始运行", "Start Run"), subtitle: localize(locale, "设置限制并开始", "Set limits and begin") },
        { id: "command-center:preflight", label: localize(locale, "预检", "Preflight"), subtitle: localize(locale, "启动前就绪门", "Readiness gates") },
        { id: "command-center:preview", label: localize(locale, "指令预览", "Command Preview"), subtitle: localize(locale, "人类命令 JSON", "Human command JSON") },
      ],
    },
    {
      id: "mission-cockpit",
      navCode: "MSN",
      label: localize(locale, "任务", "Mission"),
      eyebrow: localize(locale, "一级页面", "Level 1"),
      description: localize(locale, "展示运行真相、轮次推进和证明链，不在这里改写任务真相。", "Mission cockpit for runtime truth, round progression, and proof chains without owning mission truth."),
      tabs: [
        { id: "mission-cockpit:overview", label: localize(locale, "总览", "Overview"), subtitle: localize(locale, "任务摘要", "Mission summary") },
        { id: "mission-cockpit:current", label: localize(locale, "当前轮次", "Current Round"), subtitle: localize(locale, "实时轮次状态", "Live round status") },
        { id: "mission-cockpit:proof", label: localize(locale, "运行证明", "Runtime Proof"), subtitle: localize(locale, "最近证明链", "Recent proof chain") },
        { id: "mission-cockpit:target", label: localize(locale, "当前目标", "Current Target"), subtitle: localize(locale, "目标预览", "Target preview") },
      ],
    },
    {
      id: "records-exports",
      navCode: "REC",
      label: localize(locale, "记录", "Records"),
      eyebrow: localize(locale, "一级页面", "Level 1"),
      description: localize(locale, "证据包、浏览账本、失败记录、复核队列与导出请求在这里分层查看。", "Evidence packets, browse ledger, failed records, review queues, and governed export requests."),
      tabs: [
        { id: "records-exports:evidence", label: localize(locale, "证据包", "Evidence Packets"), subtitle: localize(locale, "可检查证据", "Inspectable evidence") },
        { id: "records-exports:ledger", label: localize(locale, "浏览账本", "Browse Ledger"), subtitle: localize(locale, "浏览轨迹", "Browse trail") },
        { id: "records-exports:failed", label: localize(locale, "失败记录", "Failed Records"), subtitle: localize(locale, "运行落空项", "Operational misses") },
        { id: "records-exports:review", label: localize(locale, "复核记录", "Review Records"), subtitle: localize(locale, "队列状态", "Queue status") },
        { id: "records-exports:export", label: localize(locale, "导出中心", "Export Center"), subtitle: localize(locale, "受治理导出请求", "Governed export requests") },
      ],
    },
    {
      id: "debug-health",
      navCode: "DBG",
      label: localize(locale, "诊断", "Diagnostics"),
      eyebrow: localize(locale, "一级页面", "Level 1"),
      description: localize(locale, "能力健康、故障雷达、日志预览、未终结轮次与审计姿态在这里收口。", "Capability health, failure radar, log previews, unresolved rounds, and audit posture."),
      tabs: [
        { id: "debug-health:health", label: localize(locale, "能力健康", "Capability Health"), subtitle: localize(locale, "归属状态", "Owner status") },
        { id: "debug-health:failure", label: localize(locale, "故障雷达", "Failure Radar"), subtitle: localize(locale, "阻断信号", "Blocking signals") },
        { id: "debug-health:logs", label: localize(locale, "结构化日志", "Structured Log"), subtitle: localize(locale, "只做预览", "Preview only") },
        { id: "debug-health:rounds", label: localize(locale, "未终结轮次", "Unfinalized Rounds"), subtitle: localize(locale, "操作员关注", "Operator attention") },
        { id: "debug-health:audit", label: localize(locale, "审计摘要", "Audit Summary"), subtitle: localize(locale, "本地就绪", "Local readiness") },
      ],
    },
    {
      id: "map-lab",
      navCode: "MAP",
      label: localize(locale, "地图实验室", "Map Lab"),
      eyebrow: localize(locale, "一级页面", "Level 1"),
      description: localize(locale, "AI 只可起草地图，必须完成校验与人工批准后才能采用。", "AI may draft maps here, but adoption stays behind validation and human approval."),
      tabs: [
        { id: "map-lab:draft", label: localize(locale, "草稿", "Draft"), subtitle: localize(locale, "候选 map 草稿", "Candidate map draft") },
        { id: "map-lab:validate", label: localize(locale, "校验", "Validate"), subtitle: localize(locale, "就绪检查", "Readiness checks") },
        { id: "map-lab:review", label: localize(locale, "差异审阅", "Review Diff"), subtitle: localize(locale, "人工审阅面", "Human review surface") },
        { id: "map-lab:approve", label: localize(locale, "批准", "Approve"), subtitle: localize(locale, "批准姿态", "Approval posture") },
      ],
    },
    {
      id: "run-policy",
      navCode: "PLC",
      label: localize(locale, "策略", "Policy"),
      eyebrow: localize(locale, "一级页面", "Level 1"),
      description: localize(locale, "把安全锁、运行限制、导出边界和 app shell readiness 放在低频策略页。", "Low-frequency policy surface for safety locks, run limits, export posture, and app shell readiness."),
      tabs: [
        { id: "run-policy:safety", label: localize(locale, "安全锁", "Safety Locks"), subtitle: localize(locale, "停止条件", "Stop conditions") },
        { id: "run-policy:limits", label: localize(locale, "运行限制", "Run Limits"), subtitle: localize(locale, "硬边界", "Hard bounds") },
        { id: "run-policy:ai", label: localize(locale, "AI / 证据", "AI / Evidence"), subtitle: localize(locale, "只读策略摘要", "Read policy summary") },
        { id: "run-policy:export", label: localize(locale, "导出策略", "Export Policy"), subtitle: localize(locale, "请求制姿态", "Request-only posture") },
        { id: "run-policy:shell", label: localize(locale, "应用壳", "App Shell"), subtitle: localize(locale, "本地壳就绪", "Local shell readiness") },
      ],
    },
  ];
}

function buildMapCatalog(locale: Locale): CommanderConsoleMapView[] {
  return getDefaultMapPluginRegistry().listDeveloperCatalog().map((mapPackage) => ({
    packageId: mapPackage.packageId,
    version: mapPackage.packageVersion,
    mapId: mapPackage.mapId,
    title: mapPackage.title,
    readiness: mapPackage.lifecycleStatus === "active" ? "ok" : mapPackage.lifecycleStatus === "quarantined" ? "attention" : "blocked",
    summary: mapPackage.summary,
    approvalStatus: mapPackage.approvalStatus,
    lifecycleStatus: mapPackage.lifecycleStatus,
    validationSummary: mapPackage.validationIssues.length === 0
      ? localize(locale, "校验通过", "validation passed")
      : localize(locale, `${mapPackage.validationIssues.length} 个校验问题`, `${mapPackage.validationIssues.length} validation findings`),
    activationId: mapPackage.activationId,
    draftOnly: mapPackage.draftOnly,
    chain: mapPackage.chain,
  }));
}

function buildBadges(dashboard: CommanderMissionDashboardView, locale: Locale, activeTaskTemplateLabel: string | null): CommanderConsoleBadge[] {
  const healthAttention = dashboard.health.some((entry) => entry.tone === "danger" || entry.tone === "warn");

  return [
    {
      label: localize(locale, "运行状态", "runtime"),
      value: dashboard.runtime.runtimeStatus,
      tone: healthAttention ? "attention" : "ok",
    },
    {
      label: localize(locale, "任务", "mission"),
      value: dashboard.mission.missionId ?? localize(locale, "待命", "standby"),
      tone: dashboard.mission.missionId ? "ok" : "attention",
    },
    {
      label: localize(locale, "健康", "health"),
      value: healthAttention ? localize(locale, "需要关注", "attention needed") : localize(locale, "稳定", "stable"),
      tone: healthAttention ? "attention" : "ok",
    },
    {
      label: localize(locale, "任务模板", "task template"),
      value: activeTaskTemplateLabel ?? localize(locale, "未选择", "unselected"),
      tone: activeTaskTemplateLabel ? "ok" : "attention",
    },
  ];
}

function buildTopMetrics(dashboard: CommanderMissionDashboardView, locale: Locale, activeTaskTemplateLabel: string | null): CommanderConsoleViewModel["topMetrics"] {
  const totals = dashboard.auditSummary.totals;
  const readyRatio = totals ? `${totals.passed}/${totals.inspectors}` : localize(locale, "未知", "unknown");
  const pendingReviews = dashboard.candidates.filter((candidate) => candidate.reviewStatus === "pending").length;

  return [
    {
      id: "runtime",
      label: localize(locale, "运行", "runtime"),
      value: dashboard.runtime.runtimeStatus,
      tone: dashboard.runtime.runtimeStatus === "failed" ? "blocked" : dashboard.runtime.runtimeStatus === "review_required" ? "attention" : "ok",
    },
    {
      id: "task-template",
      label: localize(locale, "任务", "task"),
      value: activeTaskTemplateLabel ?? localize(locale, "未选择", "unselected"),
      tone: activeTaskTemplateLabel ? "ok" : "attention",
    },
    {
      id: "round",
      label: localize(locale, "轮次", "round"),
      value: `rnd_${String(dashboard.mission.currentRoundIndex).padStart(3, "0")}`,
      tone: dashboard.mission.currentRoundIndex > 0 ? "attention" : "ok",
    },
    {
      id: "health",
      label: localize(locale, "健康", "health"),
      value: readyRatio,
      tone: totals?.blocking ? "attention" : "ok",
    },
    {
      id: "pending",
      label: localize(locale, "待处理", "pending"),
      value: pendingReviews === 0 ? localize(locale, "0 复核", "0 reviews") : localize(locale, `${pendingReviews} 个复核`, `${pendingReviews} reviews`),
      tone: pendingReviews > 0 ? "attention" : "ok",
    },
  ];
}

function buildPreflightSummary(dashboard: CommanderMissionDashboardView, locale: Locale): CommanderConsolePreflightCheck[] {
  return [
    {
      id: "platform-binding",
      label: localize(locale, "平台绑定", "Platform binding"),
      status: dashboard.mission.requestedPlatform ? "ok" : "attention",
      detail: dashboard.mission.requestedPlatform
        ? localize(locale, `已指定 ${dashboard.mission.requestedPlatform}`, `Requested ${dashboard.mission.requestedPlatform}`)
        : localize(locale, "待启动时由已批准任务模板解析平台绑定。", "Platform binding will be resolved from the approved task template at launch time."),
    },
    {
      id: "map-selection",
      label: localize(locale, "地图选择", "Map selection"),
      status: dashboard.mission.selectedMapId ? "ok" : "attention",
      detail: dashboard.mission.selectedMapId
        ? localize(locale, "已绑定受治理任务程序", "Governed task program is bound.")
        : localize(locale, "待启动时由 active approved task template 解析运行地图。", "The active approved task template will resolve the runtime map at launch time."),
    },
    {
      id: "browser-login",
      label: localize(locale, "浏览器登录态", "Browser login"),
      status: dashboard.browser.loginState === "logged-in" ? "ok" : "attention",
      detail: localize(locale, `当前状态：${dashboard.browser.loginState}`, `Current state: ${dashboard.browser.loginState}`),
    },
    {
      id: "audit-freshness",
      label: localize(locale, "审计快照", "Audit snapshot"),
      status: dashboard.auditSummary.lastGeneratedAt ? "ok" : "attention",
      detail: dashboard.auditSummary.lastGeneratedAt
        ? localize(locale, `最近生成：${dashboard.auditSummary.lastGeneratedAt}`, `Last generated: ${dashboard.auditSummary.lastGeneratedAt}`)
        : localize(locale, "当前没有新鲜 audit 时间戳。", "No fresh audit generation timestamp is present."),
    },
  ];
}

function buildFailureRadar(dashboard: CommanderMissionDashboardView, locale: Locale): CommanderConsoleFailureItem[] {
  const failures: CommanderConsoleFailureItem[] = [];

  if (dashboard.runtime.reviewReason) {
    failures.push({
      id: "review-reason",
      label: localize(locale, "人工复核原因", "Review reason"),
      severity: "attention",
      detail: dashboard.runtime.reviewReason,
    });
  }

  if (dashboard.runtime.lastAiFailureReason) {
    failures.push({
      id: "ai-failure",
      label: localize(locale, "最近 AI 失败", "Latest AI failure"),
      severity: "blocked",
      detail: dashboard.runtime.lastAiFailureReason,
    });
  }

  if (dashboard.runtime.runtimeStatus !== "idle" && (!dashboard.mission.requestedPlatform || !dashboard.mission.selectedMapId)) {
    failures.push({
      id: "missing-start-binding",
      label: localize(locale, "启动草案缺字段", "Start draft missing fields"),
      severity: "blocked",
      detail: localize(locale, "运行中的任务缺少已解析绑定，这是非法状态。", "A running mission is missing its resolved binding, which is an invalid state."),
    });
  }

  if (failures.length === 0) {
    failures.push({
      id: "clear",
      label: localize(locale, "当前无阻断项", "No blocking findings"),
      severity: "ok",
      detail: localize(locale, "当前没有从 snapshot 派生出的阻断信号。", "No blocking signal is derived from the current snapshot."),
    });
  }

  return failures;
}

function buildReviewSummary(dashboard: CommanderMissionDashboardView): CommanderConsoleViewModel["reviewQueueSummary"] {
  return dashboard.candidates.reduce<CommanderConsoleViewModel["reviewQueueSummary"]>((summary, candidate) => {
    if (candidate.reviewStatus === "approved") {
      summary.approvedCount += 1;
    } else if (candidate.reviewStatus === "rejected") {
      summary.rejectedCount += 1;
    } else if (candidate.reviewStatus === "archived" || candidate.reviewStatus === "hold") {
      summary.archivedCount += 1;
    } else {
      summary.pendingCount += 1;
    }

    return summary;
  }, {
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    archivedCount: 0,
  });
}

function buildInspectItems(dashboard: CommanderMissionDashboardView, locale: Locale, mapCatalog: CommanderConsoleMapView[]): CommanderConsoleInspectItem[] {
  const mapItems = mapCatalog.map((map) => ({
    kind: "map" as const,
    id: map.mapId,
    title: map.title,
    subtitle: localize(locale, "地图详情", "Map details"),
    summary: map.summary,
    owner: localize(locale, "编排层", "orchestration"),
    json: map,
    references: [
      { label: localize(locale, "地图包", "Package"), value: map.packageId },
      { label: localize(locale, "审批", "Approval"), value: map.approvalStatus },
    ],
  }));

  const evidenceItems = dashboard.evidencePackets.map((record) => ({
    kind: "evidence" as const,
    id: record.id,
    title: record.primary,
    subtitle: localize(locale, "证据详情", "Evidence details"),
    summary: record.detail,
    owner: localize(locale, "取证记账", "forensics"),
    json: record,
    references: [
      { label: localize(locale, "记录 ID", "Record ID"), value: record.id },
      { label: localize(locale, "副标题", "Secondary"), value: record.secondary },
    ],
  }));

  const roundItems = dashboard.runtimeProof.map((entry, index) => ({
    kind: "round" as const,
    id: `${entry.step}-${index}`,
    title: entry.step,
    subtitle: localize(locale, "轮次 / 证明详情", "Round / proof details"),
    summary: entry.message,
    owner: localize(locale, "运行证明", "runtime-proof"),
    json: entry,
    references: [
      { label: localize(locale, "时间", "Time"), value: entry.createdAt },
      { label: localize(locale, "状态", "Status"), value: entry.status },
    ],
  }));

  const healthItems = dashboard.health.map((entry) => ({
    kind: "health" as const,
    id: entry.id,
    title: entry.label,
    subtitle: localize(locale, "能力健康详情", "Capability health details"),
    summary: entry.detail,
    owner: localize(locale, "能力健康", "capability-health"),
    json: entry,
    references: [
      { label: localize(locale, "能力 ID", "Capability ID"), value: entry.id },
      { label: localize(locale, "色调", "Tone"), value: entry.tone },
    ],
  }));

  return [
    ...mapItems,
    ...evidenceItems,
    ...roundItems,
    ...healthItems,
  ];
}

function buildPolicies(locale: Locale): {
  safetyLocks: CommanderConsolePolicyCheck[];
  runLimits: CommanderConsolePolicyCheck[];
  appShellReadiness: CommanderConsolePolicyCheck[];
} {
  return {
    safetyLocks: [
      {
        id: "no-silent-default",
        label: localize(locale, "禁止静默默认值", "No silent defaults"),
        status: "ok",
        detail: localize(locale, "指挥启动必须同时显式提交 map 与 platform。", "Mission start must explicitly submit both map and platform."),
      },
      {
        id: "emergency-stop-ready",
        label: localize(locale, "急停通路", "Emergency stop path"),
        status: "ok",
        detail: localize(locale, "保留独立 emergency-stop command transport。", "Dedicated emergency-stop command transport remains available."),
      },
    ],
    runLimits: [
      {
        id: "max-rounds",
        label: localize(locale, "最大轮次", "Max rounds"),
        status: "ok",
        detail: localize(locale, "默认 3 轮，可在起始草案中显式修改。", "Defaults to 3 rounds and must be explicitly set in the start draft."),
      },
      {
        id: "max-minutes",
        label: localize(locale, "最大分钟数", "Max minutes"),
        status: "ok",
        detail: localize(locale, "默认 20 分钟，用于约束本地长跑。", "Defaults to 20 minutes to bound local execution."),
      },
    ],
    appShellReadiness: [
      {
        id: "local-shell-only",
        label: localize(locale, "本地壳边界", "Local shell boundary"),
        status: "ok",
        detail: localize(locale, "当前 Commander Console 仍为本地 HTTP app shell，不引入 SaaS / browser extension 形态。", "Commander Console stays as a local HTTP app shell without SaaS or extension drift."),
      },
      {
        id: "inspect-drawer-ready",
        label: localize(locale, "Inspect Drawer", "Inspect drawer"),
        status: "ok",
        detail: localize(locale, "右侧抽屉承接深信息，主工作区不再塞满日志与原始记录。", "The right drawer absorbs deep details so the main workspace is no longer a packed dashboard."),
      },
    ],
  };
}

function buildMissionSummary(dashboard: CommanderMissionDashboardView, locale: Locale): string {
  if (!dashboard.mission.missionId) {
    return localize(locale, "当前无活动任务。先选择任务模板并设定运行限制，再开始执行。", "No active mission. Choose a task template and run limits before starting execution.");
  }

  return localize(locale, `任务 ${dashboard.mission.missionId} 正在 ${dashboard.mission.status}，当前目标：${dashboard.mission.humanGoal || "未填写"}。`, `Mission ${dashboard.mission.missionId} is ${dashboard.mission.status} with goal ${dashboard.mission.humanGoal || "unspecified"}.`);
}

export function buildCommanderConsoleViewModel(dashboard: CommanderMissionDashboardView, locale: Locale): CommanderConsoleViewModel {
  const primaryPages = buildPrimaryPages(locale);
  const mapCatalog = buildMapCatalog(locale);
  const taskTemplates = buildCommanderTaskTemplates(locale);
  const activeTaskTemplate = taskTemplates.find((template) => template.availability === "ready"
    && template.developerBinding?.mapId === (dashboard.mission.selectedMapId ?? null)
    && template.developerBinding?.requestedPlatformId === (dashboard.mission.requestedPlatform ?? null))
    ?? taskTemplates.find((template) => template.availability === "ready")
    ?? null;
  const policies = buildPolicies(locale);
  const exportSummary = [
    {
      id: "candidate-summary",
      label: localize(locale, "候选摘要导出", "Candidate summary export"),
      status: localize(locale, "当前构建未开放", "Unavailable in this build"),
      detail: localize(locale, "当前构建尚未实现 governed export request，所以页面不再把导出显示为可执行动作。", "Governed export requests are not implemented in this build, so the page no longer presents export as an executable action."),
    },
  ];

  return {
    locale,
    appTitle: localize(locale, "GrassEye Commander Console", "GrassEye Commander Console"),
    appSubtitle: localize(locale, "一级页面 + 二级 Tab + 三级 Inspect Drawer 的本地指挥控制台", "A local command shell with primary pages, secondary tabs, and a right inspect drawer."),
    missionSummary: buildMissionSummary(dashboard, locale),
    badges: buildBadges(dashboard, locale, activeTaskTemplate?.displayName ?? null),
    topMetrics: buildTopMetrics(dashboard, locale, activeTaskTemplate?.displayName ?? null),
    primaryPages,
    activeMissionSummary: [
      { label: localize(locale, "任务 ID", "Mission ID"), value: dashboard.mission.missionId ?? localize(locale, "待命", "standby"), tone: dashboard.mission.missionId ? "ok" : "attention" },
      { label: localize(locale, "状态", "Status"), value: dashboard.mission.status },
      { label: localize(locale, "平台", "Platform"), value: dashboard.mission.requestedPlatform ?? localize(locale, "未指派", "unassigned"), tone: dashboard.mission.requestedPlatform ? "ok" : "attention" },
      { label: localize(locale, "任务模板", "Task Template"), value: activeTaskTemplate?.displayName ?? localize(locale, "未选择", "unselected"), tone: activeTaskTemplate ? "ok" : "attention" },
      { label: localize(locale, "目标", "Goal"), value: dashboard.mission.humanGoal || localize(locale, "未填写", "unspecified") },
    ],
    activeRoundSummary: [
      { label: localize(locale, "轮次", "Round index"), value: String(dashboard.mission.currentRoundIndex) },
      { label: localize(locale, "当前步骤", "Current step"), value: dashboard.runtime.currentStep ?? localize(locale, "空闲", "idle") },
      { label: localize(locale, "累计浏览", "Total seen"), value: String(dashboard.runtime.totalSeenCount) },
      { label: localize(locale, "候选数", "Candidate count"), value: String(dashboard.runtime.candidateCount) },
      { label: localize(locale, "最后人类命令", "Last human command"), value: dashboard.mission.lastHumanCommand ?? localize(locale, "无", "none") },
    ],
    availableMaps: mapCatalog,
    taskTemplates,
    preflightSummary: buildPreflightSummary(dashboard, locale),
    commandDraft: {
      commandType: "start-mission",
      commandSource: "commander-console:start-form-submit",
      taskTemplateId: activeTaskTemplate?.taskTemplateId ?? null,
      humanGoal: activeTaskTemplate?.defaultHumanGoal ?? (dashboard.mission.humanGoal || ""),
      targetProfileRef: activeTaskTemplate?.developerBinding?.targetProfileRef ?? (dashboard.browser.browserProfileRef || null),
      maxRounds: activeTaskTemplate?.defaultRunLimit.maxRounds ?? 3,
      maxMinutes: activeTaskTemplate?.defaultRunLimit.maxMinutes ?? 20,
    },
    capabilityHealth: dashboard.health,
    reviewQueueSummary: buildReviewSummary(dashboard),
    failureRadarSummary: buildFailureRadar(dashboard, locale),
    structuredLogPreview: dashboard.runtimeProof.slice(0, 8).map((entry, index) => ({
      id: `${entry.step}-${index}`,
      createdAt: entry.createdAt,
      step: entry.step,
      status: entry.status,
      message: entry.message,
    })),
    evidencePackets: dashboard.evidencePackets,
    browseLedger: dashboard.browseLedger,
    failedRecords: dashboard.failedRecords,
    runtimeProofTimeline: dashboard.runtimeProof,
    exportSummary,
    safetyLocks: policies.safetyLocks,
    runLimits: policies.runLimits,
    appShellReadiness: policies.appShellReadiness,
    inspectItems: buildInspectItems(dashboard, locale, mapCatalog),
    rawSnapshot: dashboard,
  };
}