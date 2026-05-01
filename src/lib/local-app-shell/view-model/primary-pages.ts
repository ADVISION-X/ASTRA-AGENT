import type { Locale } from "../../localization/dictionaries.js";

import { localizeCommanderText } from "../locale.js";
import type { CommanderConsolePageView, CommanderConsoleTabView } from "../types.js";

type TabDefinition = {
  id: string;
  zhLabel: string;
  enLabel: string;
  zhSubtitle: string;
  enSubtitle: string;
};

type PageDefinition = {
  id: CommanderConsolePageView["id"];
  navCode: string;
  zhLabel: string;
  enLabel: string;
  zhEyebrow: string;
  enEyebrow: string;
  zhDescription: string;
  enDescription: string;
  tabs: TabDefinition[];
};

const PRIMARY_PAGE_DEFINITIONS: PageDefinition[] = [
  {
    id: "command-center",
    navCode: "CMD",
    zhLabel: "指令",
    enLabel: "Command",
    zhEyebrow: "一级页面",
    enEyebrow: "Level 1",
    zhDescription: "用户只选任务模板与运行限制。内部 map / platform / profile 仅在高级与检查面显示。",
    enDescription: "The operator only picks a task template and run limits. Internal map, platform, and profile stay in Advanced and Inspect views.",
    tabs: [
      { id: "command-center:maps", zhLabel: "任务目录", enLabel: "Task Catalog", zhSubtitle: "选择预设任务模板", enSubtitle: "Choose a preset task template" },
      { id: "command-center:start", zhLabel: "开始运行", enLabel: "Start Run", zhSubtitle: "设置限制并开始", enSubtitle: "Set limits and begin" },
      { id: "command-center:preflight", zhLabel: "预检", enLabel: "Preflight", zhSubtitle: "启动前就绪门", enSubtitle: "Readiness gates" },
      { id: "command-center:preview", zhLabel: "指令预览", enLabel: "Command Preview", zhSubtitle: "人类命令 JSON", enSubtitle: "Human command JSON" },
    ],
  },
  {
    id: "mission-cockpit",
    navCode: "MSN",
    zhLabel: "任务",
    enLabel: "Mission",
    zhEyebrow: "一级页面",
    enEyebrow: "Level 1",
    zhDescription: "展示运行真相、轮次推进和证明链，不在这里改写任务真相。",
    enDescription: "Mission cockpit for runtime truth, round progression, and proof chains without owning mission truth.",
    tabs: [
      { id: "mission-cockpit:overview", zhLabel: "总览", enLabel: "Overview", zhSubtitle: "任务摘要", enSubtitle: "Mission summary" },
      { id: "mission-cockpit:current", zhLabel: "当前轮次", enLabel: "Current Round", zhSubtitle: "实时轮次状态", enSubtitle: "Live round status" },
      { id: "mission-cockpit:proof", zhLabel: "运行证明", enLabel: "Runtime Proof", zhSubtitle: "最近证明链", enSubtitle: "Recent proof chain" },
      { id: "mission-cockpit:target", zhLabel: "当前目标", enLabel: "Current Target", zhSubtitle: "目标预览", enSubtitle: "Target preview" },
    ],
  },
  {
    id: "records-exports",
    navCode: "REC",
    zhLabel: "记录",
    enLabel: "Records",
    zhEyebrow: "一级页面",
    enEyebrow: "Level 1",
    zhDescription: "证据包、浏览账本、失败记录、复核队列与导出请求在这里分层查看。",
    enDescription: "Evidence packets, browse ledger, failed records, review queues, and governed export requests.",
    tabs: [
      { id: "records-exports:evidence", zhLabel: "证据包", enLabel: "Evidence Packets", zhSubtitle: "可检查证据", enSubtitle: "Inspectable evidence" },
      { id: "records-exports:ledger", zhLabel: "浏览账本", enLabel: "Browse Ledger", zhSubtitle: "浏览轨迹", enSubtitle: "Browse trail" },
      { id: "records-exports:failed", zhLabel: "失败记录", enLabel: "Failed Records", zhSubtitle: "运行落空项", enSubtitle: "Operational misses" },
      { id: "records-exports:review", zhLabel: "复核记录", enLabel: "Review Records", zhSubtitle: "队列状态", enSubtitle: "Queue status" },
      { id: "records-exports:export", zhLabel: "导出中心", enLabel: "Export Center", zhSubtitle: "受治理导出请求", enSubtitle: "Governed export requests" },
    ],
  },
  {
    id: "debug-health",
    navCode: "DBG",
    zhLabel: "诊断",
    enLabel: "Diagnostics",
    zhEyebrow: "一级页面",
    enEyebrow: "Level 1",
    zhDescription: "能力健康、故障雷达、日志预览、未终结轮次与审计姿态在这里收口。",
    enDescription: "Capability health, failure radar, log previews, unresolved rounds, and audit posture.",
    tabs: [
      { id: "debug-health:health", zhLabel: "能力健康", enLabel: "Capability Health", zhSubtitle: "归属状态", enSubtitle: "Owner status" },
      { id: "debug-health:failure", zhLabel: "故障雷达", enLabel: "Failure Radar", zhSubtitle: "阻断信号", enSubtitle: "Blocking signals" },
      { id: "debug-health:logs", zhLabel: "结构化日志", enLabel: "Structured Log", zhSubtitle: "只做预览", enSubtitle: "Preview only" },
      { id: "debug-health:rounds", zhLabel: "未终结轮次", enLabel: "Unfinalized Rounds", zhSubtitle: "操作员关注", enSubtitle: "Operator attention" },
      { id: "debug-health:audit", zhLabel: "审计摘要", enLabel: "Audit Summary", zhSubtitle: "本地就绪", enSubtitle: "Local readiness" },
    ],
  },
  {
    id: "map-lab",
    navCode: "MAP",
    zhLabel: "地图实验室",
    enLabel: "Map Lab",
    zhEyebrow: "一级页面",
    enEyebrow: "Level 1",
    zhDescription: "AI 只可起草地图，必须完成校验与人工批准后才能采用。",
    enDescription: "AI may draft maps here, but adoption stays behind validation and human approval.",
    tabs: [
      { id: "map-lab:draft", zhLabel: "草稿", enLabel: "Draft", zhSubtitle: "候选 map 草稿", enSubtitle: "Candidate map draft" },
      { id: "map-lab:validate", zhLabel: "校验", enLabel: "Validate", zhSubtitle: "就绪检查", enSubtitle: "Readiness checks" },
      { id: "map-lab:review", zhLabel: "差异审阅", enLabel: "Review Diff", zhSubtitle: "人工审阅面", enSubtitle: "Human review surface" },
      { id: "map-lab:approve", zhLabel: "批准", enLabel: "Approve", zhSubtitle: "批准姿态", enSubtitle: "Approval posture" },
    ],
  },
  {
    id: "run-policy",
    navCode: "PLC",
    zhLabel: "策略",
    enLabel: "Policy",
    zhEyebrow: "一级页面",
    enEyebrow: "Level 1",
    zhDescription: "把安全锁、运行限制、导出边界和 app shell readiness 放在低频策略页。",
    enDescription: "Low-frequency policy surface for safety locks, run limits, export posture, and app shell readiness.",
    tabs: [
      { id: "run-policy:safety", zhLabel: "安全锁", enLabel: "Safety Locks", zhSubtitle: "停止条件", enSubtitle: "Stop conditions" },
      { id: "run-policy:limits", zhLabel: "运行限制", enLabel: "Run Limits", zhSubtitle: "硬边界", enSubtitle: "Hard bounds" },
      { id: "run-policy:ai", zhLabel: "AI / 证据", enLabel: "AI / Evidence", zhSubtitle: "只读策略摘要", enSubtitle: "Read policy summary" },
      { id: "run-policy:export", zhLabel: "导出策略", enLabel: "Export Policy", zhSubtitle: "请求制姿态", enSubtitle: "Request-only posture" },
      { id: "run-policy:shell", zhLabel: "应用壳", enLabel: "App Shell", zhSubtitle: "本地壳就绪", enSubtitle: "Local shell readiness" },
    ],
  },
];

function toTab(locale: Locale, definition: TabDefinition): CommanderConsoleTabView {
  return {
    id: definition.id,
    label: localizeCommanderText(locale, definition.zhLabel, definition.enLabel),
    subtitle: localizeCommanderText(locale, definition.zhSubtitle, definition.enSubtitle),
  };
}

function toPage(locale: Locale, definition: PageDefinition): CommanderConsolePageView {
  return {
    id: definition.id,
    navCode: definition.navCode,
    label: localizeCommanderText(locale, definition.zhLabel, definition.enLabel),
    eyebrow: localizeCommanderText(locale, definition.zhEyebrow, definition.enEyebrow),
    description: localizeCommanderText(locale, definition.zhDescription, definition.enDescription),
    tabs: definition.tabs.map((tab) => toTab(locale, tab)),
  };
}

export function buildPrimaryPages(locale: Locale): CommanderConsolePageView[] {
  return PRIMARY_PAGE_DEFINITIONS.map((definition) => toPage(locale, definition));
}