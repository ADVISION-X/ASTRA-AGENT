export type DeepResearchFieldHelpKey =
  | "userQuestion"
  | "analysisGoal"
  | "inputAttachments"
  | "language"
  | "providerKind"
  | "maxSubQuestions";

export function getFieldHelpContent(): Record<DeepResearchFieldHelpKey, {
  title: string;
  body: string;
  effect: string;
}> {
  return {
    userQuestion: {
      title: "User Question",
      body: "这里填写你真正要研究的大问题。写得越具体，AI 第一轮拆解 ResearchPlan 时越容易拆出有用的子问题。",
      effect: "作用：这是整个 Deep Research 的主问题，会进入第一轮拆解、每个子问题分析、Full Case File、最终裁决和 HTML 报告。",
    },
    analysisGoal: {
      title: "Analysis Goal",
      body: "这一项可以不填。它不是第二个问题，而是告诉 AI 本次研究希望偏向什么交付目标、判断口径或使用场景。",
      effect: "作用：填写后会附加进第一轮拆解 prompt，并作为后续子问题分析上下文保存进案卷。比如：只要民间确认案例，不判断真假；输出可执行清单；优先找反例和风险。",
    },
    inputAttachments: {
      title: "Input Attachments",
      body: "在 APP 页面添加本机文件，支持图片、zip、json、markdown、txt 等 AI Input Gateway 已批准的资料文件。",
      effect: "作用：这些文件会随第一轮拆解、每个子问题分析、最终裁决和 HTML 报告一起投喂给 AI；web chat 通道会使用现有 Chrome Cmd+V 文件投喂链。",
    },
    language: {
      title: "Language",
      body: "选择 AI 回复和最终报告使用的语言。中文任务一般选 zh-CN；英文商业报告或英文材料优先时选 en。",
      effect: "作用：影响 ResearchPlan、N 阶段回答、最终裁决和 HTML 报告的输出语言。",
    },
    providerKind: {
      title: "Provider",
      body: "选择把 prompt 投喂给哪个 AI 通道。GPT web chat 会走已授权的 ChatGPT 网页会话；Gemini web chat 走 Gemini 网页会话；Gemini API 走 API 通道。",
      effect: "作用：只决定外部 AI 传输通道，不改变 Deep Research 的 1+N+1+1 主流程和案卷保存规则。",
    },
    maxSubQuestions: {
      title: "Max sub questions",
      body: "限制第一轮 AI 最多拆出多少个子问题。数字越大，覆盖面更广，但运行时间和 AI 调用次数也更多。",
      effect: "作用：当前允许 2 到 12。一般问题用 4-6；复杂商业/技术判断可用 6-10；特别宽的问题才考虑 12。",
    },
  };
}
