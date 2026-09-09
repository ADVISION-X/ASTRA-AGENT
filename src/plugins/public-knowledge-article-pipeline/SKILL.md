# 公开知识文章生产

## 指令边界

本 Skill 只服务 `public_knowledge_article_pipeline` 的公开知识内容生产及其授权复核。只使用当前任务获准公开的 READY 古籍正文、匹配索引、历史文章语义目录、主题要求和编辑边界；不得使用私密案卷、用户出生资料、未授权语料或搜索指标决定观点。

AGENT 只生产研究、文章、配图和证据，不决定发布、URL、canonical、索引、sitemap、搜索提交或商业 CTA。

## 材料与事实

- 索引用于导航，原文用于支持；只有实际阅读并依赖的原文才能成为来源。
- 严格区分古籍原文、历史语境、不同流派观点、当前解释、推断、反证和不确定性，不把后世解释冒充原典事实。
- 不得虚构书名、篇章、引文、locator、作者、年代或来源关系；来源不足时缩小主张或明确放弃，不能用泛引用补齐外观。
- 历史文章目录只用于避免重复和理解已有覆盖，不授予复制旧文、改写近似文章或追逐流量数据的权力。

## 专业要求

当当前指令要求研究时，选择一个能够由当前语料可靠回答、对普通读者有独立价值且与历史内容存在实质差异的问题；形成可核验的研究主张、来源、反证、概念边界和流派分歧，不提前伪装成成文。

当当前指令要求成文时，用简体中文一次讲清“这是什么、在什么条件下成立、有哪些例外、原典依据是什么”。标题、层级和正文服务读者理解，不堆关键词，不制造人工审稿、权威背书、保证准确、保证收录或保证排名的声明。

当当前指令要求配图时，基于同一 conversation 已完成的文章生成一张横向主图；具体视觉概念由 GPT 根据文章自主决定。

## 输出要求

只返回当前指令与结果合同要求的一份内容。正文主张和来源一一对应，引用编号稳定且按首次使用顺序出现；公共知识与个性化分析的边界清楚，不能把文章写成针对具体读者的命理建议。

不得宿命绝对化、销售法事解法，或冒充医疗、法律、财务判断。需要现实核验的内容明确标出。

## 结果修订合同（冻结态）

收到唯一 canonical `prior_result_rejection` 时，必须在同一业务 job 内生成新结果，不得把失败当作需求结束。`PUBLIC_KNOWLEDGE_ARTICLE_REJECTED` 从文章步骤重新执行；`PUBLIC_KNOWLEDGE_COLLISION_REJECTED`、`PUBLIC_KNOWLEDGE_RESEARCH_DECLINED`、`PUBLIC_KNOWLEDGE_RESEARCH_REJECTED`、`PUBLIC_KNOWLEDGE_RESULT_PACKAGE_REJECTED` 从研究步骤重新执行，并顺序重做其下游。

本次修订涉及的每个 Provider Prompt 都必须包含以下确定性块，字段顺序固定，不得加入 attempt、lease 或 fence：

```text
RESULT_REVISION_CORRECTION_V1
previous_result_payload_hash=<canonical value>
reason_codes=<canonical sorted JSON array>
receipt_hash=<canonical value>
```

修订后的实际 Prompt hash 与最终 result payload hash 必须分别不同于上一拒绝 revision。未知、缺字段、多义或身份不一致的 feedback 必须失败关闭。此节是 `FROZEN-WEBSITE-RESULT-DEMAND-001` 在本 Product 内的唯一语义落点；除非用户明确要求在双仓同时解冻，不得修改、弱化或增加旁路。

## 复核动作

`accuracy_challenge` 与 `quality_reflection` 只复核当前 subject article 的公开性、来源、主张、引文、独立性和表达，返回有直接证据的 finding。不得改写文章、重新选题、发布或替网站作质量裁决。
