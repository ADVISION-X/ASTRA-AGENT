# GrassEye 平台适配与页面动作施工图

## 定位

本图只定义平台 profile / hints 如何被能力组消费，不定义能力主权，也不再对应独立 owner。

## 主权链

- Commander Console：人工命令入口
- Orchestration：地图与 mission state
- Nerve Bus：受治理运输
- Open：打开目标
- Page State：识别当前页面状态
- Screenshot：统一截图
- Visual Target：产出视觉目标合同
- Geometry Guard：产出坐标执行计划
- Mouse Click：执行点击 primitive
- Mouse Scroll：执行滚动 primitive
- Post-action Verification：判断动作结果
- PlatformAdapter / platform profile：封装平台差异，不拥有上述主权

## PlatformAdapter 只做什么

- 持有平台 profile 和 action hints
- 把平台差异翻译成受治理输入
- 提供平台 rate-limit 和安全边界

## PlatformAdapter 不做什么

- 不拥有 open
- 不拥有 page-state
- 不拥有 visual target
- 不拥有 geometry policy
- 不拥有 click 或 scroll primitive
- 不拥有动作后验证
- 不拥有 map 选择或下一步决策
- 不得自己执行 open、click、scroll、screenshot

## 禁止边界

- 不保留 visual action 复合主链
- 不保留 browse-flow 或 agent-runtime 叙事
- 不允许 DOM 或 selector 成为生产验收路径
- 不允许 verify 脚本作为能力验收

## 验收信号

建对表现：

- platform profile 只暴露平台差异
- 所有动作都能追溯到能力组输入和输出
- 文档不再把 platform-action 写成独立 owner 或 action owner

漂移信号：

- adapter 自己定义第二套 target truth 或 state truth
- adapter 自己执行结果判断
- 文档重新合成 visual action 主权
- phase-gate 或 audit-plan 再次出现 platform-action owner
