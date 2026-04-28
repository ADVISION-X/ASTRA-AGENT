# GrassEye 视觉坐标组合链说明

## 定位

本图只说明多个能力组如何串接成受治理的视觉坐标组合链。

它不是独立能力组。
它不是第二运行模式。
它不定义新主权、路径或执法链。

## 组合链

- Screenshot：提供 source screenshot、region crop、ai_input、contact sheet 与 scaleMapping 证据
- Visual Target：输出标准化 bbox 与 clickPoint
- Geometry Guard：校验 coordinateSpace、bounds、scaleMapping，并输出 allow、block、review_required 与 normalized geometry
- Mouse Click / Mouse Scroll：执行 primitive
- Post-action Verification：验证动作结果
- PlatformAdapter：只串接 public contracts，不拥有组合链主权

## 一句话原则

先看见，再定位，再判断几何，再执行 primitive，再做动作后验证。

## 边界分工

- Visual Target 找点，不批准执行
- Geometry Guard 验点并归一化 executable geometry
- Mouse Click / Mouse Scroll 只执行，不决定几何是否合法
- Post-action Verification 只判断动作结果，不回收几何主权
- PlatformAdapter 只串接五个能力组的 public contracts，不得定义新 owner

## 硬禁止

- 不把该组合链写成独立 Visual Action 能力组
- 不把该组合链描述成第二运行模式
- 不让 Geometry Guard 生成 actionPlan
- 不让 Geometry Guard 知道 open_comments、continue_next、click_not_interested 等业务动作词汇
- 不让 contactSheet 或 aiInput 坐标跳过 Geometry Guard 直接进入点击或滚动
- 不让 DOM 或 selector 成为生产验收主链
- 不让 verify 脚本作为组合链验收

## 验收信号

建对表现：

- 组合链中的每一步都对应真实能力组 owner
- Geometry Guard 成为唯一坐标安全门禁
- adapter 只串接，不抢主权
- 文档只描述组合关系，不再生成复合 owner

漂移信号：

- 出现独立 visual action 主权
- 出现第二运行模式叙事
- Geometry Guard 重新长成动作计划器
- click 或 scroll 层自己判断最终几何是否通过
- DOM fallback 被写成验收主链